import React from 'react';
import { DropdownMenu } from '@/components/DropdownMenu';
import { MediaPreviewModal } from '@/components/MediaPreviewModal';
import { ProfileModal } from '@/components/ProfileModal';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import { SyncModal } from '@/components/SyncModal';
import { CustomDialog } from '@/components/CustomDialog';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { FileNode } from '@/lib/tree-utils';

type ViewMode = 'code' | 'table' | 'compare' | 'logs' | 'trash';

type ExplorerDialog = {
  type: 'confirm-delete' | 'confirm-permanent-delete' | 'prompt-rename' | 'prompt-add';
  id: string;
  nodeType?: 'file' | 'folder';
  title: string;
  message: string;
  defaultValue?: string;
} | null;

interface DashboardModalsProps {
  // User
  user: SupabaseUser;
  // Spreadsheet (dropdown + media)
  spreadsheet: any;
  // Profile modal
  showProfileModal: boolean;
  setShowProfileModal: (open: boolean) => void;
  profileAvatar: string;
  setProfileAvatar: (url: string) => void;
  // Global search
  showGlobalSearch: boolean;
  setShowGlobalSearch: (open: boolean) => void;
  setSelectedId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  // Sync modal
  isSyncModalOpen: boolean;
  setIsSyncModalOpen: (open: boolean) => void;
  fetchFiles: () => Promise<void>;
  // Explorer custom dialog
  explorerDialog: ExplorerDialog;
  setExplorerDialog: (dialog: ExplorerDialog) => void;
  confirmDelete: (id: string) => void;
  confirmPermanentDelete: (id: string) => void;
  confirmRename: (id: string, name: string) => void;
  confirmAdd: (nodeType: 'file' | 'folder', name: string, parentId: string | null) => void;
}

const formatSize = (bytes: number | null | undefined): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const DashboardModals = React.memo(({
  user,
  spreadsheet,
  showProfileModal,
  setShowProfileModal,
  profileAvatar,
  setProfileAvatar,
  showGlobalSearch,
  setShowGlobalSearch,
  setSelectedId,
  setViewMode,
  isSyncModalOpen,
  setIsSyncModalOpen,
  fetchFiles,
  explorerDialog,
  setExplorerDialog,
  confirmDelete,
  confirmPermanentDelete,
  confirmRename,
  confirmAdd,
}: DashboardModalsProps) => {
  return (
    <>
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
        setActiveCell={spreadsheet.setActiveCell as (cell: { row: number; col: string } | null) => void}
      />

      {/* Hidden File Input for spreadsheet media uploading */}
      <input
        type="file"
        ref={spreadsheet.fileInputRef}
        onChange={spreadsheet.handleFileSelect}
        className="hidden"
        accept={spreadsheet.pendingMedia?.type === 'image' ? 'image/*' : '*/*'}
      />

      {/* Sync Manager Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncCompleted={() => fetchFiles()}
      />

      {/* Custom Dialog for Explorer actions */}
      <CustomDialog
        isOpen={!!explorerDialog}
        type={explorerDialog?.type.startsWith('prompt') ? 'prompt' : 'confirm'}
        title={explorerDialog?.title || ''}
        message={explorerDialog?.message || ''}
        defaultValue={explorerDialog?.defaultValue}
        isDestructive={
          explorerDialog?.type === 'confirm-delete' ||
          explorerDialog?.type === 'confirm-permanent-delete'
        }
        onConfirm={(val) => {
          if (!explorerDialog) return;
          if (explorerDialog.type === 'confirm-delete') {
            confirmDelete(explorerDialog.id);
          } else if (explorerDialog.type === 'confirm-permanent-delete') {
            confirmPermanentDelete(explorerDialog.id);
          } else if (explorerDialog.type === 'prompt-rename') {
            if (val) confirmRename(explorerDialog.id, val);
          } else if (explorerDialog.type === 'prompt-add') {
            if (val) confirmAdd(explorerDialog.nodeType || 'file', val, explorerDialog.id || null);
          }
        }}
        onCancel={() => setExplorerDialog(null)}
      />
      {/* Custom Dialog for Spreadsheet actions */}
      <CustomDialog
        isOpen={!!spreadsheet.spreadsheetDialog}
        type={spreadsheet.spreadsheetDialog?.type === 'prompt' ? 'prompt' : 'confirm'}
        title={spreadsheet.spreadsheetDialog?.title || 'System Message'}
        message={spreadsheet.spreadsheetDialog?.message || ''}
        defaultValue={spreadsheet.spreadsheetDialog?.defaultValue}
        confirmText={spreadsheet.spreadsheetDialog?.confirmText || (spreadsheet.spreadsheetDialog?.type === 'alert' ? 'OK' : 'Confirm')}
        cancelText={spreadsheet.spreadsheetDialog?.type === 'alert' ? '' : 'Cancel'}
        isDestructive={spreadsheet.spreadsheetDialog?.isDestructive}
        onConfirm={(val) => {
          spreadsheet.spreadsheetDialog?.onConfirm(val);
          spreadsheet.setSpreadsheetDialog(null);
        }}
        onCancel={() => spreadsheet.setSpreadsheetDialog(null)}
      />
    </>
  );
});

DashboardModals.displayName = 'DashboardModals';
