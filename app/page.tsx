'use client';
import React, { useEffect, useCallback, Suspense, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';
import { ProjectExplorer } from '@/components/ProjectExplorer';
import { ThemeContext } from '@/components/ThemeToggle';
import { LoginPage } from '@/components/LoginPage';
import { NavigationSidebar } from '@/components/NavigationSidebar';
import { UpdateModal } from '@/components/UpdateModal';
import { DashboardMainArea } from '@/components/DashboardMainArea';
import { DashboardModals } from '@/components/DashboardModals';
import { GRID_THEME } from '@/lib/constants';
import { Folder, PanelLeftOpen } from 'lucide-react';
import { CustomDialog } from '@/components/CustomDialog';
import { MobileSettingsPanel } from '@/components/MobileSettingsPanel';
import { DashboardBackground } from '@/components/DashboardBackground';
import { MobileNavigation } from '@/components/MobileNavigation';

// Hooks
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useFileExplorer } from '@/hooks/useFileExplorer';
import { useProfile } from '@/hooks/useProfile';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useSpreadsheetOperations } from '@/hooks/useSpreadsheetOperations';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useSystemConnectivity } from '@/hooks/useSystemConnectivity';
import { useCodeView } from '@/hooks/useCodeView';
import { useDashboardState } from '@/hooks/useDashboardState';

const DashboardContent = React.memo(({ 
  user,
  updateAvailable,
  onShowUpdate
}: { 
  user: SupabaseUser;
  updateAvailable: boolean;
  onShowUpdate: (show: boolean) => void;
}) => {
  const themeContext = React.useContext(ThemeContext);

  // Layout & UI State Hook
  const {
    isMobile,
    viewMode,
    setViewMode,
    bgStyle,
    setBgStyle,
    showGlobalSearch,
    setShowGlobalSearch,
    pendingSelectId,
    setPendingSelectId,
    comparisonIds,
    setComparisonIds,
    toggleComparisonId
  } = useDashboardState();

  // System Connectivity Hook
  const {
    isSystemOnline,
    isSyncModalOpen,
    setIsSyncModalOpen
  } = useSystemConnectivity();

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
  }, [selectedId, spreadsheet.hasUnsavedChanges, setSelectedId, setPendingSelectId]);

  const handleShareCustom = useCallback(() => {
    if (!selectedId) return;
    const url = `${window.location.origin}/?id=${selectedId}`;
    navigator.clipboard.writeText(url);
    spreadsheet.setSpreadsheetDialog({
      type: 'alert',
      title: 'Link Copied',
      message: 'Shareable link copied to clipboard!',
      onConfirm: () => { }
    });
  }, [selectedId, spreadsheet.setSpreadsheetDialog]);

  // Sync URL share link to selected file
  useEffect(() => {
    const urlId = searchParams.get('id');
    if (urlId) handleSelectId(urlId);
  }, [searchParams, handleSelectId]);

  // Log login action if manual login was attempted
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLoginAttempt = sessionStorage.getItem('meo-auth-login-attempt');
      if (isLoginAttempt === 'true') {
        sessionStorage.removeItem('meo-auth-login-attempt');
        
        const logLoginDetails = async () => {
          const isElectron = 'electronAPI' in window || (navigator.userAgent && navigator.userAgent.includes('Electron'));
          
          let ipAddress = 'Unknown';
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
            const ipRes = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
            clearTimeout(timeoutId);
            const ipData = await ipRes.json();
            ipAddress = ipData.ip;
          } catch (e) {
            console.warn('Failed to retrieve IP address:', e);
          }

          if (isElectron) {
            let osUsername = 'Unknown';
            let osPlatform = 'Unknown';
            let osType = 'Unknown';
            
            if ('electronAPI' in window && (window as any).electronAPI.getSystemInfo) {
              try {
                const sysInfo = await (window as any).electronAPI.getSystemInfo();
                osUsername = sysInfo.osUsername;
                osPlatform = sysInfo.osPlatform;
                osType = sysInfo.osType;
              } catch (e) {
                console.error('Failed to fetch Electron system details:', e);
              }
            }

            logAction('USER_LOGIN', null, {
              platform: 'Desktop App',
              os_username: osUsername,
              operating_system: `${osType} (${osPlatform})`,
              ip_address: ipAddress
            });
          } else {
            const getBrowserName = () => {
              const ua = navigator.userAgent || '';
              if (ua.includes('Firefox')) return 'Firefox';
              if (ua.includes('SamsungBrowser')) return 'Samsung Browser';
              if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
              if (ua.includes('Trident')) return 'Internet Explorer';
              if (ua.includes('Edge') || ua.includes('Edg')) return 'Microsoft Edge';
              if (ua.includes('Chrome')) return 'Chrome';
              if (ua.includes('Safari')) return 'Safari';
              return 'Unknown Browser';
            };

            logAction('USER_LOGIN', null, {
              platform: 'Web Dashboard',
              browser: getBrowserName(),
              ip_address: ipAddress
            });
          }
        };

        logLoginDetails();
      }
    }
  }, [logAction]);

  // Fetch logs or files when view changes
  useEffect(() => {
    if (viewMode === 'logs') fetchAuditLogs();
    if (viewMode === 'trash') fetchFiles();
  }, [viewMode, fetchAuditLogs, fetchFiles]);

  // Code View JSON Hook
  const { codeViewContent, handleCodeChange } = useCodeView({
    viewMode,
    activeNode,
    spreadsheet
  });

  const mainPaddingClass = isFullScreen
    ? 'p-0'
    : isMobile
      ? 'p-2 pb-20'
      : 'p-1 md:p-1.5';

  return (
    <main className={`${GRID_THEME.main} relative antialiased overflow-hidden`}>
      <DashboardBackground bgStyle={bgStyle} />

      {!isFullScreen && !isMobile && (
        <div className="flex h-full shrink-0 relative z-20">
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
            updateAvailable={updateAvailable}
            onShowUpdate={onShowUpdate}
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
            toggleTheme={themeContext?.toggleTheme || (() => { })}
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
            setIsExplorerVisible={() => { }}
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
            <div className={`container-enter ${GRID_THEME.editorContainer} ${isFullScreen ? 'bg-card/25 backdrop-blur-md relative' : 'bg-card/45 backdrop-blur-lg border border-border/50 rounded-xl shadow-lg relative'} transition-[background-color,backdrop-filter] duration-300`}>
              {/* Ambient top light glow reflection */}
              {!isFullScreen && (
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-t-xl opacity-75 z-50 pointer-events-none" />
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

        <MobileNavigation
          isMobile={isMobile}
          isFullScreen={isFullScreen}
          viewMode={viewMode}
          setViewMode={setViewMode}
          activeNode={activeNode}
        />

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

export default function Dashboard() {
  const { session, status, theme, toggleTheme } = useAuthSession();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Listen for update status events globally
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.onUpdateStatus) return;
    const cleanup = window.electronAPI.onUpdateStatus((data) => {
      if (data.status === 'available') setUpdateAvailable(true);
      if (data.status === 'downloaded') setUpdateAvailable(true);
      if (data.status === 'not-available') setUpdateAvailable(false);
    });

    // Proactively check for updates immediately
    window.electronAPI.checkForUpdates().catch(() => {});

    return cleanup;
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
        <LoginPage updateAvailable={updateAvailable} onShowUpdate={setShowUpdateModal} />
        <UpdateModal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted font-sans animate-pulse uppercase tracking-widest text-xs font-black">Loading Dashboard...</div>}>
        <DashboardContent 
          user={session.user} 
          updateAvailable={updateAvailable}
          onShowUpdate={setShowUpdateModal}
        />
      </Suspense>
      <UpdateModal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} />
    </ThemeContext.Provider>
  );
}
