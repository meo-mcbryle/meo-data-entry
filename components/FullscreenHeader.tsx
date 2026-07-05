import React from 'react';
import { History, Trash2, Table as TableIcon, Minimize2, Save, Loader2 } from 'lucide-react';
import { FileNode } from '@/lib/tree-utils';

type ViewMode = 'code' | 'table' | 'compare' | 'logs' | 'trash';

interface FullscreenHeaderProps {
  viewMode: ViewMode;
  activeNode?: FileNode | null;
  onExitFullscreen: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export const FullscreenHeader = React.memo(({
  viewMode,
  activeNode,
  onExitFullscreen,
  onSave,
  isSaving,
}: FullscreenHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2 text-xs font-bold text-muted shrink-0">
        {viewMode === 'logs' && <><History size={14} /> System Audit Logs</>}
        {viewMode === 'trash' && <><Trash2 size={14} /> Trash Bin</>}
        {viewMode !== 'logs' && viewMode !== 'trash' && activeNode && (
          <><TableIcon size={14} /> {activeNode.name}</>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        {viewMode !== 'logs' && viewMode !== 'trash' && onSave && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-foreground rounded text-[11px] font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        )}
        <button
          onClick={onExitFullscreen}
          className="text-muted hover:text-foreground p-1"
          title="Exit Focus Mode"
        >
          <Minimize2 size={14} />
        </button>
      </div>
    </div>
  );
});

FullscreenHeader.displayName = 'FullscreenHeader';
