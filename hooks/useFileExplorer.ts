import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { buildTree, FileNode, findNodeById } from '@/lib/tree-utils';
import { TrashNode } from '@/lib/types';
import type { User } from '@supabase/supabase-js';
import { LocalDB, db } from '@/lib/local-db';

export function useFileExplorer(
  user: User | null,
  logAction: (action: string, nodeId: string | null, details?: Record<string, any>) => Promise<void>
) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deletedNodes, setDeletedNodes] = useState<TrashNode[]>([]);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [explorerDialog, setExplorerDialog] = useState<{
    type: 'confirm-delete' | 'confirm-permanent-delete' | 'prompt-rename' | 'prompt-add';
    id: string;
    nodeType?: 'file' | 'folder';
    title: string;
    message: string;
    defaultValue?: string;
  } | null>(null);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    
    // 1. Instantly load files from local IndexedDB cache
    try {
      const localNodes = await LocalDB.getNodes();
      if (localNodes.length > 0) {
        setTree(buildTree(localNodes.filter((n: any) => !n.is_deleted) as FileNode[]));
        setDeletedNodes(
          localNodes
            .filter((n: any) => n.is_deleted)
            .sort((a: any, b: any) => new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime()) as TrashNode[]
        );
      }
    } catch (err) {
      console.error("Dexie local load failed:", err);
    }

    // 2. Fetch remote updates to synchronize
    try {
      const { data, error } = await supabase
        .from('nodes')
        .select('id, name, type, parent_id, created_at, size_bytes, is_deleted, deleted_at, deleted_by')
        .order('name');
      
      if (error) {
        console.warn('Supabase fetch failed, relying on offline registry:', error.message);
      } else if (data) {
        // Overlay online data into Dexie (excluding items currently pending in local sync queue)
        const queue = await LocalDB.getSyncQueue();
        const unsyncedIds = new Set(queue.map(item => item.record_id));

        for (const n of data) {
          if (!unsyncedIds.has(n.id)) {
            // Keep existing local hash if we already have one cache
            const existing = await LocalDB.getNode(n.id);
            await LocalDB.saveNode({
              ...existing,
              id: n.id,
              name: n.name,
              type: n.type,
              parent_id: n.parent_id,
              created_at: n.created_at,
              size_bytes: n.size_bytes,
              is_deleted: n.is_deleted,
              deleted_at: n.deleted_at,
              deleted_by: n.deleted_by,
              updated_at: new Date().toISOString(),
              version: existing?.version || 1,
              last_synced_hash: existing?.last_synced_hash || ''
            }, true); // bypassSyncQueue = true
          }
        }

        // Re-read local DB to display unified listings
        const refreshedNodes = await LocalDB.getNodes();
        setTree(buildTree(refreshedNodes.filter((n: any) => !n.is_deleted) as FileNode[]));
        setDeletedNodes(
          refreshedNodes
            .filter((n: any) => n.is_deleted)
            .sort((a: any, b: any) => new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime()) as TrashNode[]
        );
      }
    } catch (e) {
      console.error('Remote fetch sync failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addItem = useCallback(async (type: 'file' | 'folder', parentId: string | null = null) => {
    setExplorerDialog({
      type: 'prompt-add',
      id: parentId || '',
      nodeType: type,
      title: `New ${type === 'file' ? 'File' : 'Folder'}`,
      message: `Enter ${type} name:`,
      defaultValue: '',
    });
  }, []);

  const handleRename = useCallback(async (id: string) => {
    const node = findNodeById(tree, id);
    setExplorerDialog({
      type: 'prompt-rename',
      id,
      title: 'Rename Item',
      message: 'Enter new name:',
      defaultValue: node?.name || '',
    });
  }, [tree]);

  const handleDelete = useCallback(async (id: string) => {
    const node = findNodeById(tree, id);
    setExplorerDialog({
      type: 'confirm-delete',
      id,
      title: 'Move to Trash',
      message: `Move "${node?.name || 'this item'}" to Trash?`,
    });
  }, [tree]);

  const confirmAdd = useCallback(async (type: 'file' | 'folder', name: string, parentId: string | null) => {
    if (!name) return;

    const id = crypto.randomUUID();
    const newNode = {
      id,
      name,
      type,
      parent_id: parentId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      is_deleted: false
    };

    await LocalDB.insertNode(newNode);

    try {
      const { error } = await supabase.from('nodes').insert([newNode]);
      if (!error) {
        await db.sync_queue.where({ record_id: id }).delete();
      }
    } catch (e) {
      console.log('Mutation cached offline');
    }
    
    await logAction(type === 'file' ? 'FILE_CREATED' : 'FOLDER_CREATED', id, { name });
    fetchFiles();
    setExplorerDialog(null);
  }, [logAction, fetchFiles]);

  const confirmRename = useCallback(async (id: string, name: string) => {
    if (!name) return;
    const node = findNodeById(tree, id);

    const local = await LocalDB.getNode(id);
    if (!local) return;

    local.name = name;
    local.updated_at = new Date().toISOString();
    local.version += 1;

    await LocalDB.saveNode(local);

    try {
      const { error } = await supabase.from('nodes').update({ name, updated_at: local.updated_at, version: local.version }).eq('id', id);
      if (!error) {
        await db.sync_queue.where({ record_id: id }).delete();
      }
    } catch (e) {
      console.log('Mutation cached offline');
    }
    
    await logAction('RENAMED', id, { old_name: node?.name, new_name: name });
    fetchFiles();
    setExplorerDialog(null);
  }, [tree, logAction, fetchFiles]);

  const confirmDelete = useCallback(async (id: string) => {
    if (!user) return;

    await LocalDB.deleteNode(id, user.email);

    try {
      const { error } = await supabase.from('nodes').update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user.email }).eq('id', id);
      if (!error) {
        await db.sync_queue.where({ record_id: id }).delete();
      }
    } catch (e) {
      console.log('Mutation cached offline');
    }

    await logAction('MOVED_TO_TRASH', id, { name: findNodeById(tree, id)?.name });
    if (selectedId === id) setSelectedId(null);
    fetchFiles();
    setExplorerDialog(null);
  }, [user, tree, logAction, selectedId, fetchFiles]);

  const handleRestore = useCallback(async (id: string) => {
    const local = await LocalDB.getNode(id);
    if (!local) return;

    local.is_deleted = false;
    local.deleted_at = null;
    local.deleted_by = null;
    local.updated_at = new Date().toISOString();
    local.version += 1;

    await LocalDB.saveNode(local);

    try {
      const { error } = await supabase.from('nodes').update({ is_deleted: false, deleted_at: null, deleted_by: null, updated_at: local.updated_at, version: local.version }).eq('id', id);
      if (!error) {
        await db.sync_queue.where({ record_id: id }).delete();
      }
    } catch (e) {
      console.log('Mutation cached offline');
    }

    await logAction('RESTORED', id);
    fetchFiles();
  }, [logAction, fetchFiles]);

  const handlePermanentDelete = useCallback(async (id: string) => {
    const node = deletedNodes.find(n => n.id === id);
    setExplorerDialog({
      type: 'confirm-permanent-delete',
      id,
      title: 'Permanently Delete',
      message: `Permanently delete "${node?.name || 'this item'}"? This cannot be undone.`,
    });
  }, [deletedNodes]);

  const confirmPermanentDelete = useCallback(async (id: string) => {
    await LocalDB.hardDeleteNode(id);

    try {
      const { error } = await supabase.from('nodes').delete().eq('id', id);
      if (!error) {
        await db.sync_queue.where({ record_id: id }).delete();
      }
    } catch (e) {
      console.log('Mutation cached offline');
    }

    fetchFiles();
    setExplorerDialog(null);
  }, [fetchFiles]);

  const handleShare = useCallback(() => {
    if (!selectedId) return;
    const url = `${window.location.origin}/?id=${selectedId}`;
    navigator.clipboard.writeText(url);
    alert("Shareable link copied to clipboard!");
  }, [selectedId]);

  const activeNode = useMemo(() => 
    (selectedId ? findNodeById(tree, selectedId) : null)
  , [tree, selectedId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return {
    tree,
    selectedId,
    setSelectedId,
    isLoading,
    deletedNodes,
    isLoadingFile,
    setIsLoadingFile,
    loadProgress,
    setLoadProgress,
    fetchFiles,
    addItem,
    handleRename,
    handleDelete,
    handleRestore,
    handlePermanentDelete,
    handleShare,
    activeNode,
    explorerDialog,
    setExplorerDialog,
    confirmAdd,
    confirmRename,
    confirmDelete,
    confirmPermanentDelete
  };
}
