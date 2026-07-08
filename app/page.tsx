'use client';
import React, { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { flushSync } from 'react-dom';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';
import {
  hydrateMapToArray,
  dehydrateArrayToMap
} from '@/lib/excel-utils';
import { ProjectExplorer } from '@/components/ProjectExplorer';
import { ThemeContext } from '@/components/ThemeToggle';
import { LoginPage } from '@/components/LoginPage';
import { NavigationSidebar } from '@/components/NavigationSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardMainArea } from '@/components/DashboardMainArea';
import { DashboardModals } from '@/components/DashboardModals';
import { GRID_THEME } from '@/lib/constants';
import { Folder, PanelLeftOpen, Table as TableIcon, History, Trash2, User, Sun, Moon, Layers, Network, LogOut } from 'lucide-react';
import { CustomDialog } from '@/components/CustomDialog';
import { ParticleConstellation } from '@/components/ParticleConstellation';
import { MechanicalBlueprint } from '@/components/MechanicalBlueprint';

// Mobile Settings & Profile Panel Component
const MobileSettingsPanel = ({
  user,
  profileAvatar,
  setShowProfileModal,
  bgStyle,
  setBgStyle,
  theme,
  toggleTheme,
  handleLogout
}: any) => {
  return (
    <div className="flex-1 flex flex-col p-5 bg-card/45 backdrop-blur-lg border border-border/50 rounded-xl shadow-lg relative overflow-hidden gap-4 min-h-[480px]">
      {/* Glow top border */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-accent to-transparent" />
      
      {/* Profile info card */}
      <div className="flex items-center gap-4 p-4 bg-muted/5 border border-border/30 rounded-xl relative">
        <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/60 bg-muted/10 shadow-inner flex items-center justify-center">
          {profileAvatar ? (
            <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User size={26} className="text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-foreground truncate">{user?.email?.split('@')[0]}</h4>
          <p className="text-[10px] font-semibold text-muted truncate">{user?.email}</p>
        </div>
        <button 
          onClick={() => setShowProfileModal(true)}
          className="px-3 py-1.5 bg-accent/10 border border-accent/20 hover:bg-accent/20 rounded-lg text-[9px] font-black text-accent uppercase tracking-wider transition-all cursor-pointer"
        >
          Edit
        </button>
      </div>

      <div className="h-px bg-border/40 my-1 mx-2" />

      {/* UI Settings */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-black text-muted uppercase tracking-[0.18em] px-2 mb-0.5">Interface settings</span>
        
        {/* Theme Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-muted/5 border border-border/30 rounded-xl">
          <span className="text-xs font-bold text-foreground">Theme Mode</span>
          <button 
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-bold text-foreground shadow-sm cursor-pointer active:scale-95 transition-all"
          >
            {theme === 'dark' ? <Sun size={13} className="text-amber-500" /> : <Moon size={13} className="text-blue-500" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        {/* Background Animation Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-muted/5 border border-border/30 rounded-xl">
          <span className="text-xs font-bold text-foreground">Background Effect</span>
          <button 
            onClick={() => setBgStyle(bgStyle === 'particles' ? 'blueprint' : 'particles')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-bold text-foreground shadow-sm cursor-pointer active:scale-95 transition-all"
          >
            {bgStyle === 'particles' ? <Layers size={13} className="text-purple-500" /> : <Network size={13} className="text-cyan-500" />}
            {bgStyle === 'particles' ? 'Blueprint' : 'Particles'}
          </button>
        </div>
      </div>

      {/* Footer / Sign Out */}
      <div className="mt-auto pt-6 flex flex-col gap-3">
        <button 
          onClick={handleLogout}
          className="w-full py-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-500 text-xs font-black uppercase tracking-[0.18em] rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <LogOut size={15} />
          <span>Sign Out Admin</span>
        </button>
        <p className="text-[8px] font-mono text-muted/30 text-center tracking-widest select-none">
          MEO SECURE SYSTEM V1.0
        </p>
      </div>
    </div>
  );
};


import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useFileExplorer } from '@/hooks/useFileExplorer';
import { useProfile } from '@/hooks/useProfile';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useSpreadsheetOperations } from '@/hooks/useSpreadsheetOperations';

const DashboardContent = React.memo(({ user }: { user: SupabaseUser }) => {
  const [isMobile, setIsMobile] = useState(false);
  const themeContext = React.useContext(ThemeContext);

  const [viewMode, setViewMode] = useState<'explorer' | 'settings' | 'code' | 'table' | 'compare' | 'logs' | 'trash'>('table');
  const [bgStyle, setBgStyle] = useState<'blueprint' | 'particles'>('particles');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [codeViewContent, setCodeViewContent] = useState<string>('');
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [isSystemOnline, setIsSystemOnline] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    handleResize();

    // Set initial viewMode based on screen size on mount
    if (window.innerWidth < 768) {
      setViewMode('explorer');
    }

    // Set initial online status on mount
    setIsSystemOnline(navigator.onLine);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Network connectivity monitoring
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkDbConnection = async () => {
      if (!navigator.onLine) {
        setIsSystemOnline(false);
        return;
      }
      try {
        const { error } = await supabase.from('nodes').select('id').limit(1);
        setIsSystemOnline(!error);
      } catch (e) {
        setIsSystemOnline(false);
      }
    };

    checkDbConnection();

    const handleOnline = () => {
      setIsSystemOnline(true);
      checkDbConnection();
      setIsSyncModalOpen(true);
    };
    const handleOffline = () => setIsSystemOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Open sync modal on mount if there are pending items
  useEffect(() => {
    if (isSystemOnline) {
      import('@/lib/local-db').then(({ LocalDB }) => {
        LocalDB.getSyncQueue().then(queue => {
          if (queue.length > 0) setIsSyncModalOpen(true);
        });
      });
    }
  }, [isSystemOnline]);

  // 1. Audit Logs Hook
  const { auditLogs, isLoadingLogs, hasMoreLogs, fetchAuditLogs, logAction } = useAuditLogs(user);

  // 2. File Explorer Hook
  const {
    tree, selectedId, setSelectedId, isLoading,
    deletedNodes, isLoadingFile, setIsLoadingFile, loadProgress, setLoadProgress,
    fetchFiles, addItem, handleRename, handleDelete, handleRestore,
    handlePermanentDelete, handleShare, activeNode,
    explorerDialog, setExplorerDialog,
    confirmAdd, confirmRename, confirmDelete, confirmPermanentDelete
  } = useFileExplorer(user, logAction);

  // 3. Spreadsheet Operations Hook
  const spreadsheet = useSpreadsheetOperations({
    user, activeNode, selectedId, logAction, fetchFiles,
    isLoadingFile, setIsLoadingFile, loadProgress, setLoadProgress
  });

  // 4. Dashboard Layout Hook
  const {
    isExplorerVisible, setIsExplorerVisible, isSidebarMoving,
    containerHeight, setContainerHeight,
    isFullScreen, setIsFullScreen,
    isFreezeHeaders, setIsFreezeHeaders,
    isFreezePanes, setIsFreezePanes,
    zoom, setZoom,
    toggleSidebar, onMeasuredHeight
  } = useDashboardLayout(spreadsheet.setRowHeights);

  // 5. User Profile Hook
  const { showProfileModal, setShowProfileModal, profileAvatar, setProfileAvatar, handleLogout } = useProfile(user);

  const searchParams = useSearchParams();

  // Intercept file selection changes to warn about unsaved changes
  const handleSelectId = useCallback((id: string | null) => {
    if (id === selectedId) return;
    if (spreadsheet.hasUnsavedChanges) {
      setPendingSelectId(id);
    } else {
      setSelectedId(id);
    }
  }, [selectedId, spreadsheet.hasUnsavedChanges, setSelectedId]);

  const handleShareCustom = useCallback(() => {
    if (!selectedId) return;
    const url = `${window.location.origin}/?id=${selectedId}`;
    navigator.clipboard.writeText(url);
    spreadsheet.setSpreadsheetDialog({
      type: 'alert',
      title: 'Link Copied',
      message: 'Shareable link copied to clipboard!',
      onConfirm: () => {}
    });
  }, [selectedId, spreadsheet.setSpreadsheetDialog]);

  // Sync URL share link to selected file
  useEffect(() => {
    const urlId = searchParams.get('id');
    if (urlId) handleSelectId(urlId);
  }, [searchParams, handleSelectId]);

  // Fetch logs or files when view changes
  useEffect(() => {
    if (viewMode === 'logs') fetchAuditLogs();
    if (viewMode === 'trash') fetchFiles();
  }, [viewMode, fetchAuditLogs, fetchFiles]);

  const toggleComparisonId = useCallback((id: string) => {
    setComparisonIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  // Sync code view JSON content from state
  useEffect(() => {
    if (viewMode !== 'code' || !activeNode || activeNode.type !== 'file') return;
    const contentArray = hydrateMapToArray(
      spreadsheet.gridData, spreadsheet.rowCount,
      spreadsheet.allHeaders, spreadsheet.masterColumnOrder
    );
    const fullData = {
      content: contentArray,
      display_settings: {
        columnAlignments: spreadsheet.columnAlignments,
        cellAlignments: spreadsheet.cellAlignments,
        hiddenColumns: spreadsheet.hiddenColumns,
        selectedYear: spreadsheet.selectedYear,
        columnOrder: spreadsheet.columnOrder,
        columnWidths: spreadsheet.columnWidths,
        cellMetadata: spreadsheet.cellMetadata,
        rowHeights: spreadsheet.rowHeights
      }
    };
    setCodeViewContent(JSON.stringify(fullData, null, 2));
  }, [viewMode, activeNode?.id]);

  const handleCodeChange = (val: string) => {
    setCodeViewContent(val);
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.content)) {
        if (parsed.display_settings) {
          const ds = parsed.display_settings;
          const master = ds.masterColumnOrder || ds.columnOrder || spreadsheet.allHeaders;
          spreadsheet.setMasterColumnOrder(master);
          spreadsheet.setGridData(dehydrateArrayToMap(parsed.content, ds.columnOrder || spreadsheet.allHeaders, master));
          spreadsheet.setRowCount(parsed.content.length);
          spreadsheet.setColumnAlignments(ds.columnAlignments || {});
          spreadsheet.setCellAlignments(ds.cellAlignments || {});
          spreadsheet.setHiddenColumns(ds.hiddenColumns || []);
          spreadsheet.setSelectedYear(ds.selectedYear || new Date().getFullYear().toString());
          spreadsheet.setColumnOrder(ds.columnOrder || []);
          spreadsheet.setColumnWidths(ds.columnWidths || {});
          spreadsheet.setCellMetadata(ds.cellMetadata || {});
          spreadsheet.setRowHeights(ds.rowHeights || {});
        }
      } else if (Array.isArray(parsed)) {
        spreadsheet.setGridData(dehydrateArrayToMap(parsed, spreadsheet.allHeaders, spreadsheet.masterColumnOrder));
        spreadsheet.setRowCount(parsed.length);
      }
    } catch (e) {
      // Keep codeViewContent as-is on parse error
    }
  };

  const mainPaddingClass = isFullScreen
    ? 'p-0'
    : isMobile
    ? 'p-2 pb-20'
    : 'p-1 md:p-1.5';

  return (
    <main className={`${GRID_THEME.main} relative antialiased overflow-hidden`}>
      {/* Background Particle Constellation / Mechanical Blueprint */}
      {bgStyle === 'particles' ? (
        <ParticleConstellation />
      ) : (
        <MechanicalBlueprint />
      )}

      {/* Cyber Grid Subtle Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-accent)_4%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-accent)_4%,transparent)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0 opacity-40 dark:opacity-25" />

      {/* Glowing Glassmorphic Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Blob 1: Pink/magenta blob in top-left/center area */}
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-pink-500/10 dark:bg-pink-600/5 blur-[120px] animate-blob-slow mix-blend-multiply dark:mix-blend-screen" />
        {/* Blob 2: Blue/cyan blob in bottom-right/center area */}
        <div className="absolute bottom-[10%] right-[20%] w-[500px] h-[500px] rounded-full bg-blue-500/10 dark:bg-cyan-600/5 blur-[120px] animate-blob-reverse mix-blend-multiply dark:mix-blend-screen" />
        {/* Blob 3: Purple/violet blob in middle-left area */}
        <div className="absolute top-[40%] left-[5%] w-[400px] h-[400px] rounded-full bg-purple-500/8 dark:bg-violet-600/5 blur-[120px] animate-blob-slow-alt mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {!isFullScreen && !isMobile && (
        <div className="flex h-full shrink-0 relative z-10">
          {/* Vertical Icon Rail */}
          <NavigationSidebar
            isExplorerVisible={isExplorerVisible}
            toggleSidebar={toggleSidebar}
            viewMode={viewMode === 'explorer' || viewMode === 'settings' ? 'table' : viewMode as any}
            setViewMode={setViewMode}
            setShowGlobalSearch={setShowGlobalSearch}
            selectedId={selectedId}
            setSelectedId={handleSelectId}
            setShowProfileModal={setShowProfileModal}
            profileAvatar={profileAvatar}
            handleLogout={handleLogout}
            activeNode={activeNode}
            bgStyle={bgStyle}
            setBgStyle={setBgStyle}
          />

          {/* Explorer Drawer Panel */}
          <ProjectExplorer
            tree={tree}
            selectedId={selectedId}
            setSelectedId={handleSelectId}
            addItem={addItem}
            handleRename={handleRename}
            handleDelete={handleDelete}
            isExplorerVisible={isExplorerVisible}
            setIsExplorerVisible={setIsExplorerVisible}
            isLoading={isLoading}
            setIsLoadingFile={setIsLoadingFile}
            viewMode={viewMode}
            setViewMode={setViewMode}
            comparisonIds={comparisonIds}
            toggleComparisonId={toggleComparisonId}
          />
        </div>
      )}

      <div className={`flex-1 flex flex-col overflow-hidden relative z-10 ${mainPaddingClass}`}>
        {/* Mobile Inline Settings Panel */}
        {isMobile && viewMode === 'settings' && (
          <MobileSettingsPanel
            user={user}
            profileAvatar={profileAvatar}
            setShowProfileModal={setShowProfileModal}
            bgStyle={bgStyle}
            setBgStyle={setBgStyle}
            theme={themeContext?.theme || 'dark'}
            toggleTheme={themeContext?.toggleTheme || (() => {})}
            handleLogout={handleLogout}
          />
        )}

        {/* Mobile Inline Explorer Panel */}
        {isMobile && viewMode === 'explorer' && (
          <ProjectExplorer
            tree={tree}
            selectedId={selectedId}
            setSelectedId={handleSelectId}
            addItem={addItem}
            handleRename={handleRename}
            handleDelete={handleDelete}
            isExplorerVisible={true}
            setIsExplorerVisible={() => {}}
            isLoading={isLoading}
            setIsLoadingFile={setIsLoadingFile}
            viewMode={viewMode}
            setViewMode={setViewMode}
            comparisonIds={comparisonIds}
            toggleComparisonId={toggleComparisonId}
            isMobileInline={true}
          />
        )}

        {/* Standard Editor Layout (Grid, JSON, Compare, Logs, Trash) */}
        {(!isMobile || (viewMode !== 'settings' && viewMode !== 'explorer')) && (
          activeNode || viewMode === 'logs' || viewMode === 'trash' ? (
            <div className={`${GRID_THEME.editorContainer} ${isFullScreen ? 'bg-card/25 backdrop-blur-md relative' : 'bg-card/45 backdrop-blur-lg border border-border/50 rounded-xl shadow-lg relative'} transition-all duration-300`}>
              {/* Ambient top light glow reflection */}
              {!isFullScreen && (
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-t-xl opacity-75 z-50 pointer-events-none" />
              )}
              {/* Toolbar Header */}
              {!isFullScreen && (
                <DashboardHeader
                  viewMode={viewMode === 'explorer' || viewMode === 'settings' ? 'table' : viewMode as any}
                  setViewMode={setViewMode}
                  activeNode={activeNode}
                  isFullScreen={isFullScreen}
                  setIsFullScreen={setIsFullScreen}
                  selectedId={selectedId}
                  comparisonIds={comparisonIds}
                  handleShare={handleShareCustom}
                  handleSave={spreadsheet.handleSave}
                  isSaving={spreadsheet.isSaving}
                  hasUnsavedChanges={spreadsheet.hasUnsavedChanges}
                />
              )}

              {/* Main Content Area */}
              <DashboardMainArea
                viewMode={viewMode === 'explorer' || viewMode === 'settings' ? 'table' : viewMode as any}
                isFullScreen={isFullScreen}
                setIsFullScreen={setIsFullScreen}
                activeNode={activeNode}
                isSystemOnline={isSystemOnline}
                setIsSyncModalOpen={setIsSyncModalOpen}
                codeViewContent={codeViewContent}
                handleCodeChange={handleCodeChange}
                zoom={zoom}
                setZoom={setZoom}
                containerHeight={containerHeight}
                setContainerHeight={setContainerHeight}
                onMeasuredHeight={onMeasuredHeight}
                setViewMode={setViewMode}
                selectedId={selectedId}
                isSidebarMoving={isSidebarMoving}
                isFreezeHeaders={isFreezeHeaders}
                setIsFreezeHeaders={setIsFreezeHeaders}
                isFreezePanes={isFreezePanes}
                setIsFreezePanes={setIsFreezePanes}
                spreadsheet={spreadsheet}
                isLoadingFile={isLoadingFile}
                loadProgress={loadProgress}
                comparisonIds={comparisonIds}
                tree={tree}
                toggleComparisonId={toggleComparisonId}
                setComparisonIds={setComparisonIds}
                auditLogsProps={{ auditLogs, isLoadingLogs, hasMoreLogs, fetchAuditLogs }}
                deletedNodes={deletedNodes}
                handleRestore={handleRestore}
                handlePermanentDelete={handlePermanentDelete}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted">
              <Folder size={48} className="mb-4 opacity-10" />
              <p>Select a file to start data entry.</p>
              {!isExplorerVisible && !isMobile && (
                <button
                  onClick={() => toggleSidebar(true)}
                  className="md:hidden mt-4 flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg font-bold text-sm shadow-sm"
                >
                  <PanelLeftOpen size={16} /> Open Sidebar
                </button>
              )}
              {isMobile && (
                <button
                  onClick={() => setViewMode('explorer')}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg font-bold text-sm shadow-sm"
                >
                  Open Files Tree
                </button>
              )}
            </div>
          )
        )}

        {/* Mobile Bottom Navigation Bar */}
        {isMobile && !isFullScreen && (
          <div className="fixed bottom-0 left-0 right-0 h-16 bg-card/85 backdrop-blur-xl border-t border-border/40 flex items-center justify-around z-50 px-4 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:hidden">
            {/* Explorer (Files) Tab */}
            <button 
              onClick={() => setViewMode('explorer')} 
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${viewMode === 'explorer' ? 'text-accent font-bold animate-pulse' : 'text-muted'}`}
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
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${viewMode === 'logs' ? 'text-purple-500 font-bold animate-pulse' : 'text-muted'}`}
            >
              <History size={18} />
              <span className="text-[9px] font-semibold tracking-tighter">Logs</span>
            </button>

            {/* Trash Tab */}
            <button 
              onClick={() => setViewMode('trash')} 
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${viewMode === 'trash' ? 'text-orange-500 font-bold animate-pulse' : 'text-muted'}`}
            >
              <Trash2 size={18} />
              <span className="text-[9px] font-semibold tracking-tighter">Trash</span>
            </button>

            {/* Settings Tab */}
            <button 
              onClick={() => setViewMode('settings')} 
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors cursor-pointer ${viewMode === 'settings' ? 'text-accent font-bold' : 'text-muted'}`}
            >
              <User size={18} />
              <span className="text-[9px] font-semibold tracking-tighter">Settings</span>
            </button>
          </div>
        )}

        {/* Modals & Overlays */}
        <DashboardModals
          user={user}
          spreadsheet={spreadsheet}
          showProfileModal={showProfileModal}
          setShowProfileModal={setShowProfileModal}
          profileAvatar={profileAvatar}
          setProfileAvatar={setProfileAvatar}
          showGlobalSearch={showGlobalSearch}
          setShowGlobalSearch={setShowGlobalSearch}
          setSelectedId={handleSelectId}
          setViewMode={setViewMode}
          isSyncModalOpen={isSyncModalOpen}
          setIsSyncModalOpen={setIsSyncModalOpen}
          fetchFiles={fetchFiles}
          explorerDialog={explorerDialog}
          setExplorerDialog={setExplorerDialog}
          confirmDelete={confirmDelete}
          confirmPermanentDelete={confirmPermanentDelete}
          confirmRename={(id, name) => { if (name) confirmRename(id, name); }}
          confirmAdd={(nodeType, name, parentId) => { if (name) confirmAdd(nodeType, name, parentId); }}
        />

        <CustomDialog
          isOpen={pendingSelectId !== null}
          type="confirm"
          title="Unsaved Changes"
          message="You have unsaved changes in the current file. Do you want to discard them and open the other file?"
          confirmText="Discard Changes"
          cancelText="Keep Editing"
          isDestructive={true}
          onConfirm={() => {
            setSelectedId(pendingSelectId);
            setPendingSelectId(null);
          }}
          onCancel={() => {
            setPendingSelectId(null);
          }}
        />
      </div>
    </main>
  );
});

DashboardContent.displayName = 'DashboardContent';

const decodeJwt = (token: string) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

let authInitPromise: Promise<{ data: { session: Session | null }; error: any }> | null = null;

const getInitialSession = () => {
  if (!authInitPromise) {
    authInitPromise = supabase.auth.getSession();
  }
  return authInitPromise;
};

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'unauthorized' | 'ready'>('loading');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('meo-theme') as 'light' | 'dark';
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    }
    return 'dark';
  });
  const isTransitioning = useRef(false);

  // Theme Management
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('meo-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    if (isTransitioning.current) return;
    const next = theme === 'light' ? 'dark' : 'light';
    // @ts-ignore
    if (!document.startViewTransition) {
      setTheme(next);
      return;
    }
    isTransitioning.current = true;
    // @ts-ignore
    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });
    transition.finished.finally(() => { isTransitioning.current = false; });
  }, [theme]);

  // Auth Management
  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const checkAuth = async (currentSession: Session | null, event?: string) => {
      if (event === 'SIGNED_OUT') {
        authInitPromise = null;
        localStorage.removeItem('meo-offline-session');
        if (isMounted) { setSession(null); setStatus('unauthorized'); }
        return;
      }

      if (!currentSession) {
        const cachedSessionStr = localStorage.getItem('meo-offline-session');
        if (cachedSessionStr) {
          try {
            const cachedSession = JSON.parse(cachedSessionStr);
            const isExpired = cachedSession?.expires_at
              ? (Date.now() / 1000) > cachedSession.expires_at
              : true;
            if (!isExpired && cachedSession?.access_token) {
              const payload = decodeJwt(cachedSession.access_token);
              if (payload && payload.app_metadata?.role === 'admin') {
                const reconstructedSession: Session = {
                  access_token: cachedSession.access_token,
                  token_type: 'bearer',
                  expires_in: cachedSession.expires_at - Math.floor(Date.now() / 1000),
                  expires_at: cachedSession.expires_at,
                  refresh_token: '',
                  user: {
                    id: payload.sub || '',
                    email: payload.email || '',
                    app_metadata: payload.app_metadata || {},
                    user_metadata: payload.user_metadata || {},
                    aud: payload.aud || 'authenticated',
                    created_at: payload.created_at || ''
                  }
                };
                if (isMounted) { setSession(reconstructedSession); setStatus('ready'); }
                return;
              }
            }
          } catch (e) {
            console.error('Failed to parse cached offline session:', e);
          }
        }
        if (isMounted) { setSession(null); setStatus('unauthorized'); }
        return;
      }

      const isAuthorized = currentSession.user?.app_metadata?.role === 'admin';
      if (!isAuthorized) {
        try {
          await supabase.auth.signOut();
          alert('Access Denied: This account does not have administrator privileges for the MEO Data Entry system.');
        } catch (e) {
          console.error('Sign out during unauthorized access check failed', e);
        } finally {
          authInitPromise = null;
          localStorage.removeItem('meo-offline-session');
          if (isMounted) { setSession(null); setStatus('unauthorized'); }
        }
      } else {
        localStorage.setItem('meo-offline-session', JSON.stringify({
          access_token: currentSession.access_token,
          expires_at: currentSession.expires_at
        }));
        if (isMounted) { setSession(currentSession); setStatus('ready'); }
      }
    };

    const init = async () => {
      let initSession: Session | null = null;
      try {
        const { data } = await getInitialSession();
        initSession = data.session;
      } catch (err) {
        console.warn('Failed to get initial session from Supabase (offline?):', err);
      }
      if (!isMounted) return;
      await checkAuth(initSession);
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!isMounted) return;
        await checkAuth(newSession, event);
      });
      subscription = sub;
    };

    init();
    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted text-xs font-black uppercase tracking-[0.3em] animate-pulse">
        Verifying Encrypted Session...
      </div>
    );
  }

  if (!session || status === 'unauthorized') {
    return (
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <LoginPage />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted font-sans animate-pulse uppercase tracking-widest text-xs font-black">Loading Dashboard...</div>}>
        <DashboardContent user={session.user} />
      </Suspense>
    </ThemeContext.Provider>
  );
}
