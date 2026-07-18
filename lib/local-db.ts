import Dexie, { type Table } from 'dexie';
import { getDbEncryptionKey, encryptData, decryptData } from './crypto-utils';

export interface LocalNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parent_id: string | null;
  content?: any;
  display_settings?: any;
  created_at: string;
  size_bytes?: number;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  updated_at: string; // Used for conflict resolution
  version: number;    // Revision token
  last_synced_hash?: string;
}

export interface SyncQueueItem {
  id?: number;
  table: 'nodes' | 'audit_logs';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  payload: any;
  timestamp: string;
}

export interface LocalAuditLog {
  id: string;
  user_email: string;
  action: string;
  node_id: string | null;
  details?: any;
  created_at: string;
}

export interface LocalAttachment {
  path: string;
  blob: Blob;
  synced: number; // 0 = unsynced, 1 = synced
  name: string;
  type: 'image' | 'file';
  size: number;
  contentType: string;
}

class MEODexieDatabase extends Dexie {
  nodes!: Table<LocalNode, string>;
  sync_queue!: Table<SyncQueueItem, number>;
  audit_logs!: Table<LocalAuditLog, string>;
  attachments!: Table<LocalAttachment, string>;

  constructor() {
    super('MEODexieDatabase');

    // Schema definitions. Only index columns we need to search or filter on.
    this.version(1).stores({
      nodes: 'id, parent_id, name, type, is_deleted, updated_at',
      sync_queue: '++id, table, operation, record_id, timestamp',
      audit_logs: 'id, node_id, action, created_at'
    });

    this.version(2).stores({
      nodes: 'id, parent_id, name, type, is_deleted, updated_at',
      sync_queue: '++id, table, operation, record_id, timestamp',
      audit_logs: 'id, node_id, action, created_at',
      attachments: 'path, synced'
    });
  }
}

export const db = new MEODexieDatabase();

// Database Helper Utilities
export const LocalDB = {
  // Nodes mutations
  async getNodes(): Promise<LocalNode[]> {
    const nodes = await db.nodes.toArray();
    const key = await getDbEncryptionKey();
    return await Promise.all(nodes.map(async node => ({
      ...node,
      content: node.content ? await decryptData(node.content, key) : undefined,
      display_settings: node.display_settings ? await decryptData(node.display_settings, key) : undefined,
    })));
  },

  async getNode(id: string): Promise<LocalNode | undefined> {
    const node = await db.nodes.get(id);
    if (!node) return undefined;
    const key = await getDbEncryptionKey();
    return {
      ...node,
      content: node.content ? await decryptData(node.content, key) : undefined,
      display_settings: node.display_settings ? await decryptData(node.display_settings, key) : undefined,
    };
  },

  async saveNode(node: LocalNode, bypassSyncQueue = false): Promise<void> {
    const key = await getDbEncryptionKey();
    const encryptedNode = {
      ...node,
      content: node.content ? await encryptData(node.content, key) : undefined,
      display_settings: node.display_settings ? await encryptData(node.display_settings, key) : undefined,
    };
    await db.nodes.put(encryptedNode);

    if (!bypassSyncQueue) {
      await this.queueSync('nodes', 'UPDATE', node.id, {
        id: node.id,
        name: node.name,
        type: node.type,
        parent_id: node.parent_id,
        content: node.content,
        display_settings: node.display_settings,
        created_at: node.created_at,
        size_bytes: node.size_bytes,
        is_deleted: node.is_deleted,
        deleted_at: node.deleted_at,
        deleted_by: node.deleted_by,
        updated_at: node.updated_at,
        version: node.version,
        last_synced_hash: node.last_synced_hash
      });
    }
  },

  async insertNode(node: LocalNode, bypassSyncQueue = false): Promise<void> {
    const key = await getDbEncryptionKey();
    const encryptedNode = {
      ...node,
      content: node.content ? await encryptData(node.content, key) : undefined,
      display_settings: node.display_settings ? await encryptData(node.display_settings, key) : undefined,
    };
    await db.nodes.add(encryptedNode);

    if (!bypassSyncQueue) {
      await this.queueSync('nodes', 'INSERT', node.id, {
        id: node.id,
        name: node.name,
        type: node.type,
        parent_id: node.parent_id,
        created_at: node.created_at,
        updated_at: node.updated_at,
        version: node.version
      });
    }
  },

  async deleteNode(id: string, email: string | null = null, bypassSyncQueue = false): Promise<void> {
    const node = await this.getNode(id);
    if (!node) return;

    // Soft delete locally
    node.is_deleted = true;
    node.deleted_at = new Date().toISOString();
    node.deleted_by = email;
    node.updated_at = new Date().toISOString();
    node.version += 1;

    const key = await getDbEncryptionKey();
    const encryptedNode = {
      ...node,
      content: node.content ? await encryptData(node.content, key) : undefined,
      display_settings: node.display_settings ? await encryptData(node.display_settings, key) : undefined,
    };
    await db.nodes.put(encryptedNode);

    if (!bypassSyncQueue) {
      await this.queueSync('nodes', 'UPDATE', id, {
        is_deleted: true,
        deleted_at: node.deleted_at,
        deleted_by: node.deleted_by,
        updated_at: node.updated_at,
        version: node.version
      });
    }
  },

  async hardDeleteNode(id: string, bypassSyncQueue = false): Promise<void> {
    await db.nodes.delete(id);

    if (!bypassSyncQueue) {
      await this.queueSync('nodes', 'DELETE', id, null);
    }
  },

  // Audit log mutation
  async addAuditLog(log: LocalAuditLog, bypassSyncQueue = false): Promise<void> {
    await db.audit_logs.add(log);

    if (!bypassSyncQueue) {
      await this.queueSync('audit_logs', 'INSERT', log.id, log);
    }
  },

  async getAuditLogs(): Promise<LocalAuditLog[]> {
    return await db.audit_logs.orderBy('created_at').reverse().toArray();
  },

  // Sync Queue management
  async queueSync(table: 'nodes' | 'audit_logs', operation: 'INSERT' | 'UPDATE' | 'DELETE', record_id: string, payload: any): Promise<void> {
    const key = await getDbEncryptionKey();
    // If there is already a queue item for this record_id, handle consolidation
    if (operation === 'UPDATE') {
      const existing = await db.sync_queue
        .where({ record_id })
        .and(item => item.operation === 'UPDATE' || item.operation === 'INSERT')
        .first();

      if (existing) {
        // Decrypt the existing payload to merge it properly
        const decryptedExisting = existing.payload ? await decryptData(existing.payload, key) : {};
        const mergedPayload = { ...decryptedExisting, ...payload };
        
        existing.payload = await encryptData(mergedPayload, key);
        existing.timestamp = new Date().toISOString();
        await db.sync_queue.put(existing);
        return;
      }
    }

    const encryptedPayload = payload ? await encryptData(payload, key) : null;
    await db.sync_queue.add({
      table,
      operation,
      record_id,
      payload: encryptedPayload,
      timestamp: new Date().toISOString()
    });
  },

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const items = await db.sync_queue.toArray();
    const key = await getDbEncryptionKey();
    return await Promise.all(items.map(async item => ({
      ...item,
      payload: item.payload ? await decryptData(item.payload, key) : null
    })));
  },

  async clearSyncQueueItem(id: number): Promise<void> {
    await db.sync_queue.delete(id);
  },

  async saveNodesBulk(nodes: LocalNode[], bypassSyncQueue = false): Promise<void> {
    const key = await getDbEncryptionKey();
    const encryptedNodes = await Promise.all(nodes.map(async node => ({
      ...node,
      content: node.content ? await encryptData(node.content, key) : undefined,
      display_settings: node.display_settings ? await encryptData(node.display_settings, key) : undefined,
    })));
    await db.nodes.bulkPut(encryptedNodes);

    if (!bypassSyncQueue) {
      const syncItems = await Promise.all(nodes.map(async node => {
        const payload = {
          id: node.id,
          name: node.name,
          type: node.type,
          parent_id: node.parent_id,
          content: node.content,
          display_settings: node.display_settings,
          created_at: node.created_at,
          size_bytes: node.size_bytes,
          is_deleted: node.is_deleted,
          deleted_at: node.deleted_at,
          deleted_by: node.deleted_by,
          updated_at: node.updated_at,
          version: node.version,
          last_synced_hash: node.last_synced_hash
        };
        return {
          table: 'nodes' as const,
          operation: 'UPDATE' as const,
          record_id: node.id,
          payload: await encryptData(payload, key),
          timestamp: new Date().toISOString()
        };
      }));
      await db.sync_queue.bulkAdd(syncItems);
    }
  },

  async clearDatabase(): Promise<void> {
    await db.nodes.clear();
    await db.sync_queue.clear();
    await db.audit_logs.clear();
    await db.attachments.clear();
  },

  // Attachment Mutations
  async getAttachment(path: string): Promise<LocalAttachment | undefined> {
    return await db.attachments.get(path);
  },

  async saveAttachment(attachment: LocalAttachment): Promise<void> {
    await db.attachments.put(attachment);
  },

  async deleteAttachment(path: string): Promise<void> {
    await db.attachments.delete(path);
  },

  async getUnsyncedAttachments(): Promise<LocalAttachment[]> {
    return await db.attachments.where({ synced: 0 }).toArray();
  }
};

// Request storage persistence on load to prevent IndexedDB cleanup by OS/browsers
if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((persistent) => {
    if (persistent) {
      console.log("IndexedDB persistence status: SECURED.");
    } else {
      console.warn("IndexedDB persistence status: EPHEMERAL. Keep online backups.");
    }
  }).catch((err) => {
    console.error("Failed to request storage persistence:", err);
  });
}
