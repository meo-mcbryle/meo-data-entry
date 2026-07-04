'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  Download, RefreshCw, Zap, X, CheckCircle2, AlertTriangle,
  ArrowDownCircle, Loader2, Shield
} from 'lucide-react';

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdateInfo {
  version?: string;
  releaseNotes?: string | null;
  releaseDate?: string | null;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  message?: string;
}

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bps?: number): string {
  if (!bps) return '';
  return `${formatBytes(bps)}/s`;
}

export const UpdateModal = ({ isOpen, onClose }: UpdateModalProps) => {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [info, setInfo] = useState<UpdateInfo>({});
  const cleanupRef = useRef<(() => void) | null>(null);

  // Register IPC listener on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.onUpdateStatus) return;

    const cleanup = window.electronAPI.onUpdateStatus((data) => {
      setStatus(data.status as UpdateStatus);
      setInfo({
        version: data.version,
        releaseNotes: typeof data.releaseNotes === 'string' ? data.releaseNotes : undefined,
        releaseDate: data.releaseDate ?? undefined,
        percent: data.percent,
        transferred: data.transferred,
        total: data.total,
        bytesPerSecond: data.bytesPerSecond,
        message: data.message,
      });
    });

    cleanupRef.current = cleanup;
    return () => { cleanup(); };
  }, []);

  // Check for updates when the modal opens and we're in idle state
  useEffect(() => {
    if (!isOpen) return;
    if (status === 'idle') handleCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCheck = async () => {
    if (!window.electronAPI?.checkForUpdates) {
      // Not in a packaged Electron env — just show up-to-date
      setStatus('checking');
      setInfo({});
      setTimeout(() => setStatus('not-available'), 600);
      return;
    }
    setStatus('checking');
    setInfo({});
    const result = await window.electronAPI.checkForUpdates();
    // dev-mode: main process skips the real check and returns early
    if (result?.status === 'dev-mode') {
      setStatus('not-available');
    }
  };

  const handleDownload = async () => {
    if (!window.electronAPI?.downloadUpdate) return;
    setStatus('downloading');
    setInfo(prev => ({ ...prev, percent: 0 }));
    await window.electronAPI.downloadUpdate();
  };

  const handleInstall = () => {
    window.electronAPI?.installUpdate?.();
  };

  if (!isOpen) return null;

  const progress = info.percent ?? 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, var(--surface, #1a1a2e) 0%, var(--surface2, #16213e) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Top accent bar */}
        <div
          className="h-[3px] w-full"
          style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Software Update</h2>
              <p className="text-[11px] text-muted">MEO Data Entry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 flex flex-col gap-5">
          {/* Status Area */}
          <StatusDisplay status={status} info={info} progress={progress} />

          {/* Action Buttons */}
          <ActionButtons
            status={status}
            onCheck={handleCheck}
            onDownload={handleDownload}
            onInstall={handleInstall}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Status Display ───────────────────────────────────────────────────────────

function StatusDisplay({ status, info, progress }: {
  status: UpdateStatus;
  info: UpdateInfo;
  progress: number;
}) {
  return (
    <div>
      {status === 'idle' && <IdleState />}
      {status === 'checking' && <CheckingState />}
      {status === 'not-available' && <UpToDateState />}
      {status === 'available' && <AvailableState info={info} />}
      {status === 'downloading' && <DownloadingState info={info} progress={progress} />}
      {status === 'downloaded' && <ReadyToInstallState info={info} />}
      {status === 'error' && <ErrorState info={info} />}
    </div>
  );
}

function IdleState() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <RefreshCw size={24} className="text-indigo-400" />
      </div>
      <p className="text-sm text-muted text-center">Ready to check for available updates.</p>
    </div>
  );
}

function CheckingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <Loader2 size={24} className="text-indigo-400 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Checking for updates…</p>
        <p className="text-[11px] text-muted mt-1">Connecting to update server</p>
      </div>
    </div>
  );
}

function UpToDateState() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <CheckCircle2 size={24} className="text-emerald-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">You're up to date!</p>
        <p className="text-[11px] text-muted mt-1">No new updates are available right now.</p>
      </div>
    </div>
  );
}

function AvailableState({ info }: { info: UpdateInfo }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
          <ArrowDownCircle size={22} className="text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Version {info.version} is available
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            A new version of MEO Data Entry is ready to download.
          </p>
          {info.releaseDate && (
            <p className="text-[10px] text-muted/60 mt-1">
              Released: {new Date(info.releaseDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>
      {info.releaseNotes && (
        <div
          className="rounded-xl p-3 text-[11px] text-muted leading-relaxed max-h-24 overflow-y-auto"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {info.releaseNotes}
        </div>
      )}
    </div>
  );
}

function DownloadingState({ info, progress }: { info: UpdateInfo; progress: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
          <Download size={18} className="text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-foreground">Downloading update…</p>
            <span className="text-sm font-bold text-cyan-400 tabular-nums">{progress}%</span>
          </div>
          <p className="text-[11px] text-muted truncate">
            {formatBytes(info.transferred)} of {formatBytes(info.total)}
            {info.bytesPerSecond ? <> &mdash; {formatSpeed(info.bytesPerSecond)}</> : null}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.08)' }}>
        {/* Animated shimmer */}
        <div
          className="absolute inset-0 rounded-full opacity-30"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
        {/* Fill */}
        <div
          className="h-full rounded-full transition-all duration-300 ease-out relative"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
            boxShadow: '0 0 12px rgba(99,102,241,0.6)',
          }}
        />
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

function ReadyToInstallState({ info }: { info: UpdateInfo }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <Zap size={24} className="text-emerald-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
          <CheckCircle2 size={10} className="text-white" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">
          Version {info.version} downloaded
        </p>
        <p className="text-[11px] text-muted mt-1">
          The update is ready. Restart the app to apply it.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ info }: { info: UpdateInfo }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <AlertTriangle size={24} className="text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Update failed</p>
        {info.message && (
          <p className="text-[11px] text-muted mt-1 max-w-xs break-words">{info.message}</p>
        )}
      </div>
    </div>
  );
}

// ─── Action Buttons ───────────────────────────────────────────────────────────

function ActionButtons({ status, onCheck, onDownload, onInstall, onClose }: {
  status: UpdateStatus;
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
  onClose: () => void;
}) {
  const btnBase =
    'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

  const primaryBtn =
    `${btnBase} text-white shadow-lg hover:shadow-indigo-500/30 hover:brightness-110`;

  const ghostBtn =
    `${btnBase} text-muted hover:text-foreground hover:bg-white/5`;

  if (status === 'idle' || status === 'not-available' || status === 'error') {
    return (
      <div className="flex gap-2">
        <button
          onClick={onCheck}
          className={primaryBtn}
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flex: 1 }}
        >
          <RefreshCw size={15} />
          Check for Updates
        </button>
        <button onClick={onClose} className={ghostBtn}>
          Close
        </button>
      </div>
    );
  }

  if (status === 'checking') {
    return (
      <button disabled className={`${primaryBtn} w-full opacity-70`}
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        <Loader2 size={15} className="animate-spin" />
        Checking…
      </button>
    );
  }

  if (status === 'available') {
    return (
      <div className="flex gap-2">
        <button
          onClick={onDownload}
          className={primaryBtn}
          style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', flex: 1 }}
        >
          <Download size={15} />
          Download Update
        </button>
        <button onClick={onClose} className={ghostBtn}>
          Later
        </button>
      </div>
    );
  }

  if (status === 'downloading') {
    return (
      <button disabled className={`${primaryBtn} w-full opacity-70`}
        style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)' }}>
        <Loader2 size={15} className="animate-spin" />
        Downloading…
      </button>
    );
  }

  if (status === 'downloaded') {
    return (
      <div className="flex gap-2">
        <button
          onClick={onInstall}
          className={primaryBtn}
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)', flex: 1 }}
        >
          <Zap size={15} />
          Restart &amp; Install
        </button>
        <button onClick={onClose} className={ghostBtn}>
          Later
        </button>
      </div>
    );
  }

  return null;
}
