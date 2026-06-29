import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { buildTree, FileNode, findNodeById } from '@/lib/tree-utils';
import { TrashNode } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

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

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('nodes')
      .select('id, name, type, parent_id, created_at, size_bytes, is_deleted, deleted_at, deleted_by')
      .order('name');
    
    if (error) {
      console.error('Error fetching files:', error.message);
    } else if (data) {
      setTree(buildTree(data.filter((n: any) => !n.is_deleted) as FileNode[]));
      setDeletedNodes(
        data
          .filter((n: any) => n.is_deleted)
          .sort((a: any, b: any) => new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime()) as TrashNode[]
      );
    }
    setIsLoading(false);
  }, []);

  const addItem = useCallback(async (type: 'file' | 'folder', parentId: string | null = null) => {
    const name = window.prompt(`Enter ${type} name:`);
    if (!name) return;

    const { data, error } = await supabase.from('nodes').insert([{ name, type, parent_id: parentId }]).select().single();
    if (error) {
      alert(`Failed to create ${type}: ${error.message}`);
      return;
    }
    
    if (data) await logAction(type === 'file' ? 'FILE_CREATED' : 'FOLDER_CREATED', data.id, { name });
    fetchFiles();
  }, [logAction, fetchFiles]);

  const handleRename = useCallback(async (id: string) => {
    const node = findNodeById(tree, id);
    const name = window.prompt('Enter new name:', node?.name);
    if (!name) return;

    const { error } = await supabase.from('nodes').update({ name }).eq('id', id);
    if (error) {
      alert(`Failed to rename: ${error.message}`);
      return;
    }
    await logAction('RENAMED', id, { old_name: node?.name, new_name: name });
    fetchFiles();
  }, [tree, logAction, fetchFiles]);

  const handleDelete = useCallback(async (id: string) => {
    if (!user) return;
    if (!window.confirm('Move this item to Trash?')) return;
    const { error } = await supabase.from('nodes').update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user.email }).eq('id', id);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }
    await logAction('MOVED_TO_TRASH', id, { name: findNodeById(tree, id)?.name });
    if (selectedId === id) setSelectedId(null);
    fetchFiles();
  }, [user, tree, logAction, selectedId, fetchFiles]);

  const handleRestore = useCallback(async (id: string) => {
    const { error } = await supabase.from('nodes').update({ is_deleted: false, deleted_at: null, deleted_by: null }).eq('id', id);
    if (error) {
      alert(`Failed to restore: ${error.message}`);
      return;
    }
    await logAction('RESTORED', id);
    fetchFiles();
  }, [logAction, fetchFiles]);

  const handlePermanentDelete = useCallback(async (id: string) => {
    if (!window.confirm('Permanently delete this item? This cannot be undone.')) return;
    const { error } = await supabase.from('nodes').delete().eq('id', id);
    if (!error) fetchFiles();
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
    activeNode
  };
}
