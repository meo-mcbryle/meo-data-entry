import React from 'react';
import {
  FileIcon, History, Trash2, Table as TableIcon, Code, RefreshCcw,
  Printer, Share2, Maximize2, Minimize2, Save, Loader2,
} from 'lucide-react';
import { GRID_THEME } from '@/lib/constants';
import { FileNode } from '@/lib/tree-utils';

type ViewMode = 'code' | 'table' | 'compare' | 'logs' | 'trash';

interface DashboardHeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeNode?: FileNode | null;
  isFullScreen: boolean;
  setIsFullScreen: (v: boolean) => void;
  selectedId: string | null;
  comparisonIds: string[];
  handleShare: () => void;
  handleSave: () => void;
  isSaving: boolean;
  hasUnsavedChanges?: boolean;
}

export const DashboardHeader = React.memo(({
  viewMode,
  setViewMode,
  activeNode,
  isFullScreen,
  setIsFullScreen,
  selectedId,
  comparisonIds,
  handleShare,
  handleSave,
  isSaving,
  hasUnsavedChanges = false,
}: DashboardHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/10 overflow-x-auto no-scrollbar">
      {/* Left: Breadcrumb + View Tabs */}
      <div className="flex items-center gap-3 shrink-0">
        {viewMode === 'logs' ? (
          <>
            <div className="md:p-1.5 p-0.5 bg-purple-500/10 text-purple-500 rounded">
              <History size={14} />
            </div>
            <h2 className="text-sm font-bold text-foreground">System Audit Logs</h2>
          </>
        ) : viewMode === 'trash' ? (
          <>
            <div className="md:p-1.5 p-0.5 bg-orange-500/10 text-orange-500 rounded">
              <Trash2 size={14} />
            </div>
            <h2 className="text-sm font-bold text-foreground">Trash Bin</h2>
          </>
        ) : (
          <>
            <div className="md:p-1.5 p-0.5 bg-accent/10 text-accent rounded">
              <FileIcon size={14} />
            </div>
            <h2 className="text-sm font-bold text-foreground truncate max-w-30 md:max-w-60">
              {activeNode?.name}
            </h2>
            {/* Save Status Badge */}
            <div className="flex items-center gap-1.5 ml-2.5 px-2 py-0.5 rounded-full bg-muted/20 border border-border text-[10px] select-none font-bold">
              {isSaving ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                  <span className="text-accent">Saving...</span>
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                  <span className="text-amber-500 font-black">Unsaved Changes</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                  <span className="text-emerald-500/80">Saved</span>
                </>
              )}
            </div>
          </>
        )}

        <div className="h-4 w-px bg-border mx-1" />

        <nav className={GRID_THEME.navContainer}>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${viewMode === 'table'
                ? 'bg-card text-accent shadow-sm ring-1 ring-border'
                : 'text-muted hover:text-foreground'
              }`}
          >
            <TableIcon size={12} /> Grid
          </button>
          {viewMode !== 'logs' && viewMode !== 'trash' && (
            <button
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${viewMode === 'code'
                  ? 'bg-card text-accent shadow-sm ring-1 ring-border'
                  : 'text-muted hover:text-foreground'
                }`}
            >
              <Code size={12} /> JSON
            </button>
          )}
          {viewMode !== 'logs' && viewMode !== 'trash' && (
            <button
              onClick={() => setViewMode('compare')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${viewMode === 'compare'
                  ? 'bg-card text-green-600 shadow-sm ring-1 ring-border'
                  : 'text-muted hover:text-foreground'
                }`}
            >
              <RefreshCcw size={12} /> Compare{' '}
              {comparisonIds.length > 0 && `(${comparisonIds.length})`}
            </button>
          )}
        </nav>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {activeNode && (
          <button
            onClick={() => window.open(`/print?id=${selectedId}`, '_blank')}
            className="p-1.5 text-muted hover:text-accent transition-colors"
            title="Printable Report"
          >
            <Printer size={16} />
          </button>
        )}
        {activeNode && (
          <button
            onClick={handleShare}
            className="p-1.5 text-muted hover:text-accent transition-colors"
            title="Copy Link"
          >
            <Share2 size={16} />
          </button>
        )}
        <button
          onClick={() => setIsFullScreen(!isFullScreen)}
          className="p-1.5 text-muted hover:text-accent transition-colors"
          title="Toggle Focus Mode"
        >
          {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        {activeNode && viewMode !== 'logs' && viewMode !== 'trash' && (
          <button
            onClick={handleSave}
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
      </div>
    </div>
  );
});

DashboardHeader.displayName = 'DashboardHeader';
