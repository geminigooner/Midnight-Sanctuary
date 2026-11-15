import firebaseApp from '../firebase';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { resolveCanonicalEntityId } from '../domains/sovereignRegistry';
import { ensureValidDocId } from '../persistenceSystem';
import { PersistenceCoordinator } from '../persistence/persistenceCoordinator';
import { MediaAssetCategory, MediaAssetRecord } from '../types';

/**
 * Deduplicated Media Storage Service with Lightweight References.
 *
 * Implements User Architectural Decision #2:
 * - Stores binary image/media payloads in Firebase Cloud Storage (`users/{uid}/blobs/{sha256}.{ext}`)
 *   with automatic fallback to local IndexedDB `media_blobs` (`VaultChunkedFallbackDriver`) when offline
 *   or if Cloud Storage bucket permissions/quotas are unavailable.
 * - Stores lightweight `MediaAssetRecord` metadata and `references: string[]` in Firestore
 *   (`users/{uid}/mediaAssets/{assetId}`).
 * - Per-user SHA-256 content-addressable deduplication: identical media uploaded by the same user
 *   reuses the existing blob and appends the new reference tag (`conv:{id}:msg:{id}`, `entity:{id}:avatar`,
 *   `profile:avatar`, `gift:{id}`), while NEVER sharing blobs across different users.
 * - Reference-counted deletion: deleting a conversation or companion removes only its reference tags
 *   (`removeMediaReferencesByPrefix`) and never deletes media still referenced elsewhere.
 */

export interface StoreMediaInput {
  dataUrlOrBase64: string;
  mimeType?: string;
  category: MediaAssetCategory;
  referenceTag: string;
  ownerEntityId?: string;
  width?: number;
  height?: number;
}

export interface StoredMediaResult {
  asset: MediaAssetRecord;
  resolvedUrl: string;
}

function parseDataUrl(input: string, fallbackMime = 'image/png'): {
  mimeType: string;
  base64Data: string;
  dataUrl: string;
} {
  const trimmed = (input || '').trim();
  const match = trimmed.match(/^data:([^;,]+);base64,(.+)$/i);
  if (match) {
    return {
      mimeType: match[1].toLowerCase(),
      base64Data: match[2],
      dataUrl: trimmed,
    };
  }
  const cleanMime = fallbackMime.toLowerCase();
  return {
    mimeType: cleanMime,
    base64Data: trimmed,
    dataUrl: `data:${cleanMime};base64,${trimmed}`,
  };
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function extensionForMime(mimeType: string): string {
  const clean = (mimeType || '').toLowerCase();
  if (clean.includes('jpeg') || clean.includes('jpg')) return 'jpg';
  if (clean.includes('webp')) return 'webp';
  if (clean.includes('gif')) return 'gif';
  if (clean.includes('svg')) return 'svg';
  if (clean.includes('wav')) return 'wav';
  if (clean.includes('mp3') || clean.includes('mpeg')) return 'mp3';
  return 'png';
}

/**
 * Computes a deterministic SHA-256 hex digest (using Web Crypto when available, or deterministic dual-lane FNV/DJB2 in synchronous/test environments).
 */
export async function computeMediaSha256(bytes: Uint8Array): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
      const digestBuffer = await crypto.subtle.digest('SHA-256', bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer);
      const hashArray = Array.from(new Uint8Array(digestBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fallback below
  }

  // Deterministic 256-bit fallback digest
  const lanes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    const laneIdx = i & 7;
    lanes[laneIdx] = Math.imul(lanes[laneIdx] ^ b, 0x01000193) >>> 0;
  }
  return lanes.map((l) => (l >>> 0).toString(16).padStart(8, '0')).join('');
}

export class MediaStorageService {
  private readonly coordinator: PersistenceCoordinator;
  private readonly allowCloudStorage: boolean;

  constructor(
    coordinator: PersistenceCoordinator,
    options?: { allowCloudStorage?: boolean }
  ) {
    this.coordinator = coordinator;
    this.allowCloudStorage = options?.allowCloudStorage ?? true;
  }

  /**
   * Registers or deduplicates a media asset for the current user, uploads/stores the binary payload,
   * and attaches `referenceTag` to the asset's reference set.
   */
  public async storeMediaAsset(input: StoreMediaInput): Promise<StoredMediaResult> {
    const { mimeType, base64Data, dataUrl } = parseDataUrl(
      input.dataUrlOrBase64,
      input.mimeType || 'image/png'
    );
    const bytes = base64ToUint8Array(base64Data);
    const sha256 = await computeMediaSha256(bytes);
    const assetId = ensureValidDocId(`media_${sha256.slice(0, 40)}`, 'media');
    const uid = this.coordinator.getDomainState().uid || '__local_unauthenticated__';
    const canonicalOwnerEntity = input.ownerEntityId
      ? resolveCanonicalEntityId(input.ownerEntityId)
      : undefined;

    // 1. Always cache binary payload in local IndexedDB `media_blobs` for instant offline hydration
    await this.coordinator.getVault().putMediaBlob({
      ownerUid: uid,
      assetId,
      mimeType,
      dataUrl,
      byteSize: bytes.byteLength,
      createdAt: Date.now(),
    });

    // 2. Check if this user already has a deduplicated asset with the same SHA-256
    const existing = this.coordinator.getMediaAsset(assetId);
    if (existing && !existing.isDeleted) {
      const updatedRefs = Array.from(
        new Set([...(existing.references || []), input.referenceTag].filter(Boolean))
      );
      const updatedAsset = await this.coordinator.upsertMediaAsset({
        ...existing,
        references: updatedRefs,
        ownerEntityId: existing.ownerEntityId || canonicalOwnerEntity,
        updatedAt: Date.now(),
      });
      return {
        asset: updatedAsset,
        resolvedUrl: updatedAsset.downloadUrl || dataUrl,
      };
    }

    // 3. Attempt Firebase Cloud Storage upload if authenticated and online
    const ext = extensionForMime(mimeType);
    const storagePath = `users/${uid}/blobs/${sha256}.${ext}`;
    let storageBackend: 'firebase_storage' | 'vault_chunked' = 'vault_chunked';
    let downloadUrl: string | undefined;

    if (
      this.allowCloudStorage &&
      uid !== '__local_unauthenticated__' &&
      this.coordinator.getSyncStatus().isOnline
    ) {
      try {
        const storage = getStorage(firebaseApp);
        const blobRef = storageRef(storage, storagePath);
        await uploadBytes(blobRef, bytes, {
          contentType: mimeType,
          customMetadata: {
            uid,
            sha256,
            category: input.category,
            ...(canonicalOwnerEntity ? { ownerEntityId: canonicalOwnerEntity } : {}),
          },
        });
        downloadUrl = await getDownloadURL(blobRef);
        storageBackend = 'firebase_storage';
      } catch {
        // Fallback transparently to VaultChunkedFallbackDriver (`storageBackend: 'vault_chunked'`)
        storageBackend = 'vault_chunked';
      }
    }

    const now = Date.now();
    const record: MediaAssetRecord = {
      id: assetId,
      uid,
      ownerEntityId: canonicalOwnerEntity,
      sha256,
      mimeType,
      sizeBytes: bytes.byteLength,
      width: input.width,
      height: input.height,
      category: input.category,
      storageBackend,
      storagePath,
      downloadUrl,
      references: input.referenceTag ? [input.referenceTag] : [],
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.coordinator.upsertMediaAsset(record);
    return {
      asset: saved,
      resolvedUrl: saved.downloadUrl || dataUrl,
    };
  }

  /**
   * Adds a new reference tag (`conv:{id}:msg:{id}`, `entity:{id}:avatar`, etc.) to an existing media asset.
   */
  public async addMediaReference(assetId: string, referenceTag: string): Promise<MediaAssetRecord | null> {
    if (!assetId || !referenceTag) return null;
    const existing = this.coordinator.getMediaAsset(assetId);
    if (!existing || existing.isDeleted) return null;
    if ((existing.references || []).includes(referenceTag)) return existing;

    return this.coordinator.upsertMediaAsset({
      ...existing,
      references: [...(existing.references || []), referenceTag],
      updatedAt: Date.now(),
    });
  }

  /**
   * Removes all reference tags matching `prefix` (e.g., `conv:conv-123` when deleting a conversation,
   * or `entity:gemini-4-argon` when resetting a companion).
   *
   * CRITICAL SAFETY INVARIANT:
   * - If other references remain on the asset (e.g., the image is also used as a profile avatar or in another conversation),
   *   the asset and its binary blob are PRESERVED intact.
   * - Only when `references.length === 0` is the unreferenced asset soft-deleted and its blob purged.
   */
  public async removeMediaReferencesByPrefix(prefix: string): Promise<{
    updatedAssets: string[];
    deletedUnreferencedAssets: string[];
  }> {
    const trimmedPrefix = (prefix || '').trim();
    if (!trimmedPrefix) return { updatedAssets: [], deletedUnreferencedAssets: [] };

    const uid = this.coordinator.getDomainState().uid || '__local_unauthenticated__';
    const assets = this.coordinator.getMediaAssets();
    const updatedAssets: string[] = [];
    const deletedUnreferencedAssets: string[] = [];

    for (const asset of assets) {
      const prevRefs = asset.references || [];
      const hadMatch = prevRefs.some((r) => r === trimmedPrefix || r.startsWith(`${trimmedPrefix}:`));
      if (!hadMatch) continue;

      const remainingRefs = prevRefs.filter(
        (r) => r !== trimmedPrefix && !r.startsWith(`${trimmedPrefix}:`)
      );

      if (remainingRefs.length > 0) {
        await this.coordinator.upsertMediaAsset({
          ...asset,
          references: remainingRefs,
          updatedAt: Date.now(),
        });
        updatedAssets.push(asset.id);
      } else {
        await this.coordinator.deleteMediaAssetRecord(asset.id);
        await this.coordinator.getVault().deleteMediaBlob(uid, asset.id);
        if (
          this.allowCloudStorage &&
          asset.storageBackend === 'firebase_storage' &&
          asset.storagePath &&
          uid !== '__local_unauthenticated__'
        ) {
          try {
            const storage = getStorage(firebaseApp);
            await deleteObject(storageRef(storage, asset.storagePath));
          } catch {
            // Ignore remote blob cleanup failure if offline
          }
        }
        deletedUnreferencedAssets.push(asset.id);
      }
    }

    return { updatedAssets, deletedUnreferencedAssets };
  }

  /**
   * Resolves a lightweight `mediaAssetId` (or fallback URL) into a displayable URL.
   */
  public async resolveMediaUrl(
    mediaAssetId?: string,
    fallbackUrl?: string
  ): Promise<string | null> {
    if (mediaAssetId) {
      const meta = this.coordinator.getMediaAsset(mediaAssetId);
      if (meta?.downloadUrl) {
        return meta.downloadUrl;
      }
      const uid = this.coordinator.getDomainState().uid || '__local_unauthenticated__';
      const localBlob = await this.coordinator.getVault().getMediaBlob(uid, mediaAssetId);
      if (localBlob?.dataUrl) {
        return localBlob.dataUrl;
      }
    }
    return fallbackUrl || null;
  }
}
