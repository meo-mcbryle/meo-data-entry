import React, { useEffect, useState, useRef } from 'react';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, ChevronDown, Calendar, MoreVertical, X } from 'lucide-react';
import { toA1Key, fromA1Key, formatNumberDisplay, formatDateDisplay } from '@/lib/excel-utils';
import { CellMetadata, GridRowData } from '@/lib/tree-utils';
import { GRID_THEME, LOCATIONS, ALLOCATIONS } from '@/lib/constants';
import { useTheme } from './ThemeToggle';

/**
 * CellEditor: Optimized uncontrolled-like component for instant typing.
 * Uses local state for characters and debounces the global "push" to gridData.
 */
export const CellEditor = ({ initialValue, onSync, onKeyDown, className, isTextarea, type = "text", dataRow, dataCol, onLocalEditing, onCancel }: any) => {
  const [localValue, setLocalValue] = useState(initialValue ?? '');
  const syncTimerRef = useRef<any>(null);
  const inputRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset local state if external data changes (e.g., Undo/Redo)
  useEffect(() => {
    // Numeric Stability: If we are typing a decimal (e.g. "1."), don't let the parent 
    // state update (which parses to 1) snap the value back and delete the dot.
    if (type === 'number') {
      const pInit = parseFloat(initialValue);
      const pLocal = parseFloat(localValue);
      if (pInit === pLocal || (isNaN(pInit) && isNaN(pLocal))) return;
    }
    if (initialValue !== localValue) setLocalValue(initialValue ?? '');
  }, [initialValue, type]);

  // Cleanup timer on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  const handleLocalChange = (val: any) => {
    setLocalValue(val);
    if (onLocalEditing) onLocalEditing(val);

    // Debounce: Wait 300ms before updating global state
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      // Only parse numbers when syncing to the global state to preserve typing state (like decimals)
      onSync(type === 'number' ? (val === '' ? '' : parseFloat(val)) : val);
    }, 300);

    // Height auto-grow for textareas
    if (isTextarea && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleBlur = () => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    onSync(localValue); // Immediate sync on exit
  };

  const handleKeyDownLocal = (e: any) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      setLocalValue(initialValue ?? '');
      onSync(initialValue ?? '');
      if (onCancel) onCancel();
      return;
    }
    if (onKeyDown) onKeyDown(e);
  };

  useEffect(() => {
    if (isTextarea && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  if (isTextarea) {
    return (
      <textarea
        ref={textareaRef}
        rows={1}
        data-row={dataRow}
        data-col={dataCol}
        value={localValue}
        autoFocus
        onBlur={handleBlur}
        onChange={(e) => handleLocalChange(e.target.value)}
        onKeyDown={handleKeyDownLocal}
        className={`${className} resize-none overflow-hidden py-0.5 w-full block`}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      step={type === 'number' ? '0.01' : undefined}
      data-row={dataRow}
      data-col={dataCol}
      value={localValue}
      autoFocus
      onBlur={handleBlur}
      onChange={(e) => handleLocalChange(e.target.value)}
      onKeyDown={handleKeyDownLocal}
      className={`${className} w-full`}
    />
  );
};

export interface GridRowProps {
  row: GridRowData & { section?: string; _index?: number };
  globalIndex: number;
  visibleHeaders: string[];
  activeCell: { row: number, col: string } | null;
  selection: { startRow: number; endRow: number; startCol: string; endCol: string } | null;
  cellMetadata: Record<string, CellMetadata>;
  cellAlignments: Record<string, 'left' | 'center' | 'right' | 'justify'>;
  columnAlignments: Record<string, 'left' | 'center' | 'right' | 'justify'>;
  isFreezePanes: boolean;
  dragFillRange: { startRow: number; endRow: number; col: string } | null;
  isSelecting: boolean;
  handleUpdateCell: (index: number, key: string, value: any) => void;
  handleKeyDown: (e: React.KeyboardEvent, rowIndex: number, colIndex: number, headers: string[]) => void;
  setActiveCell: (cell: { row: number, col: string } | null) => void;
  setSelection: (selection: any) => void;
  setIsSelecting: (selecting: boolean) => void;
  onOpenContextMenu: (e: React.MouseEvent, type: 'cell' | 'header' | 'row' | 'section', col: string, row?: number, sectionName?: string) => void;
  setDragFillRange: React.Dispatch<React.SetStateAction<{ startRow: number; endRow: number; col: string } | null>>;
  toggleCellAlignment: (rowIndex: number, header: string) => void;
  handleDragFillStart: (e: React.MouseEvent, row: number, col: string) => void;
  removeTableRow: (index: number) => void;
  setViewingMedia: (media: any) => void;
  removeCellMetadata: (row: number, col: string) => void;
  evaluateFormula: (value: any, row: any, format?: string) => any;
  rowHeights: Record<string, number>;
  startRowResizing: (row: number, e: React.MouseEvent) => void;
  handleOpenDropdown: (e: React.MouseEvent, row: number, col: string, options: string[]) => void;
  onMeasuredHeight: (index: number, height: number) => void;
  masterColumnOrder: string[];
  zoom: number;
  onLocalEditing?: (val: string) => void;
}

export const GridRow = React.memo(({
  row, globalIndex, visibleHeaders, activeCell, selection,
  cellMetadata, cellAlignments, columnAlignments, isFreezePanes,
  dragFillRange, isSelecting, handleUpdateCell, handleKeyDown,
  setActiveCell, setSelection, setIsSelecting, onOpenContextMenu, setDragFillRange,
  toggleCellAlignment, handleDragFillStart, removeTableRow,
  setViewingMedia, removeCellMetadata, evaluateFormula,
  rowHeights, startRowResizing, handleOpenDropdown, onMeasuredHeight, masterColumnOrder, zoom,
  onLocalEditing
}: GridRowProps) => {
  const { theme } = useTheme();
  const rowRef = useRef<HTMLTableRowElement>(null);
  const isRowActive = activeCell?.row === globalIndex;
  const startColIdx = selection ? visibleHeaders.indexOf(selection.startCol) : -1;
  const endColIdx = selection ? visibleHeaders.indexOf(selection.endCol) : -1;
  const selMinRow = selection ? Math.min(selection.startRow, selection.endRow) : -1;
  const selMaxRow = selection ? Math.max(selection.startRow, selection.endRow) : -1;
  const selMinColIdx = (selection && startColIdx !== -1 && endColIdx !== -1) ? Math.min(startColIdx, endColIdx) : -1;
  const selMaxColIdx = (selection && startColIdx !== -1 && endColIdx !== -1) ? Math.max(startColIdx, endColIdx) : -1;
  const [editingCol, setEditingCol] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCell || activeCell.row !== globalIndex) {
      if (editingCol !== null) setEditingCol(null);
    } else if (activeCell.col !== editingCol) {
      if (editingCol !== null) setEditingCol(null);
    }
  }, [activeCell, globalIndex, editingCol]);

  const handleCellClick = (header: string, e: React.MouseEvent) => {
    const didDrag = typeof document !== 'undefined' && document.body.getAttribute('data-dragged') === 'true';
    if (didDrag) return;

    const wasAlreadyActive = activeCell?.row === globalIndex && activeCell?.col === header;
    if (wasAlreadyActive) {
      setEditingCol(header);
    } else {
      setActiveCell({ row: globalIndex, col: header });
      setSelection({ startRow: globalIndex, endRow: globalIndex, startCol: header, endCol: header });
    }
  };

  const handleCellDoubleClick = (header: string) => {
    setEditingCol(header);
  };



  // Dynamic Height Measurement: Use ResizeObserver to detect the actual rendered height
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    // Excel-like Optimization: Only observe the row if it's currently active (editing/active interactions)
    // or if it hasn't been measured yet. This drops active observers from ~70+ to ~0-1.
    const hasMeasuredHeight = !!rowHeights[String(globalIndex)];
    const shouldObserve = isRowActive || !hasMeasuredHeight;
    if (!shouldObserve) return;

    const observer = new ResizeObserver(() => {
      /**
       * Fix: Normalize height by zoom factor to prevent infinite enlargement loop.
       * getBoundingClientRect returns physical pixels, we need logical CSS pixels.
       */
      const actualHeight = el.getBoundingClientRect().height / zoom;
      const currentHeight = rowHeights[String(globalIndex)] || 40;

      // Only update if the difference is significant to avoid rounding loops
      if (actualHeight > 0 && Math.abs(currentHeight - actualHeight) > 0.5) {
        onMeasuredHeight(globalIndex, actualHeight);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [globalIndex, onMeasuredHeight, zoom, isRowActive, rowHeights]); // REMOVED rowHeights to prevent O(N^2) observer cycles previously, but safe now with shouldObserve filter

  return (
    <tr
      ref={rowRef}
      className={GRID_THEME.tableBodyRow}
      style={{ height: rowHeights[String(globalIndex)] ? `${rowHeights[String(globalIndex)]}px` : undefined }}
    >
      <td
        className={`relative group/row-index w-10 min-w-10 text-[10px] font-bold text-center select-none cursor-pointer ${GRID_THEME.tableIndexCell} ${isRowActive ? 'active-header shadow-[inset_-2px_0_0_0_var(--color-accent)]' : 'bg-[color-mix(in_srgb,var(--muted)_10%,var(--card))] text-muted hover:bg-[color-mix(in_srgb,var(--muted)_30%,var(--card))] hover:text-foreground'} ${isFreezePanes ? 'sticky left-0 z-20 bg-card shadow-[1px_0_0_0_var(--color-border),0_1px_0_0_var(--color-border)]' : ''
          }`}
        onContextMenu={(e) => {
          e.preventDefault();
          const isInside = selection && globalIndex >= Math.min(selection.startRow, selection.endRow) && globalIndex <= Math.max(selection.startRow, selection.endRow);
          if (!isInside) {
            setSelection({
              startRow: globalIndex,
              endRow: globalIndex,
              startCol: visibleHeaders[0],
              endCol: visibleHeaders[visibleHeaders.length - 1]
            });
          }
          onOpenContextMenu(e, 'row', "", globalIndex);
        }}
        onClick={() => {
          setSelection({ startRow: globalIndex, endRow: globalIndex, startCol: visibleHeaders[0], endCol: visibleHeaders[visibleHeaders.length - 1] });
          setActiveCell({ row: globalIndex, col: visibleHeaders[0] });
        }}
      >
        {globalIndex + 1}
        <div
          onMouseDown={(e) => startRowResizing(globalIndex, e)}
          className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-accent z-50 transition-colors group-hover/row-index:bg-muted/40"
          title="Drag to resize height"
        />
      </td>
      {visibleHeaders.map((header: string, colIndex: number) => {
        // Performance: Use index from stable master order for A1 keys
        const cellKey = toA1Key(globalIndex, masterColumnOrder.indexOf(header));
        const legacyKey = `${globalIndex}:${header}`;
        const meta: CellMetadata = cellMetadata[cellKey] || cellMetadata[legacyKey] || {};
        const isEditing = editingCol === header;

        if (meta.mergedIn) return null;
        const cellAlign = cellAlignments[cellKey] || cellAlignments[legacyKey] || columnAlignments[header] || ((header === "Title / Item" || header === "Amount") ? "right" : "left");
        const alignClass = cellAlign === 'center'
          ? 'text-center justify-center'
          : cellAlign === 'right'
          ? 'text-right justify-end'
          : cellAlign === 'justify'
          ? 'text-justify justify-between'
          : 'text-left justify-start';
        const textAlignClass = cellAlign === 'center' ? 'text-center' : cellAlign === 'right' ? 'text-right' : cellAlign === 'justify' ? 'text-justify' : 'text-left';

        const attachmentLink = (meta.attachments?.length ?? 0) > 0 && (
          <a
            href="#"
            role="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewingMedia({ attachments: meta.attachments, row: globalIndex, col: header }); }}
            className="text-sm text-blue-500 hover:underline cursor-pointer"
            style={{ fontFamily: meta.fontFamily || 'inherit' }}
            title={`View ${meta.attachments?.length ?? 0} attachment${(meta.attachments?.length ?? 0) > 1 ? 's' : ''}`}
          >
            [View Attachment]
          </a>
        );

        const isInSelection = selection && selMinColIdx !== -1 && globalIndex >= selMinRow && globalIndex <= selMaxRow && colIndex >= selMinColIdx && colIndex <= selMaxColIdx;
        const isInDragFill = dragFillRange && header === dragFillRange.col &&
          globalIndex >= Math.min(dragFillRange.startRow, dragFillRange.endRow) &&
          globalIndex <= Math.max(dragFillRange.startRow, dragFillRange.endRow);

        return (
          <td
            key={header} rowSpan={meta.rowSpan} colSpan={meta.colSpan}
            onContextMenu={(e) => {
              e.preventDefault();
              const startColIdx = selection ? visibleHeaders.indexOf(selection.startCol) : -1;
              const endColIdx = selection ? visibleHeaders.indexOf(selection.endCol) : -1;
              const currentColIdx = visibleHeaders.indexOf(header);
              const isInside = selection &&
                globalIndex >= Math.min(selection.startRow, selection.endRow) &&
                globalIndex <= Math.max(selection.startRow, selection.endRow) &&
                currentColIdx >= Math.min(startColIdx, endColIdx) &&
                currentColIdx <= Math.max(startColIdx, endColIdx);

              if (!isInside) {
                setSelection({ startRow: globalIndex, endRow: globalIndex, startCol: header, endCol: header });
                setActiveCell({ row: globalIndex, col: header });
              }
              onOpenContextMenu(e, 'cell', header, globalIndex);
            }}
            onMouseDown={(e) => {
              if (e.button === 0) {
                if (typeof document !== 'undefined') {
                  document.body.removeAttribute('data-dragged');
                }
                setActiveCell({ row: globalIndex, col: header });
                setSelection({ startRow: globalIndex, endRow: globalIndex, startCol: header, endCol: header });
                setIsSelecting(true);
              }
            }}
             onMouseEnter={(e) => {
               if (e.buttons === 1) {
                 if (typeof document !== 'undefined') {
                   document.body.setAttribute('data-dragged', 'true');
                 }
                 const isDragFillActive = typeof document !== 'undefined' && document.body.getAttribute('data-drag-fill-active') === 'true';
                 if (isDragFillActive) {
                   setDragFillRange(prev => prev ? { ...prev, endRow: globalIndex } : null);
                 } else {
                   setSelection((prev: any) => prev ? { ...prev, endRow: globalIndex, endCol: header } : null);
                 }
               }
             }}
            onClick={() => {
              const input = document.querySelector(`[data-row="${globalIndex}"][data-col="${header}"]`) as HTMLElement;
              if (input) input.focus();
            }}
            className={`${GRID_THEME.tableCell} ${meta.fontFamily ? '' : 'font-sans'} ${isFreezePanes && header === "Title / Item" ? "sticky left-10 z-10 shadow-[1px_0_0_0_var(--color-border)]" : ""} ${isInSelection ? `bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))] z-10 ring-1 ring-inset ring-accent/30` : ''} ${isInDragFill ? 'bg-[color-mix(in_srgb,var(--accent)_5%,var(--card))] ring-1 ring-inset ring-accent/50 z-10' : ''} ${activeCell?.row === globalIndex && activeCell?.col === header ? 'animate-cell-flash' : ''}`}
            style={{
              fontFamily: meta.fontFamily || 'inherit',
              fontWeight: meta.bold ? 'bold' : 'normal',
              fontStyle: meta.italic ? 'italic' : 'normal',
              textDecoration: meta.underline ? 'underline' : 'none',
              height: '1px', /* Forces cell to respect content height */
              ...(activeCell?.row === globalIndex && activeCell?.col === header ? {
                outline: '2px solid var(--color-accent)',
                outlineOffset: '-2px',
                zIndex: 20
              } : {})
            }}
          >
            {/* Metadata Clear Button - Visible on hover for cells with formatting or files */}
            {((meta.attachments?.length ?? 0) > 0 || meta.type || meta.fontFamily || meta.bold || meta.italic || meta.underline) && (
              <button onClick={(e) => { e.stopPropagation(); removeCellMetadata(globalIndex, header); }} className="opacity-0 group-hover/cell:opacity-100 p-1 text-muted hover:text-red-500 absolute right-0.5 bottom-0.5 bg-card/80 rounded shadow-sm transition-all z-30 scale-90">
                <X size={10} />
              </button>
            )}

            {activeCell?.row === globalIndex && activeCell?.col === header && (
              <>
                <div onMouseDown={(e) => handleDragFillStart(e, globalIndex, header)} className="hidden md:block absolute bottom-0 right-0 w-2 h-2 bg-accent border border-card cursor-crosshair z-30 -mb-0.75 -mr-0.75 shadow-sm rounded-full" />
                {/* Mobile-friendly context menu trigger */}
                <button
                  onClick={(e) => onOpenContextMenu(e, 'cell', header, globalIndex)}
                  className="md:hidden absolute top-0 right-0 p-1 text-accent bg-card/80 rounded-bl shadow-sm z-30"
                  aria-label="Cell options"
                >
                  <MoreVertical size={12} />
                </button>
              </>
            )}
            {(meta.attachments?.length ?? 0) > 0 ? (
              <div className={`flex items-center w-full min-h-7 px-2 py-1.5 ${alignClass}`}>
                {attachmentLink}
              </div>
            ) : header === 'Location' || header === 'Allocation' ? (
              <div className={`relative flex items-center group/drop min-h-7 w-full px-2 py-1.5 hover:bg-accent/5 ${alignClass}`}>
                <button
                  data-row={globalIndex}
                  data-col={header}
                  onClick={(e) => handleOpenDropdown(e, globalIndex, header, header === 'Location' ? LOCATIONS : ALLOCATIONS)}
                  className={`flex flex-wrap items-center gap-x-2 outline-none w-full h-full text-inherit ${alignClass}`}
                >
                  <span className={`wrap-break-word whitespace-normal leading-tight ${textAlignClass}`}>
                    {row[header] || <span className="text-muted/40 italic font-normal">Select...</span>}
                  </span>
                </button>
                <ChevronDown size={12} className="absolute right-1.5 text-muted/50 group-hover/drop:text-accent shrink-0 pointer-events-none" />
              </div>
            ) : meta.type === 'date' ? (
              <div
                style={{ colorScheme: theme }}
                className="relative w-full flex items-center group/date min-h-7"
              >
                <input
                  type="date" data-row={globalIndex} data-col={header}
                  value={typeof row[header] === 'boolean' ? String(row[header]) : (row[header] ?? '')}
                  onChange={(e) => handleUpdateCell(globalIndex, header, e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Modern browsers support showPicker() on input elements to trigger the calendar
                    try { (e.currentTarget as HTMLInputElement).showPicker(); } catch (err) { }
                  }}
                  style={{ colorScheme: theme }}
                  className="absolute inset-0 opacity-0 z-20 cursor-pointer w-full h-full"
                />
                <div className={`w-full px-2 py-1.5 text-sm text-foreground ${alignClass} group-hover:bg-accent/10 flex flex-wrap items-center gap-x-2 flex-1`}>
                  {row[header] ? formatDateDisplay(row[header], meta.format) : <span className="text-muted/50 font-normal italic flex items-center gap-1.5"><Calendar size={14} className="shrink-0" /> Set Date...</span>}
                </div>
              </div>
            ) : meta.type === 'formula' ? (
              <div onClick={(e) => handleCellClick(header, e)} className={`w-full px-2 py-1.5 text-sm text-foreground cursor-text min-h-7 flex flex-wrap items-center gap-x-2 wrap-break-word ${activeCell?.row === globalIndex && activeCell?.col === header ? 'bg-accent/10' : 'hover:bg-muted/10'} ${alignClass}`}>
                {(() => { const result = evaluateFormula(row[header], row, meta.format); return typeof result === 'number' ? formatNumberDisplay(result, meta.format) : result; })()}
              </div>
            ) : (meta.type === 'number' || header === 'Amount') ? (
              <div className={`flex flex-wrap items-center gap-x-2 ${alignClass} w-full min-h-7 ${isEditing ? 'p-0' : 'px-2 py-0.5'}`}>
                {isEditing ? (
                  <CellEditor
                    initialValue={row[header]}
                    onSync={(val: any) => handleUpdateCell(globalIndex, header, val)}
                    onKeyDown={(e: any) => handleKeyDown(e, globalIndex, colIndex, visibleHeaders)}
                    className={`${GRID_THEME.tableInput} flex-1 ${textAlignClass}`}
                    type="number"
                    onLocalEditing={onLocalEditing}
                    onCancel={() => setEditingCol(null)}
                  />
                ) : (
                  <div
                    data-row={globalIndex}
                    data-col={header}
                    onClick={(e) => handleCellClick(header, e)}
                    onDoubleClick={() => handleCellDoubleClick(header)}
                    className={`text-sm text-foreground cursor-text w-full ${textAlignClass}`}
                  >
                    {row[header] ? formatNumberDisplay(row[header], meta.format) : <span className="text-muted/30">0.00</span>}
                  </div>
                )}
              </div>
            ) : (
              <div className={`flex flex-wrap items-center gap-x-2 ${alignClass} w-full min-h-7 ${isEditing ? 'p-0' : 'px-2 py-0.5'}`}>
                {isEditing ? (
                  <CellEditor
                    isTextarea
                    initialValue={row[header]}
                    onSync={(val: any) => handleUpdateCell(globalIndex, header, val)}
                    onKeyDown={(e: any) => handleKeyDown(e, globalIndex, colIndex, visibleHeaders)}
                    className={`${GRID_THEME.tableInput} flex-1 ${textAlignClass}`}
                    dataRow={globalIndex} dataCol={header}
                    onLocalEditing={onLocalEditing}
                    onCancel={() => setEditingCol(null)}
                  />
                ) : (
                  <div
                    data-row={globalIndex}
                    data-col={header}
                    onClick={(e) => handleCellClick(header, e)}
                    onDoubleClick={() => handleCellDoubleClick(header)}
                    className={`text-sm text-foreground cursor-text whitespace-pre-wrap wrap-break-word w-full ${textAlignClass}`}
                  >
                    {row[header] || <span className="opacity-0">.</span>}
                  </div>
                )}
              </div>
            )}
          </td>
        );
      })}
      <td className="border-r border-b border-border bg-transparent"></td>
    </tr>
  );
}, (prev, next) => {
  // 1. Check if the row data itself changed (Value-based comparison)
  // Since 'row' is a new object on every grid update, we must check the actual cell values
  // to determine if THIS specific row needs an update.
  const prevRow = prev.row;
  const nextRow = next.row;
  for (const h of next.visibleHeaders) {
    if (prevRow[h] !== nextRow[h]) return false;
  }

  // 2. Check if the active cell/selection affects this specific row
  const wasActive = prev.activeCell?.row === prev.globalIndex;
  const isActive = next.activeCell?.row === next.globalIndex;
  if (wasActive !== isActive) return false; // Row gained or lost active status

  // If it's the active row, re-render if the active column changed
  if (isActive && prev.activeCell?.col !== next.activeCell?.col) return false;

  // 3. Precise Selection Check: Only re-render if this row's relationship to selection changed
  const wasInSel = prev.selection &&
    prev.globalIndex >= Math.min(prev.selection.startRow, prev.selection.endRow) &&
    prev.globalIndex <= Math.max(prev.selection.startRow, prev.selection.endRow);
  const isInSel = next.selection &&
    next.globalIndex >= Math.min(next.selection.startRow, next.selection.endRow) &&
    next.globalIndex <= Math.max(next.selection.startRow, next.selection.endRow);

  if (wasInSel !== isInSel) return false;

  // If it's in the selection, re-render if selection bounds changed (to update cell highlights)
  if (isInSel && (
    prev.selection?.startCol !== next.selection?.startCol ||
    prev.selection?.endCol !== next.selection?.endCol ||
    prev.selection?.startRow !== next.selection?.startRow ||
    prev.selection?.endRow !== next.selection?.endRow
  )) return false;

  // 4. Performance Fix: Instead of checking the whole alignments object,
  // check if any alignment relevant to THIS row changed.
  const hasAlignChange = prev.visibleHeaders.some((h: string) => {
    const colIdx = prev.masterColumnOrder.indexOf(h);
    const key = toA1Key(prev.globalIndex, colIdx);
    return prev.cellAlignments[key] !== next.cellAlignments[key] ||
      prev.columnAlignments[h] !== next.columnAlignments[h];
  });
  if (hasAlignChange) return false;

  // 5. Performance Fix: Only re-render if metadata specifically for THIS row changed
  const hasMetaChange = prev.visibleHeaders.some((h: string) => {
    const colIdx = prev.masterColumnOrder.indexOf(h);
    const key = toA1Key(prev.globalIndex, colIdx);
    return prev.cellMetadata[key] !== next.cellMetadata[key];
  });
  if (hasMetaChange) return false;

  // 6. Check if height specifically for THIS row changed
  if (prev.rowHeights[String(prev.globalIndex)] !== next.rowHeights[String(next.globalIndex)]) return false;

  // 6. Precise dragFillRange Check: Only re-render if this row's relationship to dragFillRange changed
  const wasInDrag = prev.dragFillRange && prev.dragFillRange.col &&
    prev.globalIndex >= Math.min(prev.dragFillRange.startRow, prev.dragFillRange.endRow) &&
    prev.globalIndex <= Math.max(prev.dragFillRange.startRow, prev.dragFillRange.endRow);
  const isInDrag = next.dragFillRange && next.dragFillRange.col &&
    next.globalIndex >= Math.min(next.dragFillRange.startRow, next.dragFillRange.endRow) &&
    next.globalIndex <= Math.max(next.dragFillRange.startRow, next.dragFillRange.endRow);

  if (wasInDrag !== isInDrag) return false;

  if (isInDrag && (
    prev.dragFillRange?.col !== next.dragFillRange?.col ||
    prev.dragFillRange?.startRow !== next.dragFillRange?.startRow ||
    prev.dragFillRange?.endRow !== next.dragFillRange?.endRow
  )) return false;

  // 7. Standard UI state checks (excluding isSelecting and dragFillRange to prevent global row updates)
  return (
    prev.isFreezePanes === next.isFreezePanes &&
    prev.visibleHeaders === next.visibleHeaders &&
    prev.masterColumnOrder === next.masterColumnOrder &&
    prev.zoom === next.zoom
  );
});

GridRow.displayName = 'GridRow';
