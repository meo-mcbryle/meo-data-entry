import React, { useEffect, useState } from 'react';
import { X, FileText, Download, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { toA1Key, formatNumberDisplay, formatDateDisplay } from '@/lib/excel-utils';
import { CellMetadata } from '@/lib/tree-utils';
import { evaluateFormula } from '@/lib/formula-evaluator';

interface Attachment {
  type: 'image' | 'file';
  url: string;
  name: string;
  size?: number;
  contentType?: string;
  path?: string;
}

interface RowSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  rowIndex: number | null;
  columnOrder: string[];
  masterColumnOrder: string[];
  gridData: Map<string, any>;
  cellMetadata: Record<string, CellMetadata>;
}

export const RowSummaryModal = ({
  isOpen,
  onClose,
  rowIndex,
  columnOrder,
  masterColumnOrder,
  gridData,
  cellMetadata
}: RowSummaryModalProps) => {
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen || rowIndex === null) return;

    let active = true;
    const urls: Record<string, string> = {};

    const resolve = async () => {
      try {
        const { LocalDB } = await import('@/lib/local-db');
        for (const h of columnOrder) {
          const colIdx = masterColumnOrder.indexOf(h);
          if (colIdx === -1) continue;
          const cellKey = toA1Key(rowIndex, colIdx);
          const legacyKey = `${rowIndex}:${h}`;
          const meta = cellMetadata[cellKey] || cellMetadata[legacyKey] || {};

          if (meta.attachments) {
            for (const att of meta.attachments) {
              if (att.path) {
                const local = await LocalDB.getAttachment(att.path);
                if (local && local.blob) {
                  const objUrl = URL.createObjectURL(local.blob);
                  urls[att.path] = objUrl;
                  continue;
                }
              }
              if (att.url) {
                urls[att.path || att.url] = att.url;
              }
            }
          }
        }
        if (active) {
          setResolvedUrls(urls);
        }
      } catch (err) {
        console.error('Failed to resolve summary attachments:', err);
      }
    };

    resolve();

    return () => {
      active = false;
      Object.values(urls).forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [isOpen, rowIndex, columnOrder, masterColumnOrder, cellMetadata]);

  if (!isOpen || rowIndex === null) return null;

  const rowData: Record<string, any> = {};
  columnOrder.forEach((h) => {
    const colIdx = masterColumnOrder.indexOf(h);
    if (colIdx !== -1) {
      const cellKey = toA1Key(rowIndex, colIdx);
      rowData[h] = gridData.get(cellKey);
    }
  });

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/70 backdrop-blur-md antialiased animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl mx-4 overflow-hidden border border-border/80 rounded-2xl bg-card/75 backdrop-blur-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[85vh]">
        {/* Glow accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-transparent via-accent to-transparent" />

        {/* Header */}
        <div className="flex justify-between items-center border-b border-border/30 pb-3">
          <div className="flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Row Summary</h3>
            <span className="text-[10px] text-muted-foreground font-semibold mt-0.5">Record Index: Row {rowIndex + 1}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-muted/15 rounded-lg text-muted hover:text-foreground transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable list of columns */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 py-2">
          {(() => {
            const processedColumns = columnOrder.map((header) => {
              const colIdx = masterColumnOrder.indexOf(header);
              if (colIdx === -1) return null;

              const cellKey = toA1Key(rowIndex, colIdx);
              const legacyKey = `${rowIndex}:${header}`;
              const meta = cellMetadata[cellKey] || cellMetadata[legacyKey] || {};
              const cellAttachments = (meta.attachments || []) as Attachment[];
              const val = gridData.get(cellKey);
              const hasAttachments = cellAttachments.length > 0;

              let displayVal = val;
              if (typeof val === 'string' && val.startsWith('=')) {
                displayVal = evaluateFormula(val, rowData, gridData, masterColumnOrder, columnOrder, meta.format);
                console.log('Formula evaluation debug:', { val, displayVal, rowData, rowIndex });
              }
              if (displayVal !== undefined && displayVal !== null && displayVal !== '') {
                if (meta.type === 'date') {
                  displayVal = formatDateDisplay(displayVal, meta.format);
                } else if (meta.type === 'number' || header === 'Amount' || typeof displayVal === 'number') {
                  displayVal = formatNumberDisplay(displayVal, meta.format);
                }
              }
              const isEmpty = displayVal === undefined || displayVal === null || displayVal === '';

              const headerMeta = cellMetadata[`header:${header}`];
              let displayHeader = header;
              if (header.startsWith('_UNTITLED_')) {
                if (headerMeta && headerMeta.mergedIn) {
                  displayHeader = headerMeta.mergedIn.replace(/^header:/, '');
                } else {
                  displayHeader = 'Untitled';
                }
              }

              return {
                header,
                displayHeader,
                displayVal,
                isEmpty,
                hasAttachments,
                cellAttachments,
              };
            }).filter(Boolean) as {
              header: string;
              displayHeader: string;
              displayVal: any;
              isEmpty: boolean;
              hasAttachments: boolean;
              cellAttachments: Attachment[];
            }[];

            const groups: {
              displayHeader: string;
              items: typeof processedColumns;
            }[] = [];

            processedColumns.forEach((col) => {
              let group = groups.find(g => g.displayHeader === col.displayHeader);
              if (!group) {
                group = { displayHeader: col.displayHeader, items: [] };
                groups.push(group);
              }
              group.items.push(col);
            });

            return groups.map((group) => {
              const isEmptyGroup = group.items.every(item => item.isEmpty && !item.hasAttachments);

              return (
                <div key={group.displayHeader} className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-border/30 bg-muted/5">
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] text-muted">{group.displayHeader}</span>
                  {isEmptyGroup ? (
                    <div className="text-sm font-semibold text-foreground whitespace-pre-wrap break-words leading-relaxed">
                      <span className="italic text-muted-foreground/50 font-normal">—</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {group.items.map((item, idx) => {
                        if (item.isEmpty && !item.hasAttachments) return null;
                        return (
                          <div key={idx} className="flex flex-col gap-1.5">
                            {!item.isEmpty && (
                              <div className="text-sm font-semibold text-foreground whitespace-pre-wrap break-words leading-relaxed">
                                {String(item.displayVal)}
                              </div>
                            )}

                            {/* Cell attachments rendering */}
                            {item.hasAttachments && (
                              <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-border/10">
                                {item.cellAttachments.map((att, attIdx) => {
                                  const isImage = att.type === 'image' || att.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.name);
                                  const resolvedUrl = resolvedUrls[att.path || att.url] || att.url;

                                  return (
                                    <div key={attIdx} className="flex flex-col gap-2 p-2 bg-card border border-border/40 rounded-xl max-w-[200px] shadow-sm">
                                      {isImage ? (
                                        <div className="relative w-36 h-24 overflow-hidden rounded-lg bg-muted/10 border border-border/30 group/thumb">
                                          <img src={resolvedUrl} alt={att.name} className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105" />
                                          <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity duration-200">
                                            <ExternalLink size={16} />
                                          </a>
                                        </div>
                                      ) : (
                                        <div className="w-36 h-24 flex flex-col items-center justify-center bg-muted/10 border border-border/30 rounded-lg text-muted p-2 text-center">
                                          <FileText size={26} className="text-accent/60 mb-1" />
                                          <span className="text-[9px] font-bold truncate w-full">{att.name}</span>
                                        </div>
                                      )}
                                      <a
                                        href={resolvedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1.5 justify-center truncate max-w-[140px]"
                                      >
                                        <Download size={10} className="shrink-0" />
                                        <span className="truncate">{att.name}</span>
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-border/30">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-muted/10 hover:bg-muted/20 text-foreground text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
