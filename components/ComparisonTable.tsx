import React, { Fragment } from 'react';
import { Share2, Plus, FileText, RefreshCcw } from 'lucide-react';
import { FileNode, findNodeById } from '@/lib/tree-utils';

interface ComparisonTableProps {
  tree: FileNode[];
  comparisonIds: string[];
  toggleComparisonId: (id: string) => void;
  setComparisonIds: (ids: string[]) => void;
}

export const ComparisonTable = ({
  tree,
  comparisonIds,
  toggleComparisonId,
  setComparisonIds
}: ComparisonTableProps) => {
  const nodesToCompare = comparisonIds.map(id => findNodeById(tree, id)).filter(Boolean);
  
  const allFiles = (() => {
    const files: FileNode[] = [];
    const traverse = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'file') files.push(node);
        if (node.children) traverse(node.children);
      });
    };
    traverse(tree);
    return files;
  })();

  if (nodesToCompare.length < 2) {
    return (
      <div className="p-8 bg-card border border-border rounded-lg shadow-sm h-full flex flex-col">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Share2 className="text-blue-500" size={20} />
            Project Comparison Setup
          </h3>
          <p className="text-sm text-muted">Select at least two files from the list below to compare their project data side-by-side.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2">
          {allFiles.map(file => (
            <label 
              key={file.id} 
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:border-accent/50 ${
                comparisonIds.includes(file.id) ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/50' : 'bg-card border-border'
              }`}
            >
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500"
                checked={comparisonIds.includes(file.id)}
                onChange={() => toggleComparisonId(file.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{file.name}</p>
                <p className="text-[10px] text-muted uppercase tracking-tighter">
                  {file.display_settings?.selectedYear || 'No Year Set'}
                </p>
              </div>
              <FileText size={16} className={comparisonIds.includes(file.id) ? 'text-blue-500' : 'text-muted/30'} />
            </label>
          ))}
        </div>
        
        {comparisonIds.length === 1 && (
          <div className="mt-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-amber-600 text-xs font-medium">
            <div className="p-1 bg-amber-500/20 rounded-full"><Plus size={12} /></div>
            Select one more file to enable the side-by-side comparison.
          </div>
        )}
      </div>
    );
  }

  // Map sections to their unique projects
  const sectionMap = new Map<string, Set<string>>();
  nodesToCompare.forEach(n => {
    const content = Array.isArray(n?.content) ? n.content : [];
    content.forEach((row: any) => {
      const section = row.section || "Uncategorized";
      const title = row["Title / Item"];
      if (title) {
        if (!sectionMap.has(section)) sectionMap.set(section, new Set());
        sectionMap.get(section)!.add(title);
      }
    });
  });

  const sortedSections = Array.from(sectionMap.keys()).sort();

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden shadow-sm">
      <div className="p-3 bg-muted/5 border-b border-border flex justify-between items-center">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted">Side-by-Side Comparison</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setComparisonIds([])}
            className="px-2 py-1 bg-card border border-border text-muted text-[10px] font-bold rounded hover:bg-red-500/10 hover:text-red-500 transition-colors mr-2"
          >
            Clear Selection
          </button>
          {nodesToCompare.map(n => (
            <span key={n!.id} className="px-2 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-bold rounded capitalize">{n!.name}</span>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 bg-muted/10 z-10 shadow-sm">
            <tr>
              <th className="p-3 text-[11px] font-bold border-r border-b border-border text-foreground w-72 sticky left-0 bg-muted/10 z-20 shadow-[1px_0_0_0_var(--color-border)]">Title / Item</th>
              {nodesToCompare.map(n => (
                <Fragment key={n!.id}>
                  <th className="p-3 text-[11px] font-bold border-r border-b border-border text-blue-500 text-right">Amount ({n!.name})</th>
                  <th className="p-3 text-[11px] font-bold border-r border-b border-border text-muted">Status/Loc</th>
                </Fragment>
              ))}
              <th className="p-3 text-[11px] font-bold border-b border-border bg-green-500/5 text-green-600 text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {sortedSections.map(sectionName => {
              const projectsInSection = Array.from(sectionMap.get(sectionName)!).sort();
              
              return (
                <Fragment key={sectionName}>
                  <tr className="bg-muted/20">
                    <td colSpan={2 + nodesToCompare.length * 2} className="px-3 py-1 border-b border-border font-black text-foreground tracking-widest text-[11px] uppercase sticky left-0 z-10 bg-muted/20 shadow-[1px_0_0_0_var(--color-border)]">
                      Section: {sectionName}
                    </td>
                  </tr>
                  {projectsInSection.map(title => {
                    const values = nodesToCompare.map(n => {
                      const data = Array.isArray(n?.content) ? n.content : [];
                      return data.find((r: any) => r["Title / Item"] === title && (r.section || "Uncategorized") === sectionName);
                    });

                    const amount1 = Number(values[0]?.Amount || 0);
                    const amount2 = Number(values[1]?.Amount || 0);
                    const variance = amount2 - amount1;

                    return (
                      <tr key={`${sectionName}-${title}`} className="hover:bg-muted/5 border-b border-border transition-colors">
                        <td className="p-3 text-sm font-medium text-foreground border-r border-border bg-card sticky left-0 z-10 shadow-[1px_0_0_0_var(--color-border)]">{title}</td>
                        {values.map((v, idx) => (
                          <Fragment key={idx}>
                            <td className="p-3 text-sm font-mono text-right border-r border-border text-foreground">
                              {v ? Number(v.Amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : <span className="text-muted/30">-</span>}
                            </td>
                            <td className="p-3 text-[10px] text-muted italic border-r border-border truncate max-w-30">
                              {v?.Location || v?.Allocation || ""}
                            </td>
                          </Fragment>
                        ))}
                        <td className={`p-3 text-sm font-bold text-right ${variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-muted/40'}`}>
                          {variance === 0 ? "0.00" : (variance > 0 ? "+" : "") + variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
