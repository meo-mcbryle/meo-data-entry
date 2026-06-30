import React, { useState, useEffect } from 'react';
import { Wifi, RefreshCw, AlertTriangle, CheckCircle2, Loader2, ArrowRight, Server, Laptop } from 'lucide-react';
import { SyncService, type SyncConflict } from '@/lib/sync-service';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted: () => void;
}

export const SyncModal = ({ isOpen, onClose, onSyncCompleted }: SyncModalProps) => {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [queueLength, setQueueLength] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [checking, setChecking] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check sync state on open
  const checkState = async () => {
    setChecking(true);
    setSyncError(null);
    try {
      // 1. Pull remote updates first to synchronize the local DB with any remote modifications (e.g. renames)
      await SyncService.pullRemoteUpdates();

      // 2. Scan conflicts and queue length
      const { conflicts: items, queueLength: len } = await SyncService.checkSyncState();
      setConflicts(items);
      setQueueLength(len);

      // 3. Inform parent component that the local database has been updated
      onSyncCompleted();
    } catch (e: any) {
      setSyncError(`Sync check failed: ${e.message}`);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkState();
      setSuccess(false);
      setProgress(0);
    }
  }, [isOpen]);

  const handleResolveConflict = async (nodeId: string, resolution: 'keep_local' | 'use_server') => {
    try {
      await SyncService.resolveConflict(nodeId, resolution);
      // Refresh conflicts list
      setConflicts(prev => prev.filter(c => c.nodeId !== nodeId));
      setQueueLength(prev => resolution === 'use_server' ? prev - 1 : prev);
    } catch (e: any) {
      alert(`Resolution failed: ${e.message}`);
    }
  };

  const handleSyncAll = async () => {
    if (conflicts.length > 0) {
      alert('Please resolve all data conflicts before running synchronization.');
      return;
    }
    
    setSyncing(true);
    setSyncError(null);
    try {
      await SyncService.performSync((p) => {
        setProgress(p);
      });
      setSuccess(true);
      setTimeout(() => {
        onSyncCompleted();
        onClose();
      }, 1500);
    } catch (e: any) {
      setSyncError(`Sync process encountered error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/70 backdrop-blur-md antialiased animate-in fade-in duration-300">
      
      {/* Sleek Glassmorphic Core Card */}
      <div className="relative w-full max-w-lg mx-4 overflow-hidden border border-border/80 rounded-2xl bg-card/65 backdrop-blur-xl shadow-2xl p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
        
        {/* Glow accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-transparent via-accent to-transparent" />

        {/* Header section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accent/10 text-accent rounded-xl border border-accent/20 flex items-center justify-center animate-pulse">
              <Wifi size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Sync Hub</h3>
              <p className="text-[10px] text-accent font-mono font-bold tracking-wider">ONLINE SIGNAL STABILIZED</p>
            </div>
          </div>
          <button 
            disabled={syncing || checking} 
            onClick={checkState}
            className="p-2 hover:bg-muted/15 rounded-lg text-muted hover:text-foreground transition-all duration-150 active:scale-95 disabled:opacity-35 cursor-pointer"
            title="Refresh Sync State"
          >
            <RefreshCw size={15} className={checking ? "animate-spin text-accent" : ""} />
          </button>
        </div>

        <div className="h-px bg-border/50" />

        {/* Body content based on state */}
        {checking ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="animate-spin text-accent" size={28} />
            <p className="text-xs text-muted font-mono uppercase tracking-widest font-black animate-pulse">Scanning database registers...</p>
          </div>
        ) : success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle2 size={36} className="text-green-500 animate-in zoom-in duration-300" />
            <p className="text-sm font-extrabold text-foreground tracking-wide">Sync Completed Successfully</p>
            <p className="text-[10px] text-green-500 font-mono tracking-widest font-bold uppercase">DATABASE SYNCED & SECURED</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            
            {/* Status bar */}
            <div className="flex items-center justify-between p-3.5 bg-muted/10 border border-border/40 rounded-xl">
              <div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Queued Transactions</span>
                <span className="text-lg font-black text-foreground font-mono">{queueLength} changes pending</span>
              </div>
              
              <button 
                onClick={handleSyncAll}
                disabled={syncing || conflicts.length > 0 || queueLength === 0}
                className="btn-energy-pulse px-4 py-2 bg-accent hover:opacity-95 text-accent-foreground text-xs font-bold rounded-lg disabled:bg-muted/20 disabled:text-muted shadow-lg active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer disabled:pointer-events-none"
              >
                {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                <span>Sync Node Tree</span>
              </button>
            </div>

            {/* Sync Progress Indicator */}
            {syncing && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="flex justify-between text-[10px] font-bold text-muted font-mono">
                  <span>REPLAYING MUTATION LOGS</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-[3px] bg-border/50 rounded-full overflow-hidden">
                  <div className="h-full bg-accent transition-all duration-150" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {syncError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-mono">
                ERR // {syncError}
              </div>
            )}

            {/* Conflict List */}
            {conflicts.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-amber-500">
                  <AlertTriangle size={15} />
                  <span className="text-[11px] font-extrabold uppercase tracking-widest font-mono">Divergent Versions Detected ({conflicts.length})</span>
                </div>
                
                <div className="max-h-56 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                  {conflicts.map(c => (
                    <div key={c.nodeId} className="p-3 border border-amber-500/25 bg-amber-500/5 rounded-xl space-y-2.5 animate-in slide-in-from-bottom-2 duration-200">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-extrabold text-foreground truncate max-w-64 block">{c.name}</span>
                        <span className="text-[9px] font-bold font-mono text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">V_COLLISION</span>
                      </div>
                      
                      {/* Compare dates */}
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-2 bg-card/65 rounded-lg border border-border/40 space-y-1">
                          <span className="text-[9px] font-black text-muted uppercase tracking-wider flex items-center gap-1"><Laptop size={10} /> Local Changes</span>
                          <span className="font-mono text-[9.5px] block truncate">{new Date(c.localNode.updated_at).toLocaleString()}</span>
                          <span className="text-[9px] text-accent font-mono block">Rev: {c.localNode.version}</span>
                        </div>
                        <div className="p-2 bg-card/65 rounded-lg border border-border/40 space-y-1">
                          <span className="text-[9px] font-black text-muted uppercase tracking-wider flex items-center gap-1"><Server size={10} /> Cloud Version</span>
                          <span className="font-mono text-[9.5px] block truncate">{new Date(c.remoteNode.updated_at).toLocaleString()}</span>
                          <span className="text-[9px] text-purple-500 font-mono block">Rev: {c.remoteNode.version}</span>
                        </div>
                      </div>

                      {/* Conflict resolution buttons */}
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleResolveConflict(c.nodeId, 'keep_local')}
                          className="flex-1 py-1 px-2.5 bg-amber-500 hover:bg-amber-600/90 text-amber-950 rounded-lg text-[10px] font-extrabold transition-all text-center uppercase tracking-wider cursor-pointer"
                        >
                          Keep Local Changes
                        </button>
                        <button 
                          onClick={() => handleResolveConflict(c.nodeId, 'use_server')}
                          className="flex-1 py-1 px-2.5 bg-card hover:bg-muted/15 border border-border/60 text-foreground rounded-lg text-[10px] font-extrabold transition-all text-center uppercase tracking-wider cursor-pointer"
                        >
                          Use Cloud Version
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              !syncing && queueLength === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-muted">
                  <CheckCircle2 size={32} className="text-accent/30 mb-2" />
                  <p className="text-xs">All records match the cloud registry.</p>
                </div>
              )
            )}
          </div>
        )}

        <div className="h-px bg-border/50" />

        {/* Footer controls */}
        <div className="flex justify-end gap-2.5">
          <button 
            disabled={syncing}
            onClick={onClose}
            className="px-4 py-2 hover:bg-muted/15 border border-transparent rounded-lg text-xs font-bold text-muted hover:text-foreground transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-40"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
