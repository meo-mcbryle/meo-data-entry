import React from 'react';
import { Folder, FileText } from 'lucide-react';
import { TrashNode } from '@/lib/types';

interface TrashBinProps {
  deletedNodes: TrashNode[];
  handleRestore: (id: string) => void;
  handlePermanentDelete: (id: string) => void;
}

export const TrashBin = ({
  deletedNodes,
  handleRestore,
  handlePermanentDelete
}: TrashBinProps) => {
  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden shadow-sm">
      <div className="p-3 bg-muted/5 border-b border-border flex justify-between items-center">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted">Trash Bin</h3>
        <p className="text-[10px] text-muted font-bold">{deletedNodes.length} items in trash</p>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 bg-muted/10 z-10 shadow-sm">
            <tr>
              <th className="p-3 text-[11px] font-bold border-r border-b border-border text-foreground">Name</th>
              <th className="p-3 text-[11px] font-bold border-r border-b border-border text-foreground">Type</th>
              <th className="p-3 text-[11px] font-bold border-r border-b border-border text-foreground">Deleted Date</th>
              <th className="p-3 text-[11px] font-bold border-r border-b border-border text-foreground">Deleted By</th>
              <th className="p-3 text-[11px] font-bold border-b border-border text-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deletedNodes.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-muted italic text-sm">Trash is empty.</td>
              </tr>
            ) : (
              deletedNodes.map((node) => (
                <tr key={node.id} className="hover:bg-muted/5 border-b border-border transition-colors">
                  <td className="p-3 text-xs font-bold text-foreground flex items-center gap-2">
                    {node.type === 'folder' ? <Folder size={14} className="text-amber-500" /> : <FileText size={14} className="text-blue-500" />}
                    {node.name}
                  </td>
                  <td className="p-3 text-[10px] uppercase font-black text-muted tracking-tighter">
                    {node.type}
                  </td>
                  <td className="p-3 text-[10px] font-mono text-muted">
                    {node.deleted_at ? new Date(node.deleted_at).toLocaleString() : '-'}
                  </td>
                  <td className="p-3 text-[10px] font-bold text-muted truncate max-w-40" title={node.deleted_by || 'Unknown'}>
                    {node.deleted_by || <span className="opacity-30 italic font-normal">Unknown</span>}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleRestore(node.id)}
                        className="px-2 py-1 bg-green-500/10 text-green-600 text-[10px] font-bold rounded hover:bg-green-500/20 transition-colors"
                      >
                        Restore
                      </button>
                      <button 
                        onClick={() => handlePermanentDelete(node.id)}
                        className="px-2 py-1 bg-red-500/10 text-red-500 text-[10px] font-bold rounded hover:bg-red-500/20 transition-colors"
                      >
                        Delete Permanently
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
