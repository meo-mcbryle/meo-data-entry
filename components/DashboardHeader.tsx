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
          </>
        )}

        <div className="h-4 w-px bg-border mx-1" />

        <nav className={GRID_THEME.navContainer}>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${
              viewMode === 'table'
                ? 'bg-card text-accent shadow-sm ring-1 ring-border'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <TableIcon size={12} /> Grid
          </button>
          {viewMode !== 'logs' && viewMode !== 'trash' && (
            <button
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${
                viewMode === 'code'
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
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${
                viewMode === 'compare'
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
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-foreground rounded text-[11px] font-bold hover:opacity-90 disabled:opacity-50 shadow-sm"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
});

DashboardHeader.displayName = 'DashboardHeader';
