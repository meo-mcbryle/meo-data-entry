import React from 'react';
import { Loader2, RefreshCcw, User } from 'lucide-react';

interface AuditLogsProps {
  auditLogs: any[];
  isLoadingLogs: boolean;
  hasMoreLogs: boolean;
  fetchAuditLogs: (offset?: number) => void;
}

export const AuditLogs = ({
  auditLogs,
  isLoadingLogs,
  hasMoreLogs,
  fetchAuditLogs
}: AuditLogsProps) => {
  if (isLoadingLogs && auditLogs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        <Loader2 className="animate-spin text-accent mb-4" size={32} />
        <p className="text-sm text-muted font-medium animate-pulse uppercase tracking-widest">Loading audit history...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border border-border/40 rounded-lg bg-card/25 backdrop-blur-md overflow-hidden shadow-sm">
      <div className="p-3 bg-muted/5 border-b border-border/40 flex justify-between items-center">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted">System Audit Trail</h3>
        <button onClick={() => fetchAuditLogs(0)} className="p-1.5 text-muted hover:text-accent transition-colors" title="Refresh Logs">
          <RefreshCcw size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 bg-card/70 backdrop-blur-sm z-10 shadow-sm">
            <tr>
              <th className="p-3 text-[11px] font-bold border-r border-b border-border text-foreground">Timestamp</th>
              <th className="p-3 text-[11px] font-bold border-r border-b border-border text-foreground">User ID</th>
              <th className="p-3 text-[11px] font-bold border-r border-b border-border text-foreground">User</th>
              <th className="p-3 text-[11px] font-bold border-r border-b border-border text-foreground">Action</th>
              <th className="p-3 text-[11px] font-bold border-r border-b border-border text-foreground">Target Node</th>
              <th className="p-3 text-[11px] font-bold border-b border-border text-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 && !isLoadingLogs ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-muted italic text-sm">No activity logs found.</td>
              </tr>
            ) : (
              <>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/5 border-b border-border transition-colors">
                    <td className="p-3 text-xs font-mono text-muted whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 text-[10px] font-mono text-muted truncate max-w-24" title={log.user_id}>
                      {log.user_id}
                    </td>
                    <td className="p-3 text-[10px] font-mono text-muted truncate max-w-48" title={log.details?.user_email || log.user_id}>
                      {log.details?.user_email || <span className="opacity-30 italic text-[8px]">{log.user_id}</span>}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                        log.action.includes('CREATED') ? 'bg-green-500/10 text-green-500' :
                        log.action.includes('DELETED') ? 'bg-red-500/10 text-red-500' :
                        log.action.includes('UPDATED') ? 'bg-blue-500/10 text-blue-500' :
                        log.action.includes('LOGIN') ? 'bg-purple-500/10 text-purple-500' :
                        'bg-muted/20 text-muted'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-bold text-foreground">
                      {log.nodes?.name || <span className="text-muted/30 italic font-normal">N/A</span>}
                    </td>
                    <td className="p-3 text-[11px] text-muted font-mono whitespace-pre-wrap">
                      {(() => {
                        const { user_email, ...rest } = log.details || {};
                        return Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 1) : '-';
                      })()}
                    </td>
                  </tr>
                ))}
                {hasMoreLogs && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center border-t border-border">
                      <button 
                        onClick={() => fetchAuditLogs(auditLogs.length)}
                        disabled={isLoadingLogs}
                        className="px-4 py-2 bg-muted/20 hover:bg-muted/30 text-muted rounded text-xs font-bold transition-all disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {isLoadingLogs && <Loader2 className="animate-spin" size={14} />}
                        {isLoadingLogs ? 'Loading More...' : 'Load More History'}
                      </button>
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
