import React, { useState } from 'react';
import { Folder, File, ChevronRight, ChevronDown, Trash2, Edit2, Plus, FolderPlus, FilePlus, MoreVertical } from 'lucide-react';
import { FileNode } from '@/lib/tree-utils';
import { MobileBottomSheet } from './MobileBottomSheet';

interface Props {
  node: FileNode;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  onAdd: (type: 'file' | 'folder', parentId: string) => void;
  onSelect: (node: FileNode) => void;
  selectedId?: string;
  searchTerm?: string;
  comparisonIds: string[];
  onToggleCompare: (id: string) => void;
}

const highlightMatch = (text: string, query: string) => {
  if (!query || !query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="bg-accent/25 text-accent rounded-sm px-0.5 font-bold">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
};

const FileNodeItem = React.memo(({
  node, onDelete, onRename, onAdd, onSelect, selectedId, searchTerm, comparisonIds, onToggleCompare
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const isFolder = node.type === 'folder';
  const isSearching = !!searchTerm?.trim();

  const handleClick = () => {
    if (isFolder) {
      setIsOpen(!isOpen);
    }
    onSelect(node);
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center group py-1 px-1.5 rounded-md cursor-pointer ${selectedId === node.id ? 'bg-accent/10 text-accent shadow-sm' : 'hover:bg-muted/10 text-muted hover:text-foreground'
          }`}
      >
        <div className="flex items-center flex-1 min-w-0" onClick={handleClick}>
          {isFolder ? (
            <span className="mr-1.5 text-muted/60 group-hover:text-foreground">
              {isOpen ? <ChevronDown size={14} strokeWidth={2.5} /> : <ChevronRight size={14} strokeWidth={2.5} />}
            </span>
          ) : <span className="w-5" />}

          {isFolder ? (
            <Folder size={15} className={`${selectedId === node.id ? 'text-accent' : 'text-accent/60'} mr-2 fill-current opacity-80`} />
          ) : (
            <File size={15} className="text-muted/60 mr-2 opacity-80" />
          )}
          <span className="text-xs font-semibold truncate">{highlightMatch(node.name, searchTerm || '')}</span>
        </div>

        {/* Desktop actions (hover) */}
        <div className="hidden md:flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
          {isFolder && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd('file', node.id); }}
              className="p-1 hover:bg-card hover:shadow-sm rounded text-muted hover:text-accent"
              title="New File"
            >
              <Plus size={14} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRename(node.id); }}
            className="p-1 hover:bg-card hover:shadow-sm rounded text-muted hover:text-accent"
            title="Rename"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="p-1 text-muted hover:text-red-500 hover:bg-card hover:shadow-sm rounded"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Mobile actions (three dots trigger) */}
        <div className="md:hidden flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSheetOpen(true);
            }}
            className="p-1.5 hover:bg-muted/15 rounded text-muted active:scale-95 transition-all cursor-pointer"
          >
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      <MobileBottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={node.name}
      >
        <div className="flex flex-col gap-1">
          {isFolder ? (
            <>
              <button
                onClick={() => {
                  setIsSheetOpen(false);
                  onAdd('file', node.id);
                }}
                className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
              >
                <FilePlus size={18} className="text-accent" />
                Add New File
              </button>
              <button
                onClick={() => {
                  setIsSheetOpen(false);
                  onAdd('folder', node.id);
                }}
                className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
              >
                <FolderPlus size={18} className="text-muted" />
                Add New Folder
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setIsSheetOpen(false);
                onToggleCompare(node.id);
              }}
              className={`w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer ${
                comparisonIds.includes(node.id) ? 'bg-accent/10 text-accent font-bold' : ''
              }`}
            >
              <File size={18} className={comparisonIds.includes(node.id) ? 'text-accent' : 'text-muted'} />
              {comparisonIds.includes(node.id) ? 'Remove from Comparison' : 'Add to Comparison'}
            </button>
          )}

          <button
            onClick={() => {
              setIsSheetOpen(false);
              onRename(node.id);
            }}
            className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
          >
            <Edit2 size={18} className="text-muted" />
            Rename {isFolder ? 'Folder' : 'File'}
          </button>

          <div className="h-px bg-border/50 my-1 mx-2"></div>

          <button
            onClick={() => {
              setIsSheetOpen(false);
              onDelete(node.id);
            }}
            className="w-full text-left px-4 py-3 hover:bg-red-500/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-red-500 transition-colors cursor-pointer"
          >
            <Trash2 size={18} />
            Delete {isFolder ? 'Folder' : 'File'}
          </button>
        </div>
      </MobileBottomSheet>

      {isFolder && (isOpen || isSearching) && (
        <div className="ml-3.5 pl-2 border-l border-border mt-0.5 space-y-0.5">
          {node.children?.map(child => (
            <FileNodeItem
              key={child.id}
              node={child}
              onDelete={onDelete}
              onRename={onRename}
              onAdd={onAdd}
              onSelect={onSelect}
              selectedId={selectedId}
              searchTerm={searchTerm}
              comparisonIds={comparisonIds}
              onToggleCompare={onToggleCompare}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default FileNodeItem;
