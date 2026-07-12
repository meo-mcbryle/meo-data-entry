import React, { useState } from 'react';
import {
  FileIcon, History, Trash2, Table as TableIcon, Code, RefreshCcw,
  Printer, Share2, Maximize2, Minimize2, Save, Loader2, Sliders, MoreHorizontal
} from 'lucide-react';
import { GRID_THEME } from '@/lib/constants';
import { FileNode } from '@/lib/tree-utils';
import { MobileBottomSheet } from './MobileBottomSheet';

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
  activeRibbonTab?: 'home' | 'insert' | 'formulas' | 'data' | 'view' | 'tools';
  setActiveRibbonTab?: (tab: 'home' | 'insert' | 'formulas' | 'data' | 'view' | 'tools') => void;
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
  activeRibbonTab,
  setActiveRibbonTab,
}: DashboardHeaderProps) => {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  return (
    <>
      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/5 backdrop-blur-md overflow-x-auto no-scrollbar relative z-30">
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
              <div className="flex items-center justify-center gap-1.5 ml-2.5 w-[115px] shrink-0 py-0.5 rounded-full bg-muted/20 border border-border text-[10px] select-none font-bold">
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

          {viewMode === 'table' && activeRibbonTab && setActiveRibbonTab && (
            <nav className={GRID_THEME.navContainer}>
              {(['home', 'insert', 'formulas', 'data', 'view', 'tools'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveRibbonTab(tab)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded capitalize transition-colors cursor-pointer ${
                    activeRibbonTab === tab
                      ? 'bg-card/75 text-accent shadow-sm ring-1 ring-border/30 backdrop-blur-xs font-black'
                      : 'text-muted hover:text-foreground hover:bg-muted/5'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <nav className={GRID_THEME.navContainer}>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${viewMode === 'table'
                  ? 'bg-card/75 text-accent shadow-sm ring-1 ring-border/30 backdrop-blur-xs'
                  : 'text-muted hover:text-foreground'
                }`}
            >
              <TableIcon size={12} /> Grid
            </button>
            {viewMode !== 'logs' && viewMode !== 'trash' && (
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${viewMode === 'code'
                    ? 'bg-card/75 text-accent shadow-sm ring-1 ring-border/30 backdrop-blur-xs'
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
                    ? 'bg-card/75 text-green-600 shadow-sm ring-1 ring-border/30 backdrop-blur-xs'
                    : 'text-muted hover:text-foreground'
                  }`}
              >
                <RefreshCcw size={12} /> Compare{' '}
                {comparisonIds.length > 0 && `(${comparisonIds.length})`}
              </button>
            )}
          </nav>
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
              className={`flex items-center justify-center gap-2 w-24 shrink-0 py-1.5 rounded text-[11px] font-bold transition-colors shadow-sm ${
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

      {/* Mobile Streamlined Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-card/65 backdrop-blur-xl border-b border-border/40 relative z-30 h-13">
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          {viewMode === 'logs' ? (
            <h2 className="text-sm font-bold text-foreground">Audit Logs</h2>
          ) : viewMode === 'trash' ? (
            <h2 className="text-sm font-bold text-foreground">Trash Bin</h2>
          ) : (
            <>
              <h2 className="text-sm font-black text-foreground truncate max-w-40 leading-none">
                {activeNode?.name || 'MEO Data Entry'}
              </h2>
              {activeNode && (
                <div className="flex items-center ml-1">
                  {isSaving ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  ) : hasUnsavedChanges ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)] animate-pulse" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeNode && viewMode !== 'logs' && viewMode !== 'trash' && hasUnsavedChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground text-xs font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              <span>Save</span>
            </button>
          )}
          
          {activeNode && (
            <button
              onClick={() => setIsMobileSheetOpen(true)}
              className="p-2 hover:bg-muted/15 rounded-lg text-muted hover:text-foreground active:scale-95 transition-all cursor-pointer"
            >
              <Sliders size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Actions Drawer Menu */}
      <MobileBottomSheet
        isOpen={isMobileSheetOpen}
        onClose={() => setIsMobileSheetOpen(false)}
        title="Sheet Operations"
      >
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-black text-muted uppercase tracking-[0.15em] px-2 mb-1">View Mode</div>
          <button
            onClick={() => { setViewMode('table'); setIsMobileSheetOpen(false); }}
            className={`w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-accent/10 text-accent font-bold' : ''}`}
          >
            <TableIcon size={18} className={viewMode === 'table' ? 'text-accent' : 'text-muted'} />
            Standard Grid View
          </button>
          <button
            onClick={() => { setViewMode('code'); setIsMobileSheetOpen(false); }}
            className={`w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer ${viewMode === 'code' ? 'bg-accent/10 text-accent font-bold' : ''}`}
          >
            <Code size={18} className={viewMode === 'code' ? 'text-accent' : 'text-muted'} />
            JSON Code View
          </button>
          <button
            onClick={() => { setViewMode('compare'); setIsMobileSheetOpen(false); }}
            className={`w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer ${viewMode === 'compare' ? 'bg-green-600/10 text-green-600 font-bold' : ''}`}
          >
            <RefreshCcw size={18} className={viewMode === 'compare' ? 'text-green-600' : 'text-muted'} />
            Compare Tables {comparisonIds.length > 0 && `(${comparisonIds.length})`}
          </button>

          <div className="h-px bg-border/50 my-1 mx-2"></div>
          <div className="text-[10px] font-black text-muted uppercase tracking-[0.15em] px-2 mb-1">Actions</div>

          <button
            onClick={() => { handleShare(); setIsMobileSheetOpen(false); }}
            className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
          >
            <Share2 size={18} className="text-muted" />
            Share / Copy Link
          </button>

          <button
            onClick={() => { window.open(`/print?id=${selectedId}`, '_blank'); setIsMobileSheetOpen(false); }}
            className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
          >
            <Printer size={18} className="text-muted" />
            Printable Report
          </button>

          <button
            onClick={() => { setIsFullScreen(!isFullScreen); setIsMobileSheetOpen(false); }}
            className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
          >
            {isFullScreen ? (
              <>
                <Minimize2 size={18} className="text-muted" />
                Exit Fullscreen Mode
              </>
            ) : (
              <>
                <Maximize2 size={18} className="text-muted" />
                Enter Fullscreen Mode
              </>
            )}
          </button>
        </div>
      </MobileBottomSheet>
    </>
  );
});

DashboardHeader.displayName = 'DashboardHeader';
