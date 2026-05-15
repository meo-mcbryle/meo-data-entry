import { useState } from 'react';
import { Folder, File, ChevronRight, ChevronDown, Trash2, Edit2, Plus, FolderPlus, FilePlus } from 'lucide-react';
import { FileNode } from '@/lib/tree-utils';

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

export default function FileNodeItem({ 
  node, onDelete, onRename, onAdd, onSelect, selectedId, searchTerm, comparisonIds, onToggleCompare 
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
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
        className={`flex items-center group py-1.5 px-2 rounded-md cursor-pointer transition-colors duration-75 ${
          selectedId === node.id ? 'bg-accent/10 text-accent shadow-sm' : 'hover:bg-muted/10 text-muted hover:text-foreground'
        }`}
      >
        <div className="flex items-center flex-1 min-w-0" onClick={handleClick}>
          {isFolder ? (
            <span className="mr-1.5 text-muted/60 group-hover:text-foreground transition-colors">
              {isOpen ? <ChevronDown size={14} strokeWidth={2.5}/> : <ChevronRight size={14} strokeWidth={2.5}/>}
            </span>
          ) : <span className="w-5" />}
          
          {isFolder ? (
            <Folder size={18} className={`${selectedId === node.id ? 'text-accent' : 'text-accent/60'} mr-2 fill-current opacity-80`} />
          ) : (
            <File size={18} className="text-muted/60 mr-2 opacity-80" />
          )}
          <span className="text-sm font-medium truncate">{node.name}</span>
        </div>
        
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
          {isFolder && (
            <button 
              onClick={(e) => { e.stopPropagation(); onAdd('file', node.id); }} 
              className="p-1 hover:bg-card hover:shadow-sm rounded text-muted hover:text-accent transition-all"
              title="New File"
            >
              <Plus size={14} />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onRename(node.id); }} 
            className="p-1 hover:bg-card hover:shadow-sm rounded text-muted hover:text-accent transition-all"
            title="Rename"
          >
            <Edit2 size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} 
            className="p-1 text-muted hover:text-red-500 hover:bg-card hover:shadow-sm rounded transition-all"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

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
}
