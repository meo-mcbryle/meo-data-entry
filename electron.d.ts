// Type declarations for Electron preload API exposed via contextBridge
interface Window {
  electronAPI?: {
    getVersion: () => Promise<string>;
    getSystemInfo: () => Promise<{ osUsername: string; osPlatform: string; osType: string; osRelease?: string; friendlyOS?: string }>;
    checkForUpdates: () => Promise<{ status?: string; success?: boolean; message?: string }>;
    downloadUpdate: () => Promise<{ success: boolean; message?: string }>;
    installUpdate: () => void;
    safeEncrypt: (plainText: string) => Promise<string>;
    safeDecrypt: (encryptedBase64: string) => Promise<string>;
    updateUnsavedStatus: (hasUnsavedChanges: boolean) => void;
    onAttemptClose: (callback: () => void) => () => void;
    confirmClose: () => void;
    onUpdateStatus: (callback: (data: UpdateStatusPayload) => void) => () => void;
  };
}

interface UpdateStatusPayload {
  status:
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'dev-mode';
  version?: string;
  releaseNotes?: string | null;
  releaseDate?: string | null;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  message?: string;
}
