import React from 'react';
import { Folder, Table as TableIcon, History, Trash2, User } from 'lucide-react';

interface MobileNavigationProps {
  isMobile: boolean;
  isFullScreen: boolean;
  viewMode: string;
  setViewMode: (mode: any) => void;
  activeNode: any;
}

export const MobileNavigation = React.memo(({
  isMobile,
  isFullScreen,
  viewMode,
  setViewMode,
  activeNode
}: MobileNavigationProps) => {
  if (!isMobile || isFullScreen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card/85 backdrop-blur-xl border-t border-border/40 flex items-center justify-around z-50 px-4 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:hidden">
      {/* Explorer (Files) Tab */}
      <button
        onClick={() => setViewMode('explorer')}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${
          viewMode === 'explorer' ? 'text-accent font-bold animate-pulse' : 'text-muted'
        }`}
      >
        <Folder size={18} />
        <span className="text-[9px] font-semibold tracking-tighter">Files</span>
      </button>

      {/* Sheet (Active Spreadsheet) Tab */}
      <button
        onClick={() => activeNode && setViewMode('table')}
        disabled={!activeNode}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${
          !activeNode ? 'opacity-35 cursor-not-allowed' : ''
        } ${viewMode === 'table' || viewMode === 'code' || viewMode === 'compare' ? 'text-accent font-bold' : 'text-muted'}`}
      >
        <TableIcon size={18} />
        <span className="text-[9px] font-semibold tracking-tighter">Sheet</span>
      </button>

      {/* Logs Tab */}
      <button
        onClick={() => setViewMode('logs')}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${
          viewMode === 'logs' ? 'text-purple-500 font-bold animate-pulse' : 'text-muted'
        }`}
      >
        <History size={18} />
        <span className="text-[9px] font-semibold tracking-tighter">Logs</span>
      </button>

      {/* Trash Tab */}
      <button
        onClick={() => setViewMode('trash')}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${
          viewMode === 'trash' ? 'text-orange-500 font-bold animate-pulse' : 'text-muted'
        }`}
      >
        <Trash2 size={18} />
        <span className="text-[9px] font-semibold tracking-tighter">Trash</span>
      </button>

      {/* Settings Tab */}
      <button
        onClick={() => setViewMode('settings')}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${
          viewMode === 'settings' ? 'text-accent font-bold' : 'text-muted'
        }`}
      >
        <User size={18} />
        <span className="text-[9px] font-semibold tracking-tighter">Settings</span>
      </button>
    </div>
  );
});

MobileNavigation.displayName = 'MobileNavigation';
