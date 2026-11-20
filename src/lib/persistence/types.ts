import {
  AppSettings,
  Conversation,
  ConversationSegmentSummary,
  Gift,
  JewelMetrics,
  MediaAssetRecord,
  Memory,
  Message,
  UserProfile,
} from '../types';
import { ModelEntity } from '../entitySystem';

export type MemoryScope = 'companion' | 'shared' | 'legacy';

export interface SyncClientCursor {
  clientId: string;
  lastAckedRevision: number;
  lastAckedTimestamp: number;
  lastSeenAt: number;
}

export interface ScopedMemory extends Memory {
  scope: MemoryScope;
  entityId?: string;
  revision?: number;
  lastSyncedRevision?: number;
  updatedAt?: number;
  isDeleted?: boolean;
  deletedAt?: number;
  deletedByClientId?: string;
}

export interface DurableConversationMeta extends Omit<Conversation, 'messages' | 'segmentSummaries'> {
  revision: number;
  lastSyncedRevision?: number;
  deletedMessageIds?: string[];
  previewMessages?: Message[];
  isDeleted?: boolean;
  deletedAt?: number;
  deletedByClientId?: string;
}

export interface DurableMessage extends Message {
  conversationId: string;
  revision: number;
  lastSyncedRevision?: number;
  isDeleted?: boolean;
  deletedAt?: number;
  deletedByClientId?: string;
}

export interface DurableGift extends Gift {
  revision: number;
  lastSyncedRevision?: number;
  isDeleted?: boolean;
  deletedAt?: number;
  deletedByClientId?: string;
}

export interface DurableCompanion extends ModelEntity {
  revision: number;
  lastSyncedRevision?: number;
  updatedAt: number;
  isDeleted?: boolean;
  deletedAt?: number;
  deletedByClientId?: string;
}

export interface UserScopedStateRecord {
  uid: string;
  clientId?: string;
  syncClients?: Record<string, SyncClientCursor>;
  settings: AppSettings;
  jewelMetrics: JewelMetrics;
  userProfile: UserProfile | null;
  activeConversationId: string | null;
  deletedConversationIds: string[];
  settingsRevision: number;
  jewelRevision: number;
  profileRevision: number;
  legacyLocalImported?: boolean;
  memoriesMigratedV2?: boolean;
  updatedAt: number;
}

export type MutationEntityType =
  | 'conversation'
  | 'message'
  | 'companion'
  | 'companion_memory'
  | 'companion_vault_asset'
  | 'shared_memory'
  | 'shared_vault_asset'
  | 'gift'
  | 'media_asset'
  | 'conversation_summary'
  | 'settings'
  | 'jewel'
  | 'profile';

export type MutationOperation = 'upsert' | 'delete';

export type MutationCommitStatus = 'pending' | 'in_flight' | 'committed' | 'failed';

export interface MutationRecord {
  mutationId: string;
  idempotencyKey: string;
  uid: string;
  sequence: number;
  entityType: MutationEntityType;
  entityId: string;
  parentId?: string; // conversationId for messages/summaries, companionId for companion_memory
  operation: MutationOperation;
  payload: any;
  revision: number;
  clientTimestamp: number;
  status: MutationCommitStatus;
  attempts: number;
  nextRetryAt: number;
  lastError?: string;
  errorClassification?: 'transient' | 'permanent_policy';
}

export type SyncPhase = 'idle' | 'hydrating' | 'synced' | 'syncing' | 'offline' | 'error';

export interface SyncStatusSnapshot {
  uid: string | null;
  phase: SyncPhase;
  isOnline: boolean;
  isHydrated: boolean;
  isCloudHydrated: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}

export interface HydratedVaultState {
  userState: UserScopedStateRecord | null;
  conversations: DurableConversationMeta[];
  messagesByConversation: Record<string, DurableMessage[]>;
  summariesByConversation?: Record<string, ConversationSegmentSummary[]>;
  companions: Record<string, DurableCompanion>;
  companionMemories: Record<string, ScopedMemory[]>;
  sharedMemories: ScopedMemory[];
  gifts: DurableGift[];
  mediaAssets?: MediaAssetRecord[];
  pendingMutations: MutationRecord[];
}

export interface CloudRemoteSnapshot {
  settings?: AppSettings;
  settingsRevision?: number;
  jewelMetrics?: JewelMetrics;
  jewelRevision?: number;
  userProfile?: UserProfile | null;
  profileRevision?: number;
  memoriesMigratedV2?: boolean;
  syncClients?: Record<string, SyncClientCursor>;
  conversations?: {
    meta: DurableConversationMeta;
    previewMessages: Message[];
  }[];
  conversationMessages?: {
    conversationId: string;
    messages: DurableMessage[];
  };
  conversationSummaries?: {
    conversationId: string;
    summaries: ConversationSegmentSummary[];
  };
  companions?: Record<string, DurableCompanion>;
  companionMemories?: {
    companionId: string;
    memories: ScopedMemory[];
  };
  sharedMemories?: ScopedMemory[];
  gifts?: DurableGift[];
  mediaAssets?: MediaAssetRecord[];
  legacyMonolithicData?: {
    settings?: AppSettings;
    jewelMetrics?: JewelMetrics;
    userProfile?: UserProfile;
    conversations?: Conversation[];
    gifts?: Gift[];
    migratedToGranular?: boolean;
  };
}

export interface CloudPersistenceAdapter {
  subscribeUser(
    uid: string,
    email: string | null | undefined,
    onRemoteUpdate: (update: CloudRemoteSnapshot) => void,
    onError: (err: Error) => void
  ): () => void;

  executeMutation(
    uid: string,
    mutation: MutationRecord,
    context: {
      conversationMeta?: DurableConversationMeta;
      conversationMessages?: DurableMessage[];
    }
  ): Promise<void>;
}

export interface SanctuaryBackupManifest {
  conversations: number;
  messages: number;
  companions: number;
  privateMemories: number;
  sharedMemories: number;
  legacyMemories: number;
  gifts: number;
  stickers: number;
  segmentSummaries?: number;
  mediaAssets?: number;
}

export interface SanctuaryBackupData {
  settings: AppSettings;
  jewelMetrics: JewelMetrics;
  userProfile: UserProfile | null;
  conversations: Conversation[];
  companions: Record<string, ModelEntity>;
  companionMemories: Record<string, ScopedMemory[]>;
  sharedMemories: ScopedMemory[];
  legacyMemories: ScopedMemory[];
  gifts: Gift[];
  conversationSummaries?: Record<string, ConversationSegmentSummary[]>;
  mediaAssets?: MediaAssetRecord[];
}

export interface SanctuaryBackupEnvelope {
  format: 'midnight-sanctuary-backup';
  schemaVersion: 2 | 3;
  appVersion: string;
  exportedAt: string;
  exportedTimestamp: number;
  checksum: string;
  manifest: SanctuaryBackupManifest;
  data: SanctuaryBackupData;
}

export interface ValidatedBackupPreview {
  valid: boolean;
  schemaVersionDetected: number;
  checksumVerified: boolean;
  exportedAt: string | null;
  manifest: SanctuaryBackupManifest;
  warnings: string[];
  errors: string[];
  envelope?: SanctuaryBackupEnvelope;
}
