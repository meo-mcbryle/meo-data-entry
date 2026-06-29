'use client';
import React, { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { flushSync } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import { 
  hydrateMapToArray, 
  dehydrateArrayToMap 
} from '@/lib/excel-utils';
import { ProjectExplorer } from '@/components/ProjectExplorer';
import { ComparisonTable } from '@/components/ComparisonTable';
import { TrashBin } from '@/components/TrashBin';
import { AuditLogs } from '@/components/AuditLogs';
import { TableEditor } from '@/components/TableEditor';
import { ThemeContext } from '@/components/ThemeToggle';
import { LoginPage } from '@/components/LoginPage';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import { ProfileModal } from '@/components/ProfileModal';
import { NavigationSidebar } from '@/components/NavigationSidebar';
import { DropdownMenu } from '@/components/DropdownMenu';
import { MediaPreviewModal } from '@/components/MediaPreviewModal';
import { GRID_THEME } from '@/lib/constants';
import { 
  Clock, User, HardDrive, Folder, Save, Code, Table as TableIcon, Trash2, 
  Printer, Share2, PanelLeftOpen, Loader2, RefreshCcw, FileIcon, 
  Maximize2, Minimize2, History
} from 'lucide-react';

import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useFileExplorer } from '@/hooks/useFileExplorer';
import { useProfile } from '@/hooks/useProfile';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useSpreadsheetOperations } from '@/hooks/useSpreadsheetOperations';

const DashboardContent = React.memo(({ user }: { user: any }) => {
  const [viewMode, setViewMode] = useState<'code' | 'table' | 'compare' | 'logs' | 'trash'>('table');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [codeViewContent, setCodeViewContent] = useState<string>('');
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);

  // 1. Audit Logs Hook
  const {
    auditLogs,
    isLoadingLogs,
    hasMoreLogs,
    fetchAuditLogs,
    logAction
  } = useAuditLogs(user);

  // 2. File Explorer Hook
  const {
    tree,
    selectedId,
    setSelectedId,
    isLoading,
    deletedNodes,
    isLoadingFile,
    setIsLoadingFile,
    loadProgress,
    setLoadProgress,
    fetchFiles,
    addItem,
    handleRename,
    handleDelete,
    handleRestore,
    handlePermanentDelete,
    handleShare,
    activeNode
  } = useFileExplorer(user, logAction);

  // 3. Spreadsheet Operations Hook
  const spreadsheet = useSpreadsheetOperations({
    user,
    activeNode,
    selectedId,
    logAction,
    fetchFiles,
    isLoadingFile,
    setIsLoadingFile,
    loadProgress,
    setLoadProgress
  });

  // 4. Dashboard Layout Hook
  const {
    isExplorerVisible,
    setIsExplorerVisible,
    isSidebarMoving,
    containerHeight,
    setContainerHeight,
    isFullScreen,
    setIsFullScreen,
    isFreezeHeaders,
    setIsFreezeHeaders,
    isFreezePanes,
    setIsFreezePanes,
    zoom,
    setZoom,
    toggleSidebar,
    onMeasuredHeight
  } = useDashboardLayout(spreadsheet.setRowHeights);

  // 5. User Profile Hook
  const {
    showProfileModal,
    setShowProfileModal,
    profileAvatar,
    setProfileAvatar,
    handleLogout
  } = useProfile(user);

  const searchParams = useSearchParams();

  // Handle incoming share link ID from URL
  useEffect(() => {
    const urlId = searchParams.get('id');
    if (urlId) {
      setSelectedId(urlId);
    }
  }, [searchParams, setSelectedId]);

  // Fetch logs or files when view changes
  useEffect(() => {
    if (viewMode === 'logs') fetchAuditLogs();
    if (viewMode === 'trash') fetchFiles();
  }, [viewMode, fetchAuditLogs, fetchFiles]);

  const toggleComparisonId = useCallback((id: string) => {
    setComparisonIds(prev => 
      (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    );
  }, []);

  // Synchronize code view content (JSON) from state
  useEffect(() => {
    if (viewMode !== 'code' || !activeNode || activeNode.type !== 'file') return;

    const contentArray = hydrateMapToArray(
      spreadsheet.gridData,
      spreadsheet.rowCount,
      spreadsheet.allHeaders,
      spreadsheet.masterColumnOrder
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
  }, [
    viewMode,
    activeNode?.id,
    spreadsheet.gridData,
    spreadsheet.rowCount,
    spreadsheet.allHeaders,
    spreadsheet.masterColumnOrder,
    spreadsheet.columnAlignments,
    spreadsheet.cellAlignments,
    spreadsheet.hiddenColumns,
    spreadsheet.selectedYear,
    spreadsheet.columnOrder,
    spreadsheet.columnWidths,
    spreadsheet.cellMetadata,
    spreadsheet.rowHeights
  ]);

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
          spreadsheet.setSelectedYear(ds.selectedYear || '2020');
          spreadsheet.setColumnOrder(ds.columnOrder || []);
          spreadsheet.setColumnWidths(ds.columnWidths || {});
          spreadsheet.setCellMetadata(ds.cellMetadata || {});
          spreadsheet.setRowHeights(ds.rowHeights || {});
        }
      } 
      else if (Array.isArray(parsed)) {
        spreadsheet.setGridData(dehydrateArrayToMap(parsed, spreadsheet.allHeaders, spreadsheet.masterColumnOrder));
        spreadsheet.setRowCount(parsed.length);
      }
    } catch (e) {
      // Keep codeViewContent as is
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
            {!isFullScreen && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/10 overflow-x-auto no-scrollbar">
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
                      <h2 className="text-sm font-bold text-foreground truncate max-w-30 md:max-w-60">{activeNode?.name}</h2>
                    </>
                  )}
                  
                  <div className="h-4 w-px bg-border mx-1" />
                  
                  <nav className={GRID_THEME.navContainer}>
                    <button 
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${
                        viewMode === 'table' ? 'bg-card text-accent shadow-sm ring-1 ring-border' : 'text-muted hover:text-foreground'
                      }`}
                    >
                      <TableIcon size={12} /> Grid
                    </button>
                    {viewMode !== 'logs' && viewMode !== 'trash' && (
                      <button 
                        onClick={() => setViewMode('code')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${
                          viewMode === 'code' ? 'bg-card text-accent shadow-sm ring-1 ring-border' : 'text-muted hover:text-foreground'
                        }`}
                      >
                        <Code size={12} /> JSON
                      </button>
                    )}
                    {viewMode !== 'logs' && viewMode !== 'trash' && (
                      <button 
                        onClick={() => setViewMode('compare')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${
                          viewMode === 'compare' ? 'bg-card text-green-600 shadow-sm ring-1 ring-border' : 'text-muted hover:text-foreground'
                        }`}
                      >
                        <RefreshCcw size={12} /> Compare {comparisonIds.length > 0 && `(${comparisonIds.length})`}
                      </button>
                    )}
                  </nav>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {activeNode && <button onClick={() => window.open(`/print?id=${selectedId}`, '_blank')} className="p-1.5 text-muted hover:text-accent transition-colors" title="Printable Report"><Printer size={16} /></button>}
                  {activeNode && <button onClick={handleShare} className="p-1.5 text-muted hover:text-accent transition-colors" title="Copy Link"><Share2 size={16} /></button>}
                  <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1.5 text-muted hover:text-accent transition-colors" title="Toggle Focus Mode">{isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
                  <div className="h-4 w-px bg-border mx-1" />
                  {activeNode && (
                    <button 
                      onClick={spreadsheet.handleSave}
                      disabled={spreadsheet.isSaving}
                      className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-foreground rounded text-[11px] font-bold hover:opacity-90 disabled:opacity-50 shadow-sm"
                    >
                      {spreadsheet.isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      {spreadsheet.isSaving ? 'Saving...' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {viewMode === 'logs' ? (
              <div className="flex flex-col flex-1 min-h-0">
                <AuditLogs 
                  isLoadingLogs={isLoadingLogs}
                  auditLogs={auditLogs}
                  fetchAuditLogs={fetchAuditLogs}
                  hasMoreLogs={hasMoreLogs}
                />
                <footer className={GRID_THEME.statusBar}>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><User size={12} className="text-muted/40"/> LGU Admin</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live System</div>
                  </div>
                </footer>
              </div>
            ) : viewMode === 'trash' ? (
              <div className="flex flex-col flex-1 min-h-0">
                <TrashBin 
                  deletedNodes={deletedNodes}
                  handleRestore={handleRestore}
                  handlePermanentDelete={handlePermanentDelete}
                />
                <footer className={GRID_THEME.statusBar}>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><User size={12} className="text-muted/40"/> LGU Admin</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live System</div>
                  </div>
                </footer>
              </div>
            ) : (activeNode?.type === 'file' && (
              <div className="flex flex-col flex-1 min-h-0">
                {isFullScreen && (
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted shrink-0">
                      <TableIcon size={14} /> {activeNode.name}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <button 
                        onClick={spreadsheet.handleSave}
                        disabled={spreadsheet.isSaving}
                        className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-foreground rounded text-[11px] font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm"
                      >
                        {spreadsheet.isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        {spreadsheet.isSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setIsFullScreen(false)} className="text-muted hover:text-foreground p-1" title="Exit Focus Mode"><Minimize2 size={14} /></button>
                    </div>
                  </div>
                )}

                {viewMode === 'code' ? (
                  <textarea
                    value={codeViewContent}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    className="w-full h-full p-4 font-mono text-sm bg-muted/5 text-foreground rounded-lg border-0 focus:ring-2 focus:ring-accent outline-none resize-none shadow-inner"
                    placeholder='{ "content": [...], "display_settings": {...} }'
                  />
                ) : viewMode === 'table' ? (
                  <TableEditor
                    isLoadingFile={isLoadingFile}
                    loadProgress={loadProgress}
                    rowCount={spreadsheet.rowCount}
                    setRowCount={spreadsheet.setRowCount}
                    initializeExcelTemplate={spreadsheet.initializeExcelTemplate}
                    visibleHeaders={spreadsheet.visibleHeaders}
                    selection={spreadsheet.selection}
                    setSelection={spreadsheet.setSelection}
                    zoom={zoom}
                    setZoom={setZoom}
                    containerHeight={containerHeight}
                    setContainerHeight={setContainerHeight}
                    isFullScreen={isFullScreen}
                    setIsFullScreen={setIsFullScreen}
                    activeCell={spreadsheet.activeCell}
                    setActiveCell={spreadsheet.setActiveCell}
                    masterColumnOrder={spreadsheet.masterColumnOrder}
                    cellMetadata={spreadsheet.cellMetadata}
                    setCellMetadata={spreadsheet.setCellMetadata}
                    setCellFontFamily={spreadsheet.setCellFontFamily}
                    selectedYear={spreadsheet.selectedYear}
                    setSelectedYear={spreadsheet.setSelectedYear}
                    hiddenColumns={spreadsheet.hiddenColumns}
                    toggleColumnVisibility={spreadsheet.toggleColumnVisibility}
                    allHeaders={spreadsheet.allHeaders}
                    undoStack={spreadsheet.undoStack}
                    redoStack={spreadsheet.redoStack}
                    undo={spreadsheet.undo}
                    redo={spreadsheet.redo}
                    isFreezeHeaders={isFreezeHeaders}
                    setIsFreezeHeaders={setIsFreezeHeaders}
                    isFreezePanes={isFreezePanes}
                    setIsFreezePanes={setIsFreezePanes}
                    handleAddSection={spreadsheet.handleAddSection}
                    handleResetWidths={spreadsheet.handleResetWidths}
                    exportToCSV={spreadsheet.exportToCSV}
                    contextMenu={spreadsheet.contextMenu}
                    setContextMenu={spreadsheet.setContextMenu}
                    handleMergeCells={spreadsheet.handleMergeCells}
                    handleUnmergeCells={spreadsheet.handleUnmergeCells}
                    setColumnAlignment={spreadsheet.setColumnAlignment}
                    columnAlignments={spreadsheet.columnAlignments}
                    handleRenameColumn={spreadsheet.handleRenameColumn}
                    handleAddColumn={spreadsheet.handleAddColumn}
                    handleDeleteColumn={spreadsheet.handleDeleteColumn}
                    handleInsertColumn={spreadsheet.handleInsertColumn}
                    handleInsertRow={spreadsheet.handleInsertRow}
                    handleClearRow={spreadsheet.handleClearRow}
                    handleInsertSection={spreadsheet.handleInsertSection}
                    addRowToSection={spreadsheet.addRowToSection}
                    handleDeleteSection={spreadsheet.handleDeleteSection}
                    removeTableRow={spreadsheet.removeTableRow}
                    handleClearColumn={spreadsheet.handleClearColumn}
                    gridData={spreadsheet.gridData}
                    cellAlignments={spreadsheet.cellAlignments}
                    rowHeights={spreadsheet.rowHeights}
                    dragFillRange={spreadsheet.dragFillRange}
                    setDragFillRange={spreadsheet.setDragFillRange}
                    isSelecting={spreadsheet.isSelecting}
                    setIsSelecting={spreadsheet.setIsSelecting}
                    handleUpdateCell={spreadsheet.handleUpdateCell}
                    handleKeyDown={spreadsheet.handleKeyDown}
                    handleOpenContextMenu={spreadsheet.handleOpenContextMenu}
                    toggleCellAlignment={spreadsheet.toggleCellAlignment}
                    handleDragFillStart={spreadsheet.handleDragFillStart}
                    setViewingMedia={spreadsheet.setViewingMedia}
                    removeCellMetadata={spreadsheet.removeCellMetadata}
                    evaluateFormula={spreadsheet.evaluateFormula}
                    startRowResizing={spreadsheet.startRowResizing}
                    handleOpenDropdown={spreadsheet.handleOpenDropdown}
                    onMeasuredHeight={onMeasuredHeight}
                    columnWidths={spreadsheet.columnWidths}
                    startResizing={spreadsheet.startResizing}
                    handleRenameSectionBlock={spreadsheet.handleRenameSectionBlock}
                    handleFileSelect={spreadsheet.handleFileSelect}
                    pendingMedia={spreadsheet.pendingMedia}
                    fileInputRef={spreadsheet.fileInputRef}
                    formulaBarRef={spreadsheet.formulaBarRef}
                    setCellType={spreadsheet.setCellType}
                    setSelectionAlignment={spreadsheet.setSelectionAlignment}
                    insertMedia={spreadsheet.insertMedia}
                    setViewMode={setViewMode}
                    selectedId={selectedId}
                    isSidebarMoving={isSidebarMoving}
                  />
                ) : viewMode === 'compare' ? (
                  <ComparisonTable
                    comparisonIds={comparisonIds}
                    tree={tree}
                    toggleComparisonId={toggleComparisonId}
                    setComparisonIds={setComparisonIds}
                  />
                ) : null}

                {/* High-density Status Bar */}
                <footer className={GRID_THEME.statusBar}>
                  <div className="flex items-center gap-4">
                    {activeNode && (
                      <>
                        <div className="flex items-center gap-1.5"><Clock size={12} className="text-muted/40"/> Created {new Date(activeNode.created_at).toLocaleDateString()}</div>
                        <div className="h-3 w-px bg-border" />
                      </>
                    )}
                    <div className="flex items-center gap-1.5"><User size={12} className="text-muted/40"/> LGU Admin</div>
                  </div>
                  <div className="flex items-center gap-4">
                    {activeNode && (
                      <div className="flex items-center gap-1.5"><HardDrive size={12} className="text-muted/40"/> {formatSize(activeNode.size_bytes)}</div>
                    )}
                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live System</div>
                  </div>
                </footer>
              </div>
            ))}
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

        {/* Custom Dropdown Menu */}
        <DropdownMenu
          dropdownMenu={spreadsheet.dropdownMenu}
          setDropdownMenu={spreadsheet.setDropdownMenu}
          masterColumnOrder={spreadsheet.masterColumnOrder}
          cellMetadata={spreadsheet.cellMetadata}
          gridData={spreadsheet.gridData}
          handleUpdateCell={spreadsheet.handleUpdateCell}
        />

        {/* Media Preview Modal */}
        <MediaPreviewModal
          viewingMedia={spreadsheet.viewingMedia}
          setViewingMedia={spreadsheet.setViewingMedia}
          insertMedia={spreadsheet.insertMedia}
          deleteAttachment={spreadsheet.deleteAttachment}
          formatSize={formatSize}
        />

        {/* Profile Settings Modal */}
        <ProfileModal
          user={user}
          showProfileModal={showProfileModal}
          setShowProfileModal={setShowProfileModal}
          profileAvatar={profileAvatar}
          setProfileAvatar={setProfileAvatar}
        />

        {/* Global Entry Search Modal */}
        <GlobalSearchModal
          showGlobalSearch={showGlobalSearch}
          setShowGlobalSearch={setShowGlobalSearch}
          setSelectedId={setSelectedId}
          setViewMode={setViewMode}
        />
        
        {/* Hidden File Input for spreadsheet media uploading */}
        <input 
          type="file" 
          ref={spreadsheet.fileInputRef} 
          onChange={spreadsheet.handleFileSelect} 
          className="hidden" 
          accept={spreadsheet.pendingMedia?.type === 'image' ? 'image/*' : '*/*'}
        />
      </div>
    </main>
  );
});

DashboardContent.displayName = 'DashboardContent';

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'unauthorized' | 'ready'>('loading');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('meo-theme') as 'light' | 'dark';
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
    }
    return 'dark';
  });
  const isTransitioning = useRef(false);

  // Theme Management Logic
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
      flushSync(() => {
        setTheme(next);
      });
    });

    transition.finished.finally(() => {
      isTransitioning.current = false;
    });
  }, [theme]);
  
  useEffect(() => {
    const checkAuth = async (currentSession: any) => {
      if (!currentSession) {
        setSession(null);
        setStatus('unauthorized');
        return;
      }

      const isAuthorized = currentSession.user?.app_metadata?.role === 'admin';
      
      if (!isAuthorized) {
        try {
          await supabase.auth.signOut();
          alert("Access Denied: This account does not have administrator privileges for the MEO Data Entry system.");
        } catch (e) {
          console.error("Sign out during unauthorized access check failed", e);
        } finally {
          setSession(null);
          setStatus('unauthorized');
        }
      } else {
        setSession(currentSession);
        setStatus('ready');
      }
    };

    supabase.auth.getSession().then(({ data: { session: initSession } }) => checkAuth(initSession));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => checkAuth(newSession));

    return () => subscription.unsubscribe();
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted text-xs font-black uppercase tracking-[0.3em] animate-pulse">
        Verifying Encrypted Session...
      </div>
    );
  }

  if (!session || status === 'unauthorized') return <LoginPage />;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted font-sans animate-pulse uppercase tracking-widest text-xs font-black">Loading Dashboard...</div>}>
        <DashboardContent user={session.user} />
      </Suspense>
    </ThemeContext.Provider>
  );
}
