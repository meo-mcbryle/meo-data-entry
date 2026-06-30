import Dexie, { type Table } from 'dexie';

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

class MEODexieDatabase extends Dexie {
  nodes!: Table<LocalNode, string>;
  sync_queue!: Table<SyncQueueItem, number>;
  audit_logs!: Table<LocalAuditLog, string>;

  constructor() {
    super('MEODexieDatabase');
    
    // Schema definitions. Only index columns we need to search or filter on.
    this.version(1).stores({
      nodes: 'id, parent_id, name, type, is_deleted, updated_at',
      sync_queue: '++id, table, operation, record_id, timestamp',
      audit_logs: 'id, node_id, action, created_at'
    });
  }
}

export const db = new MEODexieDatabase();

// Database Helper Utilities
export const LocalDB = {
  // Nodes mutations
  async getNodes(): Promise<LocalNode[]> {
    return await db.nodes.toArray();
  },

  async getNode(id: string): Promise<LocalNode | undefined> {
    return await db.nodes.get(id);
  },

  async saveNode(node: LocalNode, bypassSyncQueue = false): Promise<void> {
    await db.nodes.put(node);
    
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
    await db.nodes.add(node);

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
    const node = await db.nodes.get(id);
    if (!node) return;

    // Soft delete locally
    node.is_deleted = true;
    node.deleted_at = new Date().toISOString();
    node.deleted_by = email;
    node.updated_at = new Date().toISOString();
    node.version += 1;

    await db.nodes.put(node);

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
    // If there is already a queue item for this record_id, handle consolidation
    if (operation === 'UPDATE') {
      const existing = await db.sync_queue
        .where({ record_id })
        .and(item => item.operation === 'UPDATE' || item.operation === 'INSERT')
        .first();

      if (existing) {
        // Merge payloads
        existing.payload = { ...existing.payload, ...payload };
        existing.timestamp = new Date().toISOString();
        await db.sync_queue.put(existing);
        return;
      }
    }

    await db.sync_queue.add({
      table,
      operation,
      record_id,
      payload,
      timestamp: new Date().toISOString()
    });
  },

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return await db.sync_queue.toArray();
  },

  async clearSyncQueueItem(id: number): Promise<void> {
    await db.sync_queue.delete(id);
  },

  async clearDatabase(): Promise<void> {
    await db.nodes.clear();
    await db.sync_queue.clear();
    await db.audit_logs.clear();
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
