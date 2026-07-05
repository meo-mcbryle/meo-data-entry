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
import { Folder, PanelLeftOpen } from 'lucide-react';

import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useFileExplorer } from '@/hooks/useFileExplorer';
import { useProfile } from '@/hooks/useProfile';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useSpreadsheetOperations } from '@/hooks/useSpreadsheetOperations';

const DashboardContent = React.memo(({ user }: { user: SupabaseUser }) => {
  const [viewMode, setViewMode] = useState<'code' | 'table' | 'compare' | 'logs' | 'trash'>('table');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [codeViewContent, setCodeViewContent] = useState<string>('');
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [isSystemOnline, setIsSystemOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

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

  // Sync URL share link to selected file
  useEffect(() => {
    const urlId = searchParams.get('id');
    if (urlId) setSelectedId(urlId);
  }, [searchParams, setSelectedId]);

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

  return (
    <main className={`${GRID_THEME.main} relative antialiased`}>
      {!isFullScreen && (
        <div className="flex h-full shrink-0 relative">
          {/* Vertical Icon Rail */}
          <NavigationSidebar
            isExplorerVisible={isExplorerVisible}
            toggleSidebar={toggleSidebar}
            viewMode={viewMode}
            setViewMode={setViewMode}
            setShowGlobalSearch={setShowGlobalSearch}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            setShowProfileModal={setShowProfileModal}
            profileAvatar={profileAvatar}
            handleLogout={handleLogout}
            activeNode={activeNode}
          />

          {/* Explorer Drawer Panel */}
          <ProjectExplorer
            tree={tree}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
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

      <div className={`flex-1 flex flex-col overflow-hidden ${isFullScreen ? 'p-0' : 'p-1 md:p-1.5'}`}>
        {/* Floating Mobile Toggle Button */}
        {!isFullScreen && !isExplorerVisible && (
          <button
            onClick={() => toggleSidebar(true)}
            className="md:hidden fixed bottom-6 left-6 z-60 p-4 bg-accent text-accent-foreground rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <PanelLeftOpen size={24} />
          </button>
        )}

        {activeNode || viewMode === 'logs' || viewMode === 'trash' ? (
          <div className={`${GRID_THEME.editorContainer} ${isFullScreen ? 'bg-card' : 'bg-card border border-border rounded-xl shadow-sm'}`}>
            {/* Toolbar Header (hidden in fullscreen — fullscreen uses FullscreenHeader inside DashboardMainArea) */}
            {!isFullScreen && (
              <DashboardHeader
                viewMode={viewMode}
                setViewMode={setViewMode}
                activeNode={activeNode}
                isFullScreen={isFullScreen}
                setIsFullScreen={setIsFullScreen}
                selectedId={selectedId}
                comparisonIds={comparisonIds}
                handleShare={handleShare}
                handleSave={spreadsheet.handleSave}
                isSaving={spreadsheet.isSaving}
              />
            )}

            {/* Main Content Area */}
            <DashboardMainArea
              viewMode={viewMode}
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
            {!isExplorerVisible && (
              <button
                onClick={() => toggleSidebar(true)}
                className="md:hidden mt-4 flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg font-bold text-sm shadow-sm"
              >
                <PanelLeftOpen size={16} /> Open Sidebar
              </button>
            )}
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
          setSelectedId={setSelectedId}
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
      </div>
    </main>
  );
});

DashboardContent.displayName = 'DashboardContent';

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
        localStorage.removeItem('meo-offline-session');
        if (isMounted) { setSession(null); setStatus('unauthorized'); }
        return;
      }

      if (!currentSession) {
        const cachedSessionStr = localStorage.getItem('meo-offline-session');
        if (cachedSessionStr) {
          try {
            const cachedSession = JSON.parse(cachedSessionStr);
            if (cachedSession?.user?.app_metadata?.role === 'admin') {
              if (isMounted) { setSession(cachedSession); setStatus('ready'); }
              return;
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
          localStorage.removeItem('meo-offline-session');
          if (isMounted) { setSession(null); setStatus('unauthorized'); }
        }
      } else {
        localStorage.setItem('meo-offline-session', JSON.stringify({
          user: {
            id: currentSession.user.id,
            email: currentSession.user.email,
            user_metadata: currentSession.user.user_metadata,
            app_metadata: currentSession.user.app_metadata
          },
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
