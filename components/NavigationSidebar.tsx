import React, { useState, useEffect } from 'react';
import {
  PanelLeftClose, PanelLeftOpen, Folder, History, Trash2, Search, FileText, User, LogOut, Layers, Network, EyeOff
} from 'lucide-react';
import { FileNode } from '@/lib/tree-utils';
import { ThemeToggle } from './ThemeToggle';
import { GRID_THEME } from '@/lib/constants';

interface NavigationSidebarProps {
  isExplorerVisible: boolean;
  toggleSidebar: (forceState?: boolean) => void;
  viewMode: 'code' | 'table' | 'compare' | 'logs' | 'trash';
  setViewMode: (mode: 'code' | 'table' | 'compare' | 'logs' | 'trash') => void;
  setShowGlobalSearch: (show: boolean) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setShowProfileModal: (show: boolean) => void;
  profileAvatar: string;
  handleLogout: () => Promise<void>;
  activeNode: FileNode | null;
  bgStyle: 'blueprint' | 'particles' | 'none';
  setBgStyle: (style: 'blueprint' | 'particles' | 'none') => void;
  updateAvailable?: boolean;
  onShowUpdate?: (show: boolean) => void;
}

export const NavigationSidebar = ({
  isExplorerVisible,
  toggleSidebar,
  viewMode,
  setViewMode,
  setShowGlobalSearch,
  selectedId,
  setSelectedId,
  setShowProfileModal,
  profileAvatar,
  handleLogout,
  activeNode,
  bgStyle,
  setBgStyle,
  updateAvailable = false,
  onShowUpdate
}: NavigationSidebarProps) => {
  const [recentNodes, setRecentNodes] = useState<FileNode[]>([]);
  const [appVersion, setAppVersion] = useState<string | null>(null);

  // Fetch app version from Electron main process (only available in Electron env)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.getVersion().then(setAppVersion).catch(() => {});
    }
  }, []);



  // Load preferences from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('meo-recent-files');
    if (saved) {
      try {
        setRecentNodes(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse recent files");
      }
    }
  }, []);

  // Track active file history
  useEffect(() => {
    if (activeNode && activeNode.type === 'file') {
      setRecentNodes(prev => {
        const filtered = prev.filter(n => n.id !== activeNode.id);
        const updated = [activeNode, ...filtered].slice(0, 5);
        localStorage.setItem('meo-recent-files', JSON.stringify(updated));
        return updated;
      });
    }
  }, [activeNode]);

  return (
    <div className="flex h-full shrink-0 relative">
      {/* Vertical Icon Rail (Light Theme) */}
      <div className={`${GRID_THEME.rail} ${isExplorerVisible
          ? 'fixed md:relative left-0 top-0 h-full md:h-auto translate-x-0 opacity-100 flex'
          : 'fixed md:relative -translate-x-full md:translate-x-0 md:flex pointer-events-none md:pointer-events-auto opacity-0 md:opacity-100'
        } transition-[transform,opacity] duration-300`}>
        <button
          onClick={() => toggleSidebar()}
          className={`p-2 rounded-lg group relative ${isExplorerVisible ? 'text-accent bg-accent/10 shadow-sm' : 'text-muted hover:text-foreground hover:bg-muted/10'}`}
        >
          {isExplorerVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
            {isExplorerVisible ? "Collapse Sidebar" : "Expand Sidebar"}
          </div>
        </button>
        <div className="h-px w-6 bg-border" />
        <button
          className={`p-2 rounded-lg group relative ${isExplorerVisible ? 'text-accent' : 'text-muted hover:text-foreground'}`}
          onClick={() => !isExplorerVisible && toggleSidebar(true)}
        >
          <Folder size={20} />
          <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
            Project Explorer
          </div>
        </button>
        <button
          onClick={() => { setViewMode('logs'); toggleSidebar(false); }}
          className={`p-2 rounded-lg group relative ${viewMode === 'logs' ? 'text-purple-500 bg-purple-500/10 shadow-sm' : 'text-muted hover:text-foreground hover:bg-muted/10'}`}
        >
          <History size={20} />
          <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
            System Audit Logs
          </div>
        </button>
        <button
          onClick={() => { setViewMode('trash'); toggleSidebar(false); }}
          className={`p-2 rounded-lg group relative ${viewMode === 'trash' ? 'text-orange-500 bg-orange-500/10 shadow-sm' : 'text-muted hover:text-foreground hover:bg-muted/10'}`}
        >
          <Trash2 size={20} />
          <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
            Trash Bin
          </div>
        </button>
        <button
          onClick={() => setShowGlobalSearch(true)}
          className="p-2 text-muted hover:text-foreground group relative"
        >
          <Search size={20} />
          <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
            Search System
          </div>
        </button>
        <div className="mt-auto flex flex-col gap-4">
          {recentNodes.length > 0 && (
            <div className="flex flex-col items-center gap-2 mb-2">
              <History size={14} className="text-muted/40 mb-1" />
              {recentNodes.map(node => (
                <button
                   key={`recent-${node.id}`}
                  onClick={() => {
                    setSelectedId(node.id);
                    if (['logs', 'trash', 'compare'].includes(viewMode)) setViewMode('table');
                  }}
                  className={`p-1.5 rounded group relative ${selectedId === node.id ? 'text-accent bg-accent/10 shadow-sm' : 'text-muted hover:text-foreground hover:bg-muted/10'}`}
                >
                  <FileText size={16} />
                  <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
                    {node.name}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="h-px w-6 bg-border self-center" />
          <button
            onClick={() => setShowProfileModal(true)}
            className="p-2 text-muted hover:text-accent group relative"
          >
            {profileAvatar ? (
              <div className="w-6 h-6 rounded-md overflow-hidden border border-border group-hover:border-accent transition-colors shadow-inner">
                <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
              </div>
            ) : (
              <User size={20} />
            )}
            <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
              Profile Settings
            </div>
          </button>
          <button
            onClick={() => setBgStyle(bgStyle === 'particles' ? 'blueprint' : bgStyle === 'blueprint' ? 'none' : 'particles')}
            className="p-2 text-muted hover:text-accent group relative focus-visible:ring-2 focus-visible:ring-accent outline-none rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle Background Style"
          >
            {bgStyle === 'particles' ? <Layers size={20} /> : bgStyle === 'blueprint' ? <EyeOff size={20} /> : <Network size={20} />}
            <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
              {bgStyle === 'particles' ? "Switch to Blueprint" : bgStyle === 'blueprint' ? "Switch to Static (Off)" : "Switch to Particles"}
            </div>
          </button>
          <ThemeToggle />

          <div className="h-px w-6 bg-border self-center" />

          {appVersion && (
            <button
              onClick={() => onShowUpdate && onShowUpdate(true)}
              className="relative group flex flex-col items-center cursor-pointer"
              title={updateAvailable ? 'Update available — click to open' : `MEO Data Entry v${appVersion}`}
            >
              <span className="text-[9px] font-mono text-muted/40 group-hover:text-muted/70 text-center leading-none select-none transition-colors">
                v{appVersion}
              </span>
              {updateAvailable && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_6px_2px_rgba(139,92,246,0.6)] animate-pulse" />
              )}
            </button>
          )}

          <button
            onClick={handleLogout}
            className="p-2 text-muted hover:text-red-500 group relative"
          >
            <LogOut size={20} />
            <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
              Sign Out
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
