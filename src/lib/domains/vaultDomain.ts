import { v4 as uuidv4 } from 'uuid';
import { SanctuaryVaultItem, SanctuaryVaultReaction, MediaAssetRecord } from '../types';
import { getModelEntity, ModelEntity } from '../entitySystem';
import { ensureValidDocId } from '../persistenceSystem';
import { PRIMARY_SOVEREIGN_ENTITY_IDS, resolveCanonicalEntityId } from './entityDomain';

export interface VaultCallerContext {
  role: 'user' | 'companion';
  entityId?: string;
}

export class VaultAccessDeniedError extends Error {
  public readonly code = 'VAULT_ACCESS_DENIED';
  public readonly scope: 'private' | 'shared';
  public readonly targetOwnerEntityId?: string;
  public readonly callerRole: 'user' | 'companion';
  public readonly callerEntityId?: string;
  public readonly operation: 'create' | 'read' | 'update' | 'delete';

  constructor(params: {
    message: string;
    scope: 'private' | 'shared';
    targetOwnerEntityId?: string;
    callerRole: 'user' | 'companion';
    callerEntityId?: string;
    operation: 'create' | 'read' | 'update' | 'delete';
  }) {
    super(params.message);
    this.name = 'VaultAccessDeniedError';
    this.scope = params.scope;
    this.targetOwnerEntityId = params.targetOwnerEntityId;
    this.callerRole = params.callerRole;
    this.callerEntityId = params.callerEntityId;
    this.operation = params.operation;
  }
}

export interface VaultCollectionPathDescriptor {
  scope: 'private' | 'shared';
  canonicalOwnerEntityId?: string;
  collectionPath: string;
  documentPath: string;
  fieldPath: string;
  storagePrefix: string;
}

/**
 * Resolves the authoritative Firestore collection/document paths and Storage prefix for a Vault scope.
 * - Private Model-User Vault: `users/{uid}/companions/{canonicalEntityId}` (`roomDecor.privateVaultItems`)
 * - Shared Sanctuary Vault: `users/{uid}/settings/app` (`settings.sharedVaultItems`)
 */
export function resolveVaultCollectionPath(
  uid: string,
  scope: 'private' | 'shared',
  ownerEntityId?: string,
  caller?: VaultCallerContext
): VaultCollectionPathDescriptor {
  const safeUid = ensureValidDocId(uid || 'anonymous_local_vault', 'user');

  if (caller) {
    assertAuthorizedVaultAccess({
      scope,
      targetOwnerEntityId: ownerEntityId,
      caller,
      operation: 'read',
    });
  }

  if (scope === 'private') {
    const canonicalOwner = resolveCanonicalEntityId(ownerEntityId);
    if (!canonicalOwner) {
      throw new VaultAccessDeniedError({
        message: 'Private vault path requires a valid ownerEntityId.',
        scope: 'private',
        targetOwnerEntityId: ownerEntityId,
        callerRole: caller?.role || 'user',
        callerEntityId: caller?.entityId,
        operation: 'read',
      });
    }
    const safeCompId = ensureValidDocId(canonicalOwner, 'companion');
    return {
      scope: 'private',
      canonicalOwnerEntityId: canonicalOwner,
      collectionPath: `users/${safeUid}/companions/${safeCompId}/vault`,
      documentPath: `users/${safeUid}/companions/${safeCompId}`,
      fieldPath: 'roomDecor.privateVaultItems',
      storagePrefix: `users/${safeUid}/vault/private/${safeCompId}`,
    };
  }

  return {
    scope: 'shared',
    collectionPath: `users/${safeUid}/sharedVault`,
    documentPath: `users/${safeUid}/settings/app`,
    fieldPath: 'settings.sharedVaultItems',
    storagePrefix: `users/${safeUid}/vault/shared`,
  };
}

/**
 * Strictly enforces sovereign vault access control:
 * - For `scope === 'private'`: ONLY the authenticated user (`role === 'user'`) OR the exact
 *   canonical owner entity (`role === 'companion' && canonicalCaller === canonicalOwner`) may access the path.
 *   Any other entity attempting to create, read, update, or delete on a private path throws `VaultAccessDeniedError`.
 * - For `scope === 'shared'`: Both the user and any sovereign companion entity have access.
 */
export function assertAuthorizedVaultAccess(params: {
  scope: 'private' | 'shared';
  targetOwnerEntityId?: string;
  caller?: VaultCallerContext;
  operation: 'create' | 'read' | 'update' | 'delete';
}): { authorized: true; canonicalOwnerEntityId?: string; canonicalCallerEntityId?: string } {
  const caller: VaultCallerContext = params.caller || { role: 'user' };
  const canonicalOwner = params.targetOwnerEntityId
    ? resolveCanonicalEntityId(params.targetOwnerEntityId)
    : undefined;
  const canonicalCaller = caller.entityId
    ? resolveCanonicalEntityId(caller.entityId)
    : undefined;

  if (params.scope === 'private') {
    if (!canonicalOwner) {
      throw new VaultAccessDeniedError({
        message: `Access denied: Private vault ${params.operation} requires a valid ownerEntityId.`,
        scope: 'private',
        targetOwnerEntityId: params.targetOwnerEntityId,
        callerRole: caller.role,
        callerEntityId: caller.entityId,
        operation: params.operation,
      });
    }

    if (caller.role === 'companion') {
      if (!canonicalCaller || canonicalCaller !== canonicalOwner) {
        throw new VaultAccessDeniedError({
          message: `Access denied: Entity "${canonicalCaller || caller.entityId || 'unknown'}" is not authorized to ${params.operation} private vault path for "${canonicalOwner}".`,
          scope: 'private',
          targetOwnerEntityId: canonicalOwner,
          callerRole: 'companion',
          callerEntityId: canonicalCaller || caller.entityId,
          operation: params.operation,
        });
      }
    }

    return {
      authorized: true,
      canonicalOwnerEntityId: canonicalOwner,
      canonicalCallerEntityId: canonicalCaller,
    };
  }

  // Shared Sanctuary scope
  if (caller.role === 'companion' && !canonicalCaller) {
    throw new VaultAccessDeniedError({
      message: `Access denied: Unrecognized companion entity "${caller.entityId || 'unknown'}" cannot ${params.operation} Shared Sanctuary Vault.`,
      scope: 'shared',
      callerRole: 'companion',
      callerEntityId: caller.entityId,
      operation: params.operation,
    });
  }

  return {
    authorized: true,
    canonicalOwnerEntityId: canonicalOwner,
    canonicalCallerEntityId: canonicalCaller,
  };
}

/**
 * Boolean check helper around `assertAuthorizedVaultAccess`.
 */
export function canAccessVaultPath(params: {
  scope: 'private' | 'shared';
  targetOwnerEntityId?: string;
  caller: VaultCallerContext;
  operation?: 'create' | 'read' | 'update' | 'delete';
}): boolean {
  try {
    assertAuthorizedVaultAccess({
      scope: params.scope,
      targetOwnerEntityId: params.targetOwnerEntityId,
      caller: params.caller,
      operation: params.operation || 'read',
    });
    return true;
  } catch {
    return false;
  }
}

export type CreateVaultAssetInput = Omit<
  SanctuaryVaultItem,
  'id' | 'createdAt' | 'updatedAt' | 'companionReactions'
> & {
  id?: string;
  companionReactions?: SanctuaryVaultReaction[];
  createdAt?: number;
  updatedAt?: number;
};

export type UpdateVaultAssetInput = Partial<
  Pick<
    SanctuaryVaultItem,
    | 'title'
    | 'caption'
    | 'mediaDigest'
    | 'acousticTranscript'
    | 'textContent'
    | 'posterDataUrl'
    | 'downloadUrl'
    | 'geminiFileUri'
    | 'geminiFileExpiresAt'
    | 'keyframes'
    | 'durationSec'
    | 'byteSize'
  >
>;

export interface VaultStateSlice {
  /** Map of canonical entity ID -> active Private Model-User Vault items */
  privateFoldersByEntity: Record<string, SanctuaryVaultItem[]>;
  /** Active common items in the Shared Sanctuary folder */
  sharedSanctuaryItems: SanctuaryVaultItem[];
  /** Deduplicated binary media asset records in Firestore / IndexedDB */
  mediaAssets: MediaAssetRecord[];
  /** Resolves the Firestore collection/document path descriptor for a Private or Shared folder */
  getCollectionPath: (
    scope: 'private' | 'shared',
    ownerEntityId?: string,
    caller?: VaultCallerContext
  ) => VaultCollectionPathDescriptor;
  /** Checks whether a caller (user or specific companion entity) is authorized for a vault folder */
  canAccess: (params: {
    scope: 'private' | 'shared';
    targetOwnerEntityId?: string;
    caller: VaultCallerContext;
    operation?: 'create' | 'read' | 'update' | 'delete';
  }) => boolean;
  /** CRUD Create: Adds a new asset to a Private Model-User folder or the Shared Sanctuary folder */
  createAsset: (
    input: CreateVaultAssetInput,
    caller?: VaultCallerContext
  ) => SanctuaryVaultItem;
  /** CRUD Read (List): Returns assets for a Private or Shared folder after verifying caller authorization */
  readAssets: (params: {
    scope: 'private' | 'shared';
    ownerEntityId?: string;
    caller?: VaultCallerContext;
  }) => SanctuaryVaultItem[];
  /** CRUD Read (Single): Finds a specific asset by ID after verifying caller authorization */
  getAssetById: (
    itemId: string,
    options?: {
      scope?: 'private' | 'shared';
      ownerEntityId?: string;
      caller?: VaultCallerContext;
    }
  ) => SanctuaryVaultItem | null;
  /** CRUD Update: Updates title, caption, mediaDigest, transcript, or URI metadata on an authorized asset */
  updateAsset: (
    itemId: string,
    updates: UpdateVaultAssetInput,
    options: {
      scope: 'private' | 'shared';
      ownerEntityId?: string;
      caller?: VaultCallerContext;
    }
  ) => SanctuaryVaultItem | null;
  /** CRUD Delete: Removes an asset from its Private or Shared Firestore path after verifying authorization */
  deleteAsset: (params: {
    scope: 'private' | 'shared';
    itemId: string;
    ownerEntityId?: string;
    caller?: VaultCallerContext;
  }) => boolean;
  /** Promotes (copies) an authorized Private Model-User asset into the Shared Sanctuary folder */
  promoteToShared: (
    ownerEntityId: string,
    itemId: string,
    caller?: VaultCallerContext
  ) => SanctuaryVaultItem | null;
  /** Appends an attributed companion reaction note to a Shared or Private asset */
  addReaction: (
    itemId: string,
    reaction: {
      entityId: string;
      displayName?: string;
      avatarEmoji?: string;
      note: string;
    },
    caller?: VaultCallerContext
  ) => void;
}

/**
 * Builds the `privateFoldersByEntity` map across all primary sovereign entities and any custom entities.
 */
export function buildPrivateFoldersByEntityMap(
  customEntities?: Record<string, Partial<ModelEntity>>
): Record<string, SanctuaryVaultItem[]> {
  const result: Record<string, SanctuaryVaultItem[]> = {};
  const entityKeys = new Set<string>([
    ...PRIMARY_SOVEREIGN_ENTITY_IDS,
    ...Object.keys(customEntities || {}),
  ]);

  for (const rawKey of entityKeys) {
    const canonicalId = resolveCanonicalEntityId(rawKey);
    if (!canonicalId) continue;
    const entity = getModelEntity(
      canonicalId,
      customEntities as Record<string, ModelEntity> | undefined
    );
    const items = (entity.roomDecor?.privateVaultItems || [])
      .filter((item) => item && !item.isDeleted)
      .map((item) => ({
        ...item,
        scope: 'private' as const,
        ownerEntityId: canonicalId,
      }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    result[canonicalId] = items;
  }

  return result;
}

/**
 * Creates a normalized `SanctuaryVaultItem` record ready for persistence.
 */
export function buildNormalizedVaultAsset(
  input: CreateVaultAssetInput,
  canonicalOwnerEntityId?: string
): SanctuaryVaultItem {
  const now = Date.now();
  const safeId = ensureValidDocId(input.id || `vault-${uuidv4()}`, 'vault');
  return {
    ...input,
    id: safeId,
    scope: input.scope,
    ownerEntityId: input.scope === 'private' ? canonicalOwnerEntityId : input.ownerEntityId,
    companionReactions: Array.isArray(input.companionReactions)
      ? input.companionReactions
      : [],
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    isDeleted: false,
  };
}
