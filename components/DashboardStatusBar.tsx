import React from 'react';
import { Clock, User, HardDrive, Wifi } from 'lucide-react';
import { GRID_THEME } from '@/lib/constants';
import { FileNode } from '@/lib/tree-utils';

interface DashboardStatusBarProps {
  isSystemOnline: boolean;
  setIsSyncModalOpen: (open: boolean) => void;
  activeNode?: FileNode | null;
}

const formatSize = (bytes: number | null | undefined): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const DashboardStatusBar = React.memo(({
  isSystemOnline,
  setIsSyncModalOpen,
  activeNode,
}: DashboardStatusBarProps) => {
  return (
    <footer className={GRID_THEME.statusBar}>
      <div className="flex items-center gap-4">
        {activeNode && (
          <>
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-muted/40" />
              Created {new Date(activeNode.created_at).toLocaleDateString()}
            </div>
            <div className="h-3 w-px bg-border" />
          </>
        )}
        <div className="flex items-center gap-1.5">
          <User size={12} className="text-muted/40" /> LGU Admin
        </div>
      </div>
      <div className="flex items-center gap-4">
        {activeNode && (
          <div className="flex items-center gap-1.5">
            <HardDrive size={12} className="text-muted/40" /> {formatSize(activeNode.size_bytes)}
          </div>
        )}
        {isSystemOnline && (
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-1.5 text-[9px] text-accent hover:text-accent-foreground/80 font-bold tracking-wider px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Open Sync Manager"
          >
            <Wifi size={10} className="animate-pulse text-accent" /> Sync Hub
          </button>
        )}
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isSystemOnline ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} />
          {isSystemOnline ? 'Live System' : 'Connection Error'}
        </div>
      </div>
    </footer>
  );
});

DashboardStatusBar.displayName = 'DashboardStatusBar';
