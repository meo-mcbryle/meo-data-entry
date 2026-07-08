import React, { useState, useMemo, useCallback } from 'react';
import { Search, Loader2, FolderPlus, FilePlus, X } from 'lucide-react';
import { FileNode } from '@/lib/tree-utils';
import FileNodeItem from './FileNodeItem';
import { GRID_THEME } from '@/lib/constants';

interface ProjectExplorerProps {
  tree: FileNode[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  addItem: (type: 'file' | 'folder', parentId?: string | null) => Promise<void>;
  handleRename: (id: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  isExplorerVisible: boolean;
  setIsExplorerVisible: (visible: boolean) => void;
  isLoading: boolean;
  setIsLoadingFile: (loading: boolean) => void;
  viewMode: string;
  setViewMode: (mode: any) => void;
  comparisonIds: string[];
  toggleComparisonId: (id: string) => void;
  isMobileInline?: boolean;
}

export const ProjectExplorer = ({
  tree,
  selectedId,
  setSelectedId,
  addItem,
  handleRename,
  handleDelete,
  isExplorerVisible,
  setIsExplorerVisible,
  isLoading,
  setIsLoadingFile,
  viewMode,
  setViewMode,
  comparisonIds,
  toggleComparisonId,
  isMobileInline = false
}: ProjectExplorerProps) => {
  const [explorerSearch, setExplorerSearch] = useState('');

  const handleSelectNode = useCallback((node: FileNode) => {
    if (selectedId !== node.id) {
      setIsLoadingFile(true);
      setSelectedId(node.id);
    }
    if (['logs', 'trash', 'compare', 'explorer'].includes(viewMode)) {
      setViewMode('table');
    }
  }, [selectedId, setSelectedId, viewMode, setViewMode, setIsLoadingFile]);

  // Recursive filter logic for the explorer tree
  const filteredTree = useMemo(() => {
    if (!explorerSearch.trim()) return tree;

    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes
        .map(node => {
          const nameMatches = node.name.toLowerCase().includes(explorerSearch.toLowerCase());

          if (node.type === 'folder' && node.children) {
            const filteredChildren = filterNodes(node.children);
            if (nameMatches) {
              return node; // Show folder and all children if folder name matches query
            }
            if (filteredChildren.length > 0) {
              return { ...node, children: filteredChildren };
            }
            return null;
          }

          return nameMatches ? node : null;
        })
        .filter(Boolean) as FileNode[];
    };

    return filterNodes(tree);
  }, [tree, explorerSearch]);

  return (
    <>
      {/* Explorer Drawer Panel */}
      {isExplorerVisible && !isMobileInline && (
        <div
          className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-[2px] z-40"
          onClick={() => setIsExplorerVisible(false)}
        />
      )}
      <aside
        className={
          isMobileInline
            ? "w-full h-full flex flex-col p-4 bg-card/45 backdrop-blur-lg border border-border/50 rounded-xl shadow-lg relative overflow-hidden"
            : `${GRID_THEME.drawer} ${isExplorerVisible
                ? 'w-60 p-3 opacity-100 translate-x-12 md:translate-x-0 pointer-events-auto'
                : 'w-0 p-0 opacity-0 -translate-x-full md:translate-x-0 pointer-events-none'
              } fixed md:relative left-0 top-0 z-50 md:z-auto h-full shadow-2xl md:shadow-none`
        }
      >
        <div className={`${isMobileInline ? 'w-full' : 'w-[220px]'} h-full flex flex-col shrink-0`}>
          <div className={`flex justify-between items-center mb-3 px-1 transition-colors ${isMobileInline ? 'w-full' : 'min-w-55'}`}>
            <h1 className="font-black text-muted text-[10px] uppercase tracking-[0.2em]">Project Tree</h1>
            <div className="flex items-center gap-0.5">
              <button onClick={() => addItem('folder')} className="p-1.5 hover:bg-muted/10 rounded-md text-muted transition-colors" title="New Folder">
                <FolderPlus size={16} />
              </button>
              <button onClick={() => addItem('file')} className="p-1.5 hover:bg-muted/10 rounded-md text-accent transition-colors" title="New File">
                <FilePlus size={16} />
              </button>
            </div>
          </div>
          <div className={`mb-3 relative group ${isMobileInline ? 'w-full' : 'min-w-55'}`}>
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent" />
            <input
              type="text"
              placeholder="Filter nodes..."
              value={explorerSearch}
              onChange={(e) => setExplorerSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setExplorerSearch('');
                }
              }}
              className="w-full pl-9 pr-8 py-1 text-xs bg-white/10 dark:bg-black/20 border border-white/15 dark:border-white/5 rounded-md outline-none focus:border-accent/70 focus:shadow-[0_0_12px_rgba(59,130,246,0.2)] text-foreground transition-all"
            />
            {explorerSearch && (
              <button
                onClick={() => setExplorerSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-foreground hover:bg-muted/10 rounded-full transition-all cursor-pointer"
                title="Clear filter"
              >
                <X size={11} />
              </button>
            )}
          </div>
          <div className={`overflow-y-auto flex-1 pr-1 custom-scrollbar [contain:content] ${isMobileInline ? 'w-full' : 'min-w-55'}`}>
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="animate-spin text-accent" size={20} />
              </div>
            ) : (
              filteredTree.map(node => (
                <FileNodeItem
                  key={node.id}
                  node={node}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  onAdd={addItem}
                  onSelect={handleSelectNode}
                  selectedId={selectedId ?? undefined}
                  searchTerm={explorerSearch}
                  comparisonIds={comparisonIds}
                  onToggleCompare={toggleComparisonId}
                />
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
