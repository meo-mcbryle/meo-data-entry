import { supabase } from './supabase';
import { db, LocalDB, type LocalNode, type SyncQueueItem } from './local-db';

export interface SyncConflict {
  nodeId: string;
  name: string;
  localNode: LocalNode;
  remoteNode: any;
}

// Compute hash of a node's content + display_settings to track changes
const getHash = (node: any): string => {
  if (!node) return '';
  const contentStr = JSON.stringify(node.content || []);
  const displayStr = JSON.stringify(node.display_settings || {});
  return `${contentStr}|${displayStr}`;
};

// Clean payload of client-side only parameters before sending to Supabase
const cleanPayload = (payload: any) => {
  if (!payload) return null;
  const { version, updated_at, last_synced_hash, ...rest } = payload;
  return rest;
};

export const SyncService = {
  // Pulls latest remote nodes metadata and updates the local IndexedDB cache
  async pullRemoteUpdates(): Promise<void> {
    const { data: remoteNodes, error } = await supabase
      .from('nodes')
      .select('id, name, type, parent_id, created_at, size_bytes, is_deleted, deleted_at, deleted_by');

    if (error) {
      throw new Error(`Failed to fetch latest remote nodes: ${error.message}`);
    }

    if (remoteNodes) {
      const queue = await LocalDB.getSyncQueue();
      const unsyncedIds = new Set(queue.map(item => item.record_id));

      const localNodes = await LocalDB.getNodes();
      const localNodesMap = new Map(localNodes.map(n => [n.id, n]));
      const nodesToSave: any[] = [];

      for (const remote of remoteNodes) {
        if (!unsyncedIds.has(remote.id)) {
          const existing = localNodesMap.get(remote.id);
          nodesToSave.push({
            ...existing,
            id: remote.id,
            name: remote.name,
            type: remote.type,
            parent_id: remote.parent_id,
            created_at: remote.created_at,
            size_bytes: remote.size_bytes,
            is_deleted: remote.is_deleted,
            deleted_at: remote.deleted_at,
            deleted_by: remote.deleted_by,
            updated_at: new Date().toISOString(),
            version: existing?.version || 1,
            last_synced_hash: existing?.last_synced_hash || ''
          });
        }
      }

      if (nodesToSave.length > 0) {
        await LocalDB.saveNodesBulk(nodesToSave, true); // bypassSyncQueue = true
      }
    }
  },

  // Checks local vs remote and returns conflicts
  async checkSyncState(): Promise<{ conflicts: SyncConflict[]; queueLength: number }> {
    const queue = await LocalDB.getSyncQueue();
    const localNodes = await LocalDB.getNodes();
    
    // Fetch all remote nodes from Supabase (excluding version/updated_at fields which may not exist)
    const { data: remoteNodes, error } = await supabase
      .from('nodes')
      .select('id, name, type, parent_id, content, display_settings, created_at, size_bytes, is_deleted, deleted_at, deleted_by');

    if (error) {
      console.error("Failed to query remote nodes for sync state check:", error.message);
      return { conflicts: [], queueLength: queue.length };
    }

    const conflicts: SyncConflict[] = [];
    const remoteNodeMap = new Map(remoteNodes.map((n: any) => [n.id, n]));
    const localQueueMap = new Map(queue.map(item => [item.record_id, item]));

    // Find conflicts
    for (const local of localNodes) {
      const remote = remoteNodeMap.get(local.id);
      
      if (remote) {
        const hasLocalChangesPending = localQueueMap.has(local.id);
        const remoteHash = getHash(remote);

        // If we have local changes pending, AND the server content does not match what we originally synced from
        if (hasLocalChangesPending && local.last_synced_hash && local.last_synced_hash !== remoteHash) {
          conflicts.push({
            nodeId: local.id,
            name: local.name,
            localNode: local,
            remoteNode: remote
          });
        }
      }
    }

    return { conflicts, queueLength: queue.length };
  },

  // Resolve conflict by choosing local or remote
  async resolveConflict(nodeId: string, resolution: 'keep_local' | 'use_server'): Promise<void> {
    if (resolution === 'use_server') {
      // Fetch server copy
      const { data: remote, error } = await supabase
        .from('nodes')
        .select('id, name, type, parent_id, content, display_settings, created_at, size_bytes, is_deleted, deleted_at, deleted_by')
        .eq('id', nodeId)
        .single();
      
      if (error) {
        throw new Error(`Failed to fetch server node during conflict resolution: ${error.message}`);
      }

      if (remote) {
        const remoteHash = getHash(remote);
        // Save server node locally and overwrite local change
        await LocalDB.saveNode({
          id: remote.id,
          name: remote.name,
          type: remote.type,
          parent_id: remote.parent_id,
          content: remote.content,
          display_settings: remote.display_settings,
          created_at: remote.created_at,
          size_bytes: remote.size_bytes,
          is_deleted: remote.is_deleted,
          deleted_at: remote.deleted_at,
          deleted_by: remote.deleted_by,
          updated_at: new Date().toISOString(),
          version: 1,
          last_synced_hash: remoteHash
        }, true); // bypassSyncQueue = true

        // Delete from sync queue
        await db.sync_queue.where({ record_id: nodeId }).delete();
      }
    } else {
      // resolution === 'keep_local': we keep our queue item.
      // We set our local node's last_synced_hash to match the server's current hash
      // to denote that we are aware of the server's version and choose to overwrite it.
      const local = await LocalDB.getNode(nodeId);
      const { data: remote } = await supabase
        .from('nodes')
        .select('content, display_settings')
        .eq('id', nodeId)
        .single();
      
      if (local && remote) {
        local.last_synced_hash = getHash(remote);
        local.updated_at = new Date().toISOString();
        await LocalDB.saveNode(local, true); // save locally, keep queue item
      }
    }
  },

  // Synchronizes all offline attachments to Supabase Storage
  async syncAttachments(): Promise<void> {
    const unsynced = await LocalDB.getUnsyncedAttachments();
    for (const att of unsynced) {
      try {
        // 1. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(att.path, att.blob, {
            contentType: att.contentType,
            upsert: true
          });

        if (uploadError) throw uploadError;

        // 2. Get remote public URL
        const { data } = supabase.storage
          .from('attachments')
          .getPublicUrl(att.path);
        
        const publicUrl = data.publicUrl;

        // 3. Mark as synced in Dexie
        att.synced = 1;
        await LocalDB.saveAttachment(att);

        // 4. Update local node metadata references
        const localNodes = await LocalDB.getNodes();
        for (const node of localNodes) {
          if (node.type === 'file' && node.display_settings?.cellMetadata) {
            let nodeChanged = false;
            const cellMetadata = { ...node.display_settings.cellMetadata };

            Object.keys(cellMetadata).forEach(key => {
              const cell = cellMetadata[key];
              if (cell.attachments) {
                cell.attachments = cell.attachments.map((a: any) => {
                  if (a.path === att.path && a.isOffline) {
                    nodeChanged = true;
                    return {
                      ...a,
                      url: publicUrl,
                      isOffline: false
                    };
                  }
                  return a;
                });
              }
            });

            if (nodeChanged) {
              node.display_settings = {
                ...node.display_settings,
                cellMetadata
              };
              node.updated_at = new Date().toISOString();
              // Save local node and update sync queue item so when the sync replays,
              // it contains the synced public URL payload
              await LocalDB.saveNode(node);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to sync attachment at ${att.path}:`, err);
      }
    }
  },

  // Performs the sync execution
  async performSync(onProgress?: (progress: number) => void): Promise<void> {
    // Sync attachments first so the queue contains remote URLs when read
    await this.syncAttachments();

    const queue = await LocalDB.getSyncQueue();
    const totalItems = queue.length;
    let completedItems = 0;

    const reportProgress = () => {
      if (onProgress && totalItems > 0) {
        onProgress(Math.floor((completedItems / totalItems) * 100));
      }
    };

    reportProgress();

    // Replay queue mutations to Supabase
    for (const item of queue) {
      try {
        const payload = cleanPayload(item.payload);
        if (item.table === 'nodes') {
          if (item.operation === 'INSERT') {
            const { error } = await supabase.from('nodes').insert([payload]);
            if (error) {
              if (error.code === '23503' && payload && payload.parent_id) {
                console.warn(`Foreign key violation on insert (parent deleted). Retrying with parent_id = null.`);
                const repaired = { ...payload, parent_id: null };
                const { error: retryError } = await supabase.from('nodes').insert([repaired]);
                if (retryError) throw retryError;
              } else {
                throw error;
              }
            }
          } else if (item.operation === 'UPDATE') {
            const { error } = await supabase.from('nodes').update(payload).eq('id', item.record_id);
            if (error) {
              if (error.code === '23503' && payload && payload.parent_id) {
                console.warn(`Foreign key violation on update (parent deleted). Retrying with parent_id = null.`);
                const repaired = { ...payload, parent_id: null };
                const { error: retryError } = await supabase.from('nodes').update(repaired).eq('id', item.record_id);
                if (retryError) throw retryError;
              } else {
                throw error;
              }
            }
          } else if (item.operation === 'DELETE') {
            const { error } = await supabase.from('nodes').delete().eq('id', item.record_id);
            if (error) throw error;
          }
        } else if (item.table === 'audit_logs') {
          if (item.operation === 'INSERT') {
            await supabase.from('audit_logs').insert([payload]);
          }
        }

        // Clear item from sync queue
        if (item.id !== undefined) {
          await LocalDB.clearSyncQueueItem(item.id);
        }
      } catch (err) {
        console.error(`Sync error on queue item ID ${item.id}:`, err);
      }
      
      completedItems++;
      reportProgress();
    }

    // Pull down new updates from Supabase to refresh our local storage
    const { data: remoteNodes, error } = await supabase
      .from('nodes')
      .select('id, name, type, parent_id, content, display_settings, created_at, size_bytes, is_deleted, deleted_at, deleted_by');

    if (error) {
      throw new Error(`Failed to fetch latest remote nodes post-sync: ${error.message}`);
    }

    if (remoteNodes) {
      // Overwrite local nodes with remote copies (excluding items that still have pending changes)
      const currentQueue = await LocalDB.getSyncQueue();
      const unsyncedIds = new Set(currentQueue.map(item => item.record_id));

      const nodesToSave: any[] = [];

      for (const remote of remoteNodes) {
        if (!unsyncedIds.has(remote.id)) {
          const remoteHash = getHash(remote);
          nodesToSave.push({
            id: remote.id,
            name: remote.name,
            type: remote.type,
            parent_id: remote.parent_id,
            content: remote.content,
            display_settings: remote.display_settings,
            created_at: remote.created_at,
            size_bytes: remote.size_bytes,
            is_deleted: remote.is_deleted,
            deleted_at: remote.deleted_at,
            deleted_by: remote.deleted_by,
            updated_at: new Date().toISOString(),
            version: 1,
            last_synced_hash: remoteHash
          });
        }
      }

      if (nodesToSave.length > 0) {
        await LocalDB.saveNodesBulk(nodesToSave, true); // bypassSyncQueue = true
      }
    }

    if (onProgress) onProgress(100);
  }
};
