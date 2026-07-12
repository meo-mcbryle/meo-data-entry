import React from 'react';
import { AuditLogs } from '@/components/AuditLogs';
import { TrashBin } from '@/components/TrashBin';
import { TableEditor } from '@/components/TableEditor';
import { ComparisonTable } from '@/components/ComparisonTable';
import { DashboardStatusBar } from '@/components/DashboardStatusBar';
import { FullscreenHeader } from '@/components/FullscreenHeader';
import { DashboardHeader } from '@/components/DashboardHeader';
import { FileNode } from '@/lib/tree-utils';
import { TrashNode } from '@/lib/types';

type ViewMode = 'code' | 'table' | 'compare' | 'logs' | 'trash';

interface AuditLogsProps {
  auditLogs: any[];
  isLoadingLogs: boolean;
  hasMoreLogs: boolean;
  fetchAuditLogs: () => void;
}

interface DashboardMainAreaProps {
  viewMode: ViewMode;
  isFullScreen: boolean;
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  activeNode: FileNode | null;
  isSystemOnline: boolean;
  setIsSyncModalOpen: (open: boolean) => void;
  // Code view
  codeViewContent: string;
  handleCodeChange: (val: string) => void;
  // Table view
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  containerHeight: number;
  setContainerHeight: React.Dispatch<React.SetStateAction<number>>;
  onMeasuredHeight: (index: number, height: number) => void;
  setViewMode: (mode: ViewMode) => void;
  selectedId: string | null;
  isSidebarMoving: boolean;
  isFreezeHeaders: boolean;
  setIsFreezeHeaders: React.Dispatch<React.SetStateAction<boolean>>;
  isFreezePanes: boolean;
  setIsFreezePanes: React.Dispatch<React.SetStateAction<boolean>>;
  spreadsheet: any;
  // File loading state (from useFileExplorer, not returned by spreadsheet hook)
  isLoadingFile: boolean;
  loadProgress: number;
  // Compare view
  comparisonIds: string[];
  tree: FileNode[];
  toggleComparisonId: (id: string) => void;
  setComparisonIds: React.Dispatch<React.SetStateAction<string[]>>;
  // Logs view
  auditLogsProps: AuditLogsProps;
  // Trash view
  deletedNodes: TrashNode[];
  handleRestore: (id: string) => void;
  handlePermanentDelete: (id: string) => void;
}

export const DashboardMainArea = React.memo(({
  viewMode,
  isFullScreen,
  setIsFullScreen,
  activeNode,
  isSystemOnline,
  setIsSyncModalOpen,
  codeViewContent,
  handleCodeChange,
  zoom,
  setZoom,
  containerHeight,
  setContainerHeight,
  onMeasuredHeight,
  setViewMode,
  selectedId,
  isSidebarMoving,
  isFreezeHeaders,
  setIsFreezeHeaders,
  isFreezePanes,
  setIsFreezePanes,
  spreadsheet,
  isLoadingFile,
  loadProgress,
  comparisonIds,
  tree,
  toggleComparisonId,
  setComparisonIds,
  auditLogsProps,
  deletedNodes,
  handleRestore,
  handlePermanentDelete,
}: DashboardMainAreaProps) => {
  const handleShare = React.useCallback(() => {
    if (!selectedId) return;
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/?id=${selectedId}`;
      navigator.clipboard.writeText(url);
      spreadsheet?.setSpreadsheetDialog?.({
        type: 'alert',
        title: 'Link Copied',
        message: 'Shareable link copied to clipboard!',
        onConfirm: () => { }
      });
    }
  }, [selectedId, spreadsheet]);

  const [activeRibbonTab, setActiveRibbonTab] = React.useState<'home' | 'insert' | 'formulas' | 'data' | 'view' | 'tools'>('home');

  if (viewMode === 'logs') {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {isFullScreen ? (
          <FullscreenHeader
            viewMode="logs"
            activeNode={activeNode}
            onExitFullscreen={() => setIsFullScreen(false)}
          />
        ) : (
          <DashboardHeader
            viewMode="logs"
            setViewMode={setViewMode}
            activeNode={activeNode}
            isFullScreen={isFullScreen}
            setIsFullScreen={setIsFullScreen}
            selectedId={selectedId}
            comparisonIds={comparisonIds}
            handleShare={handleShare}
            handleSave={spreadsheet?.handleSave}
            isSaving={spreadsheet?.isSaving}
            hasUnsavedChanges={spreadsheet?.hasUnsavedChanges}
          />
        )}
        <AuditLogs
          isLoadingLogs={auditLogsProps.isLoadingLogs}
          auditLogs={auditLogsProps.auditLogs}
          fetchAuditLogs={auditLogsProps.fetchAuditLogs}
          hasMoreLogs={auditLogsProps.hasMoreLogs}
        />
        <DashboardStatusBar
          isSystemOnline={isSystemOnline}
          setIsSyncModalOpen={setIsSyncModalOpen}
          isSaving={spreadsheet?.isSaving}
          hasUnsavedChanges={spreadsheet?.hasUnsavedChanges}
        />
      </div>
    );
  }

  if (viewMode === 'trash') {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {isFullScreen ? (
          <FullscreenHeader
            viewMode="trash"
            activeNode={activeNode}
            onExitFullscreen={() => setIsFullScreen(false)}
          />
        ) : (
          <DashboardHeader
            viewMode="trash"
            setViewMode={setViewMode}
            activeNode={activeNode}
            isFullScreen={isFullScreen}
            setIsFullScreen={setIsFullScreen}
            selectedId={selectedId}
            comparisonIds={comparisonIds}
            handleShare={handleShare}
            handleSave={spreadsheet?.handleSave}
            isSaving={spreadsheet?.isSaving}
            hasUnsavedChanges={spreadsheet?.hasUnsavedChanges}
          />
        )}
        <TrashBin
          deletedNodes={deletedNodes}
          handleRestore={handleRestore}
          handlePermanentDelete={handlePermanentDelete}
        />
        <DashboardStatusBar
          isSystemOnline={isSystemOnline}
          setIsSyncModalOpen={setIsSyncModalOpen}
          isSaving={spreadsheet?.isSaving}
          hasUnsavedChanges={spreadsheet?.hasUnsavedChanges}
        />
      </div>
    );
  }

  if (activeNode?.type !== 'file') return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {isFullScreen ? (
        <FullscreenHeader
          viewMode={viewMode}
          activeNode={activeNode}
          onExitFullscreen={() => setIsFullScreen(false)}
          onSave={spreadsheet.handleSave}
          isSaving={spreadsheet.isSaving}
          hasUnsavedChanges={spreadsheet.hasUnsavedChanges}
        />
      ) : (
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
          hasUnsavedChanges={spreadsheet.hasUnsavedChanges}
          activeRibbonTab={activeRibbonTab}
          setActiveRibbonTab={setActiveRibbonTab}
        />
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
          zoom={zoom}
          setZoom={setZoom}
          containerHeight={containerHeight}
          setContainerHeight={setContainerHeight}
          isFullScreen={isFullScreen}
          setIsFullScreen={setIsFullScreen}
          onMeasuredHeight={onMeasuredHeight}
          setViewMode={setViewMode}
          selectedId={selectedId}
          isSidebarMoving={isSidebarMoving}
          isFreezeHeaders={isFreezeHeaders}
          setIsFreezeHeaders={setIsFreezeHeaders}
          isFreezePanes={isFreezePanes}
          setIsFreezePanes={setIsFreezePanes}
          spreadsheet={spreadsheet}
          activeNode={activeNode}
          activeRibbonTab={activeRibbonTab}
          setActiveRibbonTab={setActiveRibbonTab}
        />
      ) : viewMode === 'compare' ? (
        <ComparisonTable
          comparisonIds={comparisonIds}
          tree={tree}
          toggleComparisonId={toggleComparisonId}
          setComparisonIds={setComparisonIds}
        />
      ) : null}

      <DashboardStatusBar
        isSystemOnline={isSystemOnline}
        setIsSyncModalOpen={setIsSyncModalOpen}
        activeNode={activeNode}
        isSaving={spreadsheet?.isSaving}
        hasUnsavedChanges={spreadsheet?.hasUnsavedChanges}
      />
    </div>
  );
});

DashboardMainArea.displayName = 'DashboardMainArea';
