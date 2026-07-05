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
  hasUnsavedChanges?: boolean;
}

export const FullscreenHeader = React.memo(({
  viewMode,
  activeNode,
  onExitFullscreen,
  onSave,
  isSaving,
  hasUnsavedChanges = false,
}: FullscreenHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2 text-xs font-bold text-muted shrink-0">
        {viewMode === 'logs' && <><History size={14} /> System Audit Logs</>}
        {viewMode === 'trash' && <><Trash2 size={14} /> Trash Bin</>}
        {viewMode !== 'logs' && viewMode !== 'trash' && activeNode && (
          <>
            <TableIcon size={14} /> 
            <span>{activeNode.name}</span>
            {/* Save Status Badge */}
            <div className="flex items-center gap-1.5 ml-2 px-1.5 py-0.5 rounded-full bg-muted/20 border border-border text-[9px] select-none font-bold">
              {isSaving ? (
                <>
                  <span className="w-1 h-1 rounded-full bg-accent animate-ping" />
                  <span className="text-accent text-[8px]">Saving...</span>
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                  <span className="text-amber-500 font-black text-[8px]">Unsaved Changes</span>
                </>
              ) : (
                <>
                  <span className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                  <span className="text-emerald-500/80 text-[8px]">Saved</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        {viewMode !== 'logs' && viewMode !== 'trash' && onSave && (
          <button
            onClick={onSave}
            disabled={isSaving || !hasUnsavedChanges}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-[11px] font-bold transition-all shadow-sm ${
              isSaving
                ? 'bg-accent/50 text-accent-foreground/50 cursor-not-allowed'
                : !hasUnsavedChanges
                ? 'bg-muted/55 text-muted-foreground border border-border cursor-not-allowed opacity-75'
                : 'bg-accent text-accent-foreground hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isSaving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : !hasUnsavedChanges ? (
              <span className="text-emerald-500 font-bold">✓</span>
            ) : (
              <Save size={12} />
            )}
            {isSaving ? 'Saving...' : !hasUnsavedChanges ? 'Saved' : 'Save'}
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
