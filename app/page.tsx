'use client';
import React, { useEffect, useState, useMemo, useCallback, Fragment, Suspense, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import { buildTree, FileNode, findNodeById } from '@/lib/tree-utils';
import FileNodeItem from '@/components/FileNodeItem';
import { Clock, User, HardDrive, Folder, Save, Code, Table as TableIcon, Plus, Trash2, X, AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Search, Printer, FileText, Share2, FolderPlus, FilePlus, PanelLeftClose, PanelLeftOpen, ChevronUp, ChevronDown, ArrowUp, Loader2, RefreshCcw, Calendar, Sigma, Image as ImageIcon, Paperclip, FileIcon, ChevronRight as ChevronRightIcon, Maximize2, Minimize2, Type, History, Moon, Sun, ZoomIn, ZoomOut, Check, MoreVertical } from 'lucide-react';

/**
 * Theme Registry: Centralized class management for Dark/Light mode consistency.
 * By using semantic variables defined in globals.css, we ensure automatic theme switching.
 */
const GRID_THEME = {
  // Main Layout Containers
  main: "flex h-screen bg-background bg-[linear-gradient(to_right,var(--color-grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-grid-line)_1px,transparent_1px)] bg-[size:24px_24px] text-foreground",
  rail: "w-12 bg-card flex flex-col items-center py-4 gap-4 z-20 border-r border-border",
  drawer: "bg-card flex flex-col shadow-sm transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap border-r border-border",
  editorContainer: "flex flex-col flex-1 min-h-0 overflow-hidden",
  
  // Grid Editor Components
  editor: "flex flex-col h-full overflow-hidden bg-card",
  toolbar: "flex items-center justify-between p-2 bg-background border-b border-border gap-2 overflow-x-auto no-scrollbar whitespace-nowrap",
  formulaBar: "flex items-start gap-2 p-1.5 bg-card border-b border-border shadow-inner z-20",
  statusBar: "h-7 bg-background border-t border-border flex items-center justify-between px-3 text-[10px] font-bold text-muted uppercase tracking-wider shrink-0 select-none",
  navContainer: "flex bg-muted/10 p-0.5 rounded-md border border-border",
  
  // Table Specific Styles
  tableHeader: "bg-muted/10 shadow-[0_1px_0_rgba(0,0,0,0.1)]",
  tableHeaderRow: "bg-muted/20 select-none h-5",
  tableIndexCell: "border-r border-b border-border",
  tableCell: "p-0 border-r border-b border-border bg-card group/cell relative align-middle",
  tableBodyRow: "hover:bg-muted/5 group relative",

  // Inputs and Interactive
  tableInput: "grid-input w-full px-2 py-1 text-sm text-foreground bg-transparent border-0 outline-none transition-all dark:bg-card whitespace-pre-wrap break-words",
};

const FONT_FAMILIES = [
  { id: 'sans', label: 'Inter (Default)', value: 'var(--font-geist-sans), ui-sans-serif, system-ui' },
  { id: 'roboto', label: 'Roboto', value: '"Roboto", sans-serif' },
  { id: 'opensans', label: 'Open Sans', value: '"Open Sans", sans-serif' },
  { id: 'serif', label: 'System Serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { id: 'mono', label: 'System Mono', value: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  { id: 'montserrat', label: 'Montserrat', value: '"Montserrat", sans-serif' },
];

const DATE_FORMATS = [
  { id: 'long', label: 'Monday, May 5, 2026' },
  { id: 'medium', label: 'May 5, 2026' },
  { id: 'short', label: '05/05/2026' },
  { id: 'iso', label: '2026-05-05' },
];

const NUMBER_FORMATS = [
  { id: 'decimal', label: 'Decimal (1,234.56)' },
  { id: 'currency', label: 'Currency (₱1,234.56)' },
  { id: 'percent', label: 'Percent (12.34%)' },
  { id: 'integer', label: 'Integer (1,235)' },
];

const LOCATIONS = [
  "Antonino, Labason, Zamboanga del Norte", "Balas, Labason, Zamboanga del Norte",
  "Bobongan, Labason, Zamboanga del Norte", "Dansalan, Labason, Zamboanga del Norte",
  "Gabu, Labason, Zamboanga del Norte", "Gil Sanchez, Labason, Zamboanga del Norte",
  "Imelda, Labason, Zamboanga del Norte", "Immaculada, Labason, Zamboanga del Norte",
  "Kipit, Labason, Zamboanga del Norte", "La Union, Labason, Zamboanga del Norte",
  "Lapatan, Labason, Zamboanga del Norte", "Lawagan, Labason, Zamboanga del Norte",
  "Lawigan, Labason, Zamboanga del Norte", "Lopoc, Labason, Zamboanga del Norte",
  "Malintuboan, Labason, Zamboanga del Norte", "New Salvacion, Labason, Zamboanga del Norte",
  "Osukan, Labason, Zamboanga del Norte", "Poblacion, Labason, Zamboanga del Norte",
  "Patawag, Labason, Zamboanga del Norte", "San Isidro, Labason, Zamboanga del Norte",
  "Ubay, Labason, Zamboanga del Norte"
];
const ALLOCATIONS = ["20%", "DepEd", "DA"];

const getExcelColumnLabel = (index: number): string => {
  let label = '';
  let i = index;
  while (i >= 0) {
    label = String.fromCharCode((i % 26) + 65) + label;
    i = Math.floor(i / 26) - 1;
  }
  return label;
};

const formatNumberDisplay = (value: any, formatId: string = 'decimal') => {
  if (value === "" || value === undefined || value === null) return "0.00";
  const num = Number(value);
  if (isNaN(num)) return value;
  switch (formatId) {
    case 'currency': return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num);
    case 'percent': return (num * 100).toFixed(2) + '%';
    case 'integer': return Math.round(num).toLocaleString();
    default: return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};

const formatDateDisplay = (value: string, formatId: string = 'long') => {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return value;
  switch (formatId) {
    case 'medium': return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    case 'short': return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    case 'iso': return value;
    default: return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
};

/**
 * CellEditor: Optimized uncontrolled-like component for instant typing.
 * Uses local state for characters and debounces the global "push" to gridData.
 */
const CellEditor = ({ initialValue, onSync, onKeyDown, className, isTextarea, type = "text", dataRow, dataCol }: any) => {
  const [localValue, setLocalValue] = useState(initialValue ?? '');
  const syncTimerRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset local state if external data changes (e.g., Undo/Redo)
  useEffect(() => {
    if (initialValue !== localValue) setLocalValue(initialValue ?? '');
  }, [initialValue]);

  const handleLocalChange = (val: any) => {
    setLocalValue(val);
    
    // Debounce: Wait 300ms before updating global state
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      onSync(val);
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
        onKeyDown={onKeyDown}
        className={`${className} resize-none overflow-hidden py-1.5 w-full block`}
      />
    );
  }

  return (
    <input
      type={type}
      step={type === 'number' ? '0.01' : undefined}
      data-row={dataRow}
      data-col={dataCol}
      value={localValue}
      autoFocus
      onBlur={handleBlur}
      onChange={(e) => handleLocalChange(type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value)}
      onKeyDown={onKeyDown}
      className={`${className} w-full`}
    />
  );
};

const GridRow = React.memo(({ 
  row, globalIndex, visibleHeaders, activeCell, selection, 
  cellMetadata, cellAlignments, columnAlignments, isFreezePanes,
  dragFillRange, isSelecting, handleUpdateCell, handleKeyDown,
  setActiveCell, setSelection, setIsSelecting, onOpenContextMenu,
  toggleCellAlignment, handleDragFillStart, removeTableRow,
  setViewingMedia, removeCellMetadata, evaluateFormula,
  rowHeights, startRowResizing, handleOpenDropdown
}: any) => {
  const isRowActive = activeCell?.row === globalIndex;
  const selMinRow = selection ? Math.min(selection.startRow, selection.endRow) : -2;
  const selMaxRow = selection ? Math.max(selection.startRow, selection.endRow) : -2;
  const selMinColIdx = selection ? Math.min(visibleHeaders.indexOf(selection.startCol), visibleHeaders.indexOf(selection.endCol)) : -1;
  const selMaxColIdx = selection ? Math.max(visibleHeaders.indexOf(selection.startCol), visibleHeaders.indexOf(selection.endCol)) : -1;

  return (
    <tr className={GRID_THEME.tableBodyRow} style={{ height: rowHeights[globalIndex] ? `${rowHeights[globalIndex]}px` : undefined }}>
      <td
        className={`relative group/row-index w-10 min-w-[40px] text-[10px] font-bold text-center select-none cursor-pointer ${GRID_THEME.tableIndexCell} ${
          isRowActive ? 'bg-accent/10 text-accent shadow-[inset_-2px_0_0_0_var(--color-accent)]' : 'bg-muted/10 text-muted hover:bg-muted/30 hover:text-foreground'
        } ${isFreezePanes ? 'sticky left-0 z-10 bg-card shadow-[1px_0_0_0_var(--color-border),0_1px_0_0_var(--color-border)]' : ''}`}
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
          onOpenContextMenu(e, 'row', globalIndex, "");
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
        const cellKey = `${globalIndex}:${header}`;
        const meta = cellMetadata[cellKey] || {};
        if (meta.mergedIn) return null;
        const cellAlign = cellAlignments[cellKey] || columnAlignments[header] || ((header === "Title / Item" || header === "Amount") ? "right" : "left");
        // Fix: Use both text-alignment and flex-justification classes
        const alignClass = cellAlign === 'center' ? 'text-center justify-center' : cellAlign === 'right' ? 'text-right justify-end' : 'text-left justify-start';

        const isInSelection = selection && globalIndex >= selMinRow && globalIndex <= selMaxRow && colIndex >= selMinColIdx && colIndex <= selMaxColIdx;

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
              onOpenContextMenu(e, 'cell', globalIndex, header);
            }}
            onMouseDown={(e) => { 
              if (e.button === 0) { 
                setActiveCell({ row: globalIndex, col: header }); 
                setSelection({ startRow: globalIndex, endRow: globalIndex, startCol: header, endCol: header }); 
                setIsSelecting(true); 
              } 
            }}
            onMouseEnter={() => { if (isSelecting) setSelection((prev: any) => prev ? { ...prev, endRow: globalIndex, endCol: header } : null); }}
            onClick={() => {
              const input = document.querySelector(`[data-row="${globalIndex}"][data-col="${header}"]`) as HTMLElement;
              if (input) input.focus();
            }}
            className={`${GRID_THEME.tableCell} ${meta.fontFamily ? '' : 'font-sans'} ${isFreezePanes && header === "Title / Item" ? "sticky left-10 z-10 shadow-[1px_0_0_0_var(--color-border)]" : ""} ${activeCell?.row === globalIndex && activeCell?.col === header ? 'ring-2 ring-inset ring-accent z-20' : ''} ${isInSelection ? `bg-accent/10 z-10 ring-1 ring-inset ring-accent/30` : ''}`}
            style={{ fontFamily: meta.fontFamily || 'inherit', height: '1px' /* Forces cell to respect content height */ }}
          >
            {activeCell?.row === globalIndex && activeCell?.col === header && (
              <>
                <div onMouseDown={(e) => handleDragFillStart(e, globalIndex, header)} className="hidden md:block absolute bottom-0 right-0 w-2 h-2 bg-accent border border-card cursor-crosshair z-30 -mb-[3px] -mr-[3px] shadow-sm rounded-full" />
                {/* Mobile-friendly context menu trigger */}
                <button onClick={(e) => onOpenContextMenu(e, 'cell', globalIndex, header)} className="md:hidden absolute top-0 right-0 p-1 text-accent bg-card/80 rounded-bl shadow-sm z-30">
                  <MoreVertical size={12} />
                </button>
              </>
            )}
            <button onClick={(e) => { e.stopPropagation(); toggleCellAlignment(globalIndex, header); }} className="absolute right-1 top-1 opacity-0 group-hover/cell:opacity-100 p-1 text-muted hover:text-accent bg-card/90 rounded shadow-sm z-30 transition-all">
              {cellAlign === 'center' ? <AlignCenter size={10} /> : cellAlign === 'right' ? <AlignRight size={10} /> : <AlignLeft size={10} />}
            </button>
            {header === 'Location' || header === 'Allocation' ? (
              <button 
                onClick={(e) => handleOpenDropdown(e, globalIndex, header, header === 'Location' ? LOCATIONS : ALLOCATIONS)}
                className={`${GRID_THEME.tableInput} relative flex items-center group/drop min-h-[28px] hover:bg-accent/5 pr-6 py-1.5 w-full`}
              >
                <span className={`w-full break-words whitespace-normal leading-tight ${cellAlign === 'center' ? 'text-center' : cellAlign === 'right' ? 'text-right' : 'text-left'}`}>
                  {row[header] || <span className="text-muted/40 italic font-normal">Select...</span>}
                </span>
                <ChevronDown size={12} className="absolute right-1.5 text-muted/50 group-hover/drop:text-accent shrink-0 transition-colors" />
              </button>
            ) : meta.type === 'date' ? (
              <div className="relative w-full flex items-center group/date min-h-[28px]">
                <input type="date" data-row={globalIndex} data-col={header} value={row[header] || ''} onChange={(e) => handleUpdateCell(globalIndex, header, e.target.value)} className="absolute inset-0 opacity-0 z-20 cursor-pointer w-full h-full" />
                <div className={`w-full px-2 py-1.5 text-sm text-foreground ${alignClass} group-hover:bg-accent/10 flex items-center break-words flex-1 ${cellAlign === 'center' ? 'justify-center' : cellAlign === 'right' ? 'justify-end' : 'justify-start'}`}>
                  {row[header] ? formatDateDisplay(row[header], meta.format) : <span className="text-muted/50 font-normal italic flex items-center gap-1.5"><Calendar size={14} className="shrink-0" /> Set Date...</span>}
                </div>
              </div>
            ) : meta.type === 'media' ? (
              <div className="flex items-center group/media relative min-h-[28px] w-full px-2 py-1">
                {meta.attachments?.length > 0 && (
                  <button onClick={() => setViewingMedia({ attachments: meta.attachments, row: globalIndex, col: header })} className={`text-xs text-accent hover:underline font-medium w-full ${alignClass}`}>[View Attachment{meta.attachments.length > 1 ? 's' : ''}]</button>
                )}
                <button onClick={(e) => { e.stopPropagation(); removeCellMetadata(globalIndex, header); }} className="opacity-0 group-hover/media:opacity-100 p-1 text-muted hover:text-red-500 absolute right-1 top-1 bg-card/80 rounded shadow-sm transition-all"><X size={12} /></button>
              </div>
            ) : meta.type === 'formula' ? (
              <div onClick={() => setActiveCell({ row: globalIndex, col: header })} className={`w-full px-2 py-1.5 text-sm text-foreground cursor-text min-h-[28px] flex items-center break-words ${activeCell?.row === globalIndex && activeCell?.col === header ? 'bg-accent/10' : 'hover:bg-muted/10'} ${alignClass}`}>
                {(() => { const result = evaluateFormula(row[header], row, meta.format); return typeof result === 'number' ? formatNumberDisplay(result, meta.format) : result; })()}
              </div>
            ) : (meta.type === 'number' || header === 'Amount') ? (
              activeCell?.row === globalIndex && activeCell?.col === header ? (
                <CellEditor 
                  initialValue={row[header]} 
                  onSync={(val: any) => handleUpdateCell(globalIndex, header, val)} 
                  onKeyDown={(e: any) => handleKeyDown(e, globalIndex, colIndex, visibleHeaders)} 
                  className={`${GRID_THEME.tableInput} ${alignClass}`}
                  type="number"
                />
              ) : (
                <div onClick={() => setActiveCell({ row: globalIndex, col: header })} className={`w-full px-2 py-1 text-sm text-foreground cursor-text min-h-[28px] flex items-center ${alignClass}`}>{row[header] ? formatNumberDisplay(row[header], meta.format) : <span className="text-muted/30">0.00</span>}</div>
              )
            ) : (
              activeCell?.row === globalIndex && activeCell?.col === header ? (
                <CellEditor 
                  isTextarea 
                  initialValue={row[header]} 
                  onSync={(val: any) => handleUpdateCell(globalIndex, header, val)} 
                  onKeyDown={(e: any) => handleKeyDown(e, globalIndex, colIndex, visibleHeaders)} 
                  className={`${GRID_THEME.tableInput} ${alignClass}`}
                  dataRow={globalIndex} dataCol={header}
                />
              ) : (
                <div 
                  onClick={() => setActiveCell({ row: globalIndex, col: header })} 
                  className={`w-full px-2 py-1.5 text-sm text-foreground cursor-text min-h-[28px] whitespace-pre-wrap break-words ${alignClass}`}
                >
                  {row[header] || <span className="opacity-0">.</span>}
                </div>
              )
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
    const key = `${prev.globalIndex}:${h}`;
    return prev.cellAlignments[key] !== next.cellAlignments[key] || 
           prev.columnAlignments[h] !== next.columnAlignments[h];
  });
  if (hasAlignChange) return false;
  
  // 5. Performance Fix: Only re-render if metadata specifically for THIS row changed
  const hasMetaChange = prev.visibleHeaders.some((h: string) => {
    const key = `${prev.globalIndex}:${h}`;
    return prev.cellMetadata[key] !== next.cellMetadata[key];
  });
  if (hasMetaChange) return false;
  
  // 6. Check if height specifically for THIS row changed
  if (prev.rowHeights[prev.globalIndex] !== next.rowHeights[next.globalIndex]) return false;

  // 6. Standard UI state checks
  return (
    prev.isSelecting === next.isSelecting && 
    prev.isFreezePanes === next.isFreezePanes &&
    prev.visibleHeaders === next.visibleHeaders &&
    prev.dragFillRange === next.dragFillRange
  );
});

/**
 * Sparse Model Utilities
 * Converts Array of Objects [{col: val}] to Map "row:col" -> val
 */
const arrayToSparseMap = (data: any[]): Map<string, any> => {
  const map = new Map<string, any>();
  data.forEach((row, rowIndex) => {
    Object.entries(row).forEach(([colName, value]) => {
      map.set(`${rowIndex}:${colName}`, value);
    });
  });
  return map;
};

const sparseMapToArray = (map: Map<string, any>, rowCount: number, headers: string[]): any[] => {
  const result = [];
  for (let r = 0; r < rowCount; r++) {
    const row: any = {};
    headers.forEach(h => {
      const val = map.get(`${r}:${h}`);
      if (val !== undefined) row[h] = val;
    });
    // Critical: Ensure the section property is preserved in the exported array
    row.section = map.get(`${r}:section`) || "Uncategorized";
    result.push(row);
  }
  return result;
};

function DashboardContent() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gridData, setGridData] = useState<Map<string, any>>(new Map()); // Sparse Map State
  const [rowCount, setRowCount] = useState(0);
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'table' | 'compare'>('table');
  const [columnAlignments, setColumnAlignments] = useState<Record<string, 'left' | 'center' | 'right'>>({});
  const [cellAlignments, setCellAlignments] = useState<Record<string, 'left' | 'center' | 'right'>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [cellMetadata, setCellMetadata] = useState<Record<string, any>>({});
  const [rowFilter, setRowFilter] = useState<string>('');
  const [newColName, setNewColName] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('2020');
  const searchParams = useSearchParams();
  const [isExplorerVisible, setIsExplorerVisible] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [activeCell, setActiveCell] = useState<{ row: number, col: string } | null>(null);
  const formulaBarRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingMedia, setPendingMedia] = useState<{ row: number, col: string, type: 'image' | 'file' } | null>(null);
  const [viewingMedia, setViewingMedia] = useState<any | null>(null);
  const [dropdownMenu, setDropdownMenu] = useState<{ x: number, y: number, width: number, row: number, col: string, options: string[] } | null>(null);

  // Virtualization State
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800); // Sane initial height to prevent partial render
  const DEFAULT_ROW_HEIGHT = 32; // Standard height for our rows

  // Resize Observer to track viewport height for virtualization
  useEffect(() => {
    if (!tableContainerRef.current || viewMode !== 'table') return;
    
    // Immediate initial measurement to sync virtualization bounds
    setContainerHeight(tableContainerRef.current.clientHeight || 800);

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(tableContainerRef.current);
    return () => observer.disconnect();
  }, [viewMode, selectedId, isExplorerVisible]);

  // Responsive Sidebar: Desktop: Open by default, Mobile: Hidden by default
  useEffect(() => {
    const handleResponsiveSidebar = () => {
      // Threshold 768px (md breakpoint)
      if (window.innerWidth >= 768) setIsExplorerVisible(true);
      else setIsExplorerVisible(false);
    };
    handleResponsiveSidebar();
    window.addEventListener('resize', handleResponsiveSidebar);
    return () => window.removeEventListener('resize', handleResponsiveSidebar);
  }, []);

  /**
   * Intelligent Context Menu Positioning
   * Nudges the menu coordinates just enough to keep it inside the viewport.
   * This prevents the menu from "jumping" too far away from the cursor.
   */
  const handleOpenContextMenu = useCallback((e: React.MouseEvent, type: 'cell' | 'header' | 'row', row?: number, col: string = "") => {
    e.preventDefault();
    const menuWidth = 192; 
    // Refined height estimates based on current item counts
    const menuHeight = type === 'row' ? 280 : (type === 'header' ? 380 : 440); 
    
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Nudge logic: If the menu would overflow, align its edge with the screen edge
    if (x + menuWidth > winW) x = winW - menuWidth - 10;
    if (y + menuHeight > winH) y = winH - menuHeight - 10;
    
    // Ensure it doesn't go off the top/left after adjustment
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    setContextMenu({ x, y, row, col, type });
  }, []);

  const handleOpenDropdown = useCallback((e: React.MouseEvent, row: number, col: string, options: string[]) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    
    setDropdownMenu({
      x: rect.left,
      y: rect.bottom + 4,
      width: rect.width,
      row,
      col,
      options
    });
  }, []);

  const [codeViewContent, setCodeViewContent] = useState<string>('');
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [dragFillRange, setDragFillRange] = useState<{ startRow: number; endRow: number; col: string } | null>(null);
  const [selection, setSelection] = useState<{ startRow: number; endRow: number; startCol: string; endCol: string } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFreezePanes, setIsFreezePanes] = useState(false);
  const [recentNodes, setRecentNodes] = useState<FileNode[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [zoom, setZoom] = useState(1);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const editStartValueRef = useRef<any>(null);
  const editingCellRef = useRef<{row: number, col: string} | null>(null);

  /**
   * History Management: Undo/Redo Engine
   * Leverages Sparse Map referential stability for efficient snapshots.
   */
  // Optimization: Use a ref to track current state for history snapshots.
  // This prevents 'saveStateToHistory' (and thus 'handleUpdateCell') from changing identity 
  // on every keystroke, which is the primary cause of typing lag.
  const stateRef = useRef({ gridData, rowCount, cellMetadata, cellAlignments, rowHeights });
  useEffect(() => {
    stateRef.current = { gridData, rowCount, cellMetadata, cellAlignments, rowHeights };
  }, [gridData, rowCount, cellMetadata, cellAlignments, rowHeights]);

  const saveStateToHistory = useCallback(() => {
    const { gridData, rowCount, cellMetadata, cellAlignments, rowHeights } = stateRef.current;
    const snapshot = {
      gridData: new Map(gridData),
      rowCount: rowCount,
      cellMetadata: { ...cellMetadata },
      cellAlignments: { ...cellAlignments },
      rowHeights: { ...rowHeights }
    };
    setUndoStack(prev => [...prev, snapshot].slice(-50)); // Limit to 50 steps
    setRedoStack([]);
  }, []); // Stable identity: never changes

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevState = undoStack[undoStack.length - 1];
    const currentState = {
      gridData: new Map(gridData),
      rowCount,
      cellMetadata: { ...cellMetadata },
      cellAlignments: { ...cellAlignments },
      rowHeights: { ...rowHeights }
    };
    setRedoStack(prev => [...prev, currentState]);
    setUndoStack(prev => prev.slice(0, -1));
    setGridData(prevState.gridData);
    setRowCount(prevState.rowCount);
    setCellMetadata(prevState.cellMetadata);
    setCellAlignments(prevState.cellAlignments);
    setRowHeights(prevState.rowHeights);
  }, [undoStack, gridData, rowCount, cellMetadata, cellAlignments, rowHeights]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    const currentState = {
      gridData: new Map(gridData),
      rowCount,
      cellMetadata: { ...cellMetadata },
      cellAlignments: { ...cellAlignments },
      rowHeights: { ...rowHeights }
    };
    setUndoStack(prev => [...prev, currentState]);
    setRedoStack(prev => prev.slice(0, -1));
    setGridData(nextState.gridData);
    setRowCount(nextState.rowCount);
    setCellMetadata(nextState.cellMetadata);
    setCellAlignments(nextState.cellAlignments);
    setRowHeights(nextState.rowHeights);
  }, [redoStack, gridData, rowCount, cellMetadata, cellAlignments, rowHeights]);

  // Keyboard Shortcuts (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redo();
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [undo, redo]);

  // Track cell value before editing starts for atomic undo
  useEffect(() => {
    if (activeCell) {
      const val = gridData.get(`${activeCell.row}:${activeCell.col}`);
      if (editingCellRef.current?.row !== activeCell.row || editingCellRef.current?.col !== activeCell.col) {
        editStartValueRef.current = val;
        editingCellRef.current = activeCell;
      }
    } else {
      editingCellRef.current = null;
      editStartValueRef.current = null;
    }
  }, [activeCell, gridData]);

  const activeNode = useMemo(() => 
    selectedId ? findNodeById(tree, selectedId) : null
  , [tree, selectedId]);

  // Load preferences from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('meo-recent-files');
    if (saved) {
      try { setRecentNodes(JSON.parse(saved)); } catch (e) { console.error("Failed to parse recent files"); }
    }
    
    const savedTheme = localStorage.getItem('meo-theme') as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
  }, []);

  // Advanced theme toggle with View Transitions API support
  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    
    // @ts-ignore - View Transitions API
    if (!document.startViewTransition) {
      setTheme(next);
      return;
    }

    // @ts-ignore
    document.startViewTransition(() => setTheme(next));
  }, [theme]);

  // Sync theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('meo-theme', theme);
  }, [theme]);

  // Track active file history
  useEffect(() => {
    if (activeNode && activeNode.type === 'file') {
      setRecentNodes(prev => {
        const filtered = prev.filter(n => n.id !== activeNode.id);
        const updated = [activeNode, ...filtered].slice(0, 5);
        localStorage.setItem('meo-recent-files', JSON.stringify(updated));
        return updated;
      });
    }
  }, [activeNode]);

  // End selection on global mouse up
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsSelecting(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Synchronize code view content when switching to code mode or selecting a node
  useEffect(() => {
    // If we are currently editing the code, don't overwrite the user's input
    // unless the view mode or active node has actually changed.
    if (viewMode !== 'code') return;

    if (viewMode === 'code' && activeNode) {
      const fullData = {
        content: gridData, // No parsing needed
        display_settings: {
          columnAlignments,
          cellAlignments,
          hiddenColumns,
          selectedYear,
          columnOrder,
          columnWidths,
          cellMetadata
        }
      };
      const newCode = JSON.stringify(fullData, null, 2);
      if (newCode !== codeViewContent) {
        setCodeViewContent(newCode);
      }
    }
  }, [viewMode, activeNode?.id, gridData, columnAlignments, cellAlignments, hiddenColumns, selectedYear, columnOrder, columnWidths, cellMetadata, codeViewContent]);

  const handleCodeChange = (val: string) => {
    setCodeViewContent(val);
    try {
      const parsed = JSON.parse(val);
      
      // If user pasted/typed the full document structure
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.content)) {
        setGridData(arrayToSparseMap(parsed.content)); // Update native state
        setRowCount(parsed.content.length);
        if (parsed.display_settings) {
          const ds = parsed.display_settings;
          setColumnAlignments(ds.columnAlignments || {});
          setCellAlignments(ds.cellAlignments || {});
          setHiddenColumns(ds.hiddenColumns || []);
          setSelectedYear(ds.selectedYear || '2020');
          setColumnOrder(ds.columnOrder || []);
          setColumnWidths(ds.columnWidths || {});
          setCellMetadata(ds.cellMetadata || {});
          setRowHeights(ds.rowHeights || {});
        }
      } 
      // If user pasted/typed just the data array (backward compatibility)
      else if (Array.isArray(parsed)) {
        setGridData(arrayToSparseMap(parsed));
        setRowCount(parsed.length);
      }
    } catch (e) {
      // Keep codeViewContent as is so user can fix syntax errors
    }
  };

  const allHeaders = useMemo(() => {
    if (columnOrder.length > 0) return columnOrder;
    return ["Title / Item", "Amount", "Location", "Allocation", "Notes"];
  }, [columnOrder]);

  const visibleHeaders = useMemo(() => {
    return allHeaders.filter(header => !hiddenColumns.includes(header) && header !== 'section');
  }, [allHeaders, columnOrder, hiddenColumns]);

  // Derived Data & Filtering (Moved to top-level to satisfy Rules of Hooks)
  // The 'data' array is now only rebuilt if gridData actually changes.
  const data = useMemo(() => {
    return Array.from({ length: rowCount }).map((_, i) => {
      const rowObj: any = { _index: i };
      allHeaders.forEach(h => rowObj[h] = gridData.get(`${i}:${h}`));
      rowObj.section = gridData.get(`${i}:section`) || "Uncategorized";
      return rowObj;
    });
  }, [gridData, rowCount, allHeaders]);

  const filteredRows = useMemo(() => {
    if (!rowFilter) return data;
    const lowerCaseFilter = rowFilter.toLowerCase();
    return data.filter((row: any) => 
      Object.values(row).some(value => 
        String(value).toLowerCase().includes(lowerCaseFilter)
      )
    );
  }, [data, rowFilter]);

  const sectionBlocks = useMemo(() => {
    const blocks: { name: string, rows: any[] }[] = [];
    filteredRows.forEach(row => {
      const sectionName = row.section || "Uncategorized";
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.name === sectionName) lastBlock.rows.push(row);
      else blocks.push({ name: sectionName, rows: [row] });
    });
    return blocks;
  }, [filteredRows]);

  // Virtualization: Flatten sections and rows with accurate height offsets
  const { flatItems, itemOffsets, totalVirtualHeight } = useMemo(() => {
    const items: any[] = [];
    const offsets: number[] = [];
    let currentOffset = 0;

    sectionBlocks.forEach((block, blockIdx) => {
      offsets.push(currentOffset);
      items.push({ type: 'section', name: block.name, startIndex: block.rows[0]._index, blockIdx });
      currentOffset += 32; // Header is h-8 (32px)

      block.rows.forEach(row => {
        offsets.push(currentOffset);
        items.push({ type: 'row', data: row });
        currentOffset += (rowHeights[row._index] || 32);
      });
    });

    return { flatItems: items, itemOffsets: offsets, totalVirtualHeight: currentOffset };
  }, [sectionBlocks, rowHeights]);

  const setColumnAlignment = useCallback((header: string, align: 'left' | 'center' | 'right') => {
    setColumnAlignments(prev => ({ ...prev, [header]: align }));
    // Clear cell-specific overrides in this column to ensure the whole column follows the new setting
    setCellAlignments(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (key.endsWith(`:${header}`)) delete next[key];
      });
      return next;
    });
    setContextMenu(null);
  }, []);

  // Kept for backward compatibility if needed elsewhere, but cycles alignments
  const toggleAlignment = useCallback((header: string) => {
    const current = columnAlignments[header] || ((header === "Title / Item" || header === "Amount") ? "right" : "left");
    const nextMap: Record<string, 'left' | 'center' | 'right'> = { left: 'center', center: 'right', right: 'left' };
    setColumnAlignment(header, nextMap[current]);
  }, [columnAlignments, setColumnAlignment]);

  // Auto-expand formula bar height based on content
  useEffect(() => {
    if (formulaBarRef.current) {
      formulaBarRef.current.style.height = 'auto';
      formulaBarRef.current.style.height = `${formulaBarRef.current.scrollHeight}px`;
    }
  }, [activeCell, gridData]);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, row?: number, col: string, type: 'cell' | 'header' | 'row', showFormats?: boolean, showFormulaFormats?: boolean, showNumberFormats?: boolean, showFonts?: boolean } | null>(null);
  const evaluateFormula = useCallback((value: any, rowData: any, formatId?: string) => {
    if (typeof value !== 'string' || !value.startsWith('=')) return value;
    try {
      const getColumnValue = (colName: string) => {
        const actualKey = Object.keys(rowData).find(key => key.toLowerCase() === colName.toLowerCase());
        return actualKey ? rowData[actualKey] : null;
      };
      if (value.toUpperCase().startsWith('=SUM(')) {
        const match = value.match(/=SUM\((.*)\)/i);
        if (!match) return '#ERROR!';
        const args = match[1].split(',').map(s => s.trim());
        return args.reduce((acc, colName) => acc + (Number(getColumnValue(colName)) || 0), 0);
      }
      if (value.toUpperCase().startsWith('=ADD_DAYS(')) {
        const match = value.match(/=ADD_DAYS\((.*)\)/i);
        if (!match) return '#ERROR!';
        const args = match[1].split(',').map(s => s.trim());
        if (args.length !== 2) return '#ARGS!';
        const startDateRaw = getColumnValue(args[0]);
        const daysToAdd = Number(getColumnValue(args[1]) ?? args[1]) || 0;
        if (!startDateRaw) return '';
        let date = new Date(startDateRaw);
        if (isNaN(date.getTime())) return '#DATE!';
        date.setDate(date.getDate() + daysToAdd);
        return formatDateDisplay(date.toISOString().split('T')[0], formatId);
      }
    } catch (e) { return '#ERR!'; }
    return value;
  }, []);

  const resizingRowRef = useRef<{ row: number; startY: number; startHeight: number } | null>(null);

  const startRowResizing = useCallback((row: number, e: React.MouseEvent) => {
    e.preventDefault();
    const tr = (e.target as HTMLElement).closest('tr');
    if (!tr) return;

    resizingRowRef.current = {
      row,
      startY: e.pageY,
      startHeight: tr.offsetHeight,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const current = resizingRowRef.current;
      if (!current) return;
      const delta = moveEvent.pageY - current.startY;
      const newHeight = Math.max(28, current.startHeight + delta);
      setRowHeights(prev => ({ ...prev, [current.row]: newHeight }));
    };

    const handleMouseUp = () => {
      resizingRowRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
  }, []);

  const resizingRef = useRef<{ header: string; startX: number; startWidth: number } | null>(null);

  const startResizing = useCallback((header: string, e: React.MouseEvent) => {
    e.preventDefault();
    const th = (e.target as HTMLElement).closest('th');
    if (!th) return;

    resizingRef.current = {
      header,
      startX: e.pageX,
      startWidth: th.offsetWidth,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const current = resizingRef.current;
      if (!current) return;
      const delta = moveEvent.pageX - current.startX;
      const newWidth = Math.max(80, current.startWidth + delta);
      
      // Uniform Resizing: Check if this column is part of a multi-column selection
      const startColIdx = visibleHeaders.indexOf(selection?.startCol || "");
      const endColIdx = visibleHeaders.indexOf(selection?.endCol || "");
      const currentColIdx = visibleHeaders.indexOf(current.header);
      
      const isPartofSelection = selection && 
        (selection.startRow === 0 || selection.startRow === -1) && 
        selection.endRow === rowCount - 1 &&
        currentColIdx >= Math.min(startColIdx, endColIdx) && 
        currentColIdx <= Math.max(startColIdx, endColIdx);

      if (isPartofSelection && selection) {
        const minColIdx = Math.min(startColIdx, endColIdx);
        const maxColIdx = Math.max(startColIdx, endColIdx);
        setColumnWidths(prev => {
          const next = { ...prev };
          for (let i = minColIdx; i <= maxColIdx; i++) {
            next[visibleHeaders[i]] = newWidth;
          }
          return next;
        });
      } else {
        setColumnWidths(prev => ({
          ...prev,
          [current.header]: newWidth
        }));
      }
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [selection, visibleHeaders, rowCount]);

  const scrollToTop = () => {
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Recursive filter logic for the explorer tree
  const filteredTree = useMemo(() => {
    if (!explorerSearch.trim()) return tree;

    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.flatMap((node) => {
        const matchesSelf = node.name.toLowerCase().includes(explorerSearch.toLowerCase());
        const filteredChildren = node.children ? filterNodes(node.children) : [];

        if (matchesSelf || filteredChildren.length > 0) {
          return [{ ...node, children: filteredChildren }];
        }
        return [];
      });
    };

    return filterNodes(tree);
  }, [tree, explorerSearch]);

  // Dismiss context menu on click elsewhere
  useEffect(() => {
    const handleGlobalClick = (e: any) => {
      // Prevent closing if the scroll event is coming from within the dropdown or context menu
      if (e.type === 'scroll' && e.target instanceof HTMLElement) {
        if (e.target.closest('.dropdown-container') || e.target.closest('.context-menu-container')) return;
      }
      setContextMenu(null);
      setDropdownMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('scroll', handleGlobalClick, true);
    return () => { window.removeEventListener('click', handleGlobalClick); window.removeEventListener('scroll', handleGlobalClick, true); };
  }, []);

  // Handle incoming share link ID from URL
  useEffect(() => {
    const urlId = searchParams.get('id');
    if (urlId) {
      setSelectedId(urlId);
    }
  }, [searchParams]);

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('nodes').select('*').order('name');
    
    if (error) {
      console.error('Error fetching files:', error.message);
    } else if (data) {
      setTree(buildTree(data as FileNode[]));
    }
    setIsLoading(false);
  }, []);

  const addItem = async (type: 'file' | 'folder', parentId: string | null = null) => {
    const name = window.prompt(`Enter ${type} name:`);
    if (!name) return;

    const { error } = await supabase.from('nodes').insert([{ name, type, parent_id: parentId }]);
    if (error) {
      alert(`Failed to create ${type}: ${error.message}`);
      return;
    }
    fetchFiles();
  };

  const handleRename = async (id: string) => {
    const node = findNodeById(tree, id);
    const name = window.prompt('Enter new name:', node?.name);
    if (!name) return;

    const { error } = await supabase.from('nodes').update({ name }).eq('id', id);
    if (error) {
      alert(`Failed to rename: ${error.message}`);
      return;
    }
    fetchFiles();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    const { error } = await supabase.from('nodes').delete().eq('id', id);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }
    if (selectedId === id) setSelectedId(null);
    fetchFiles();
  };

  const handleUpdateCell = useCallback((index: number, key: string, value: any) => {
    const coord = `${index}:${key}`;
    // Get current value from the latest ref to avoid stale closure issues
    if (stateRef.current.gridData.get(coord) === value) return;

    // Atomic Undo: Only save history if this is the start of an edit
    if (editStartValueRef.current === stateRef.current.gridData.get(coord)) {
      saveStateToHistory();
    }

    setGridData(prev => {
      const next = new Map(prev);
      next.set(coord, value);
      return next;
    });
  }, [saveStateToHistory]); // Stable identity because saveStateToHistory is now stable

  /**
   * Renames only a specific contiguous block of rows.
   * This prevents split sections from being merged back together accidentally.
   */
  const handleRenameSectionBlock = (startIndex: number, oldName: string, newName: string) => {
    if (!newName || oldName === newName) return;
    
    saveStateToHistory();
    setGridData(prev => {
      const next = new Map(prev);
      // Find the bounds of the contiguous block starting at startIndex
      let r = startIndex;
      while (r < rowCount && next.get(`${r}:section`) === oldName) {
        next.set(`${r}:section`, newName);
        r++;
      }
      // Also look upwards in case startIndex wasn't the very first row of the block
      r = startIndex - 1;
      while (r >= 0 && next.get(`${r}:section`) === oldName) {
        next.set(`${r}:section`, newName);
        r--;
      }
      return next;
    });
  };

  const handleAddSection = () => {
    const sectionName = window.prompt("Enter new section name:");
    if (!sectionName) return;
    saveStateToHistory();
    const newIdx = rowCount;
    setGridData(prev => {
      const next = new Map(prev);
      next.set(`${newIdx}:Title / Item`, "a.");
      next.set(`${newIdx}:section`, sectionName);
      return next;
    });
    setRowCount(prev => prev + 1);
  };

  const handleInsertSection = (relativeSectionName: string, position: 'before' | 'after', specificIndex?: number) => {
    saveStateToHistory();
    let targetRow = -1;
    if (specificIndex !== undefined) {
      targetRow = specificIndex;
    } else {
      for (let r = 0; r < rowCount; r++) {
        if (gridData.get(`${r}:section`) === relativeSectionName) {
          if (position === 'before') { targetRow = r; break; }
          targetRow = r; 
        }
      }
    }

    if (targetRow === -1) targetRow = rowCount;
    const insertionIndex = position === 'before' ? targetRow : targetRow + 1;

    // Determine if we are splitting an existing block or creating a new empty slot
    const splitSourceSection = gridData.get(`${targetRow}:section`) || "Uncategorized";
    const isActuallySplitting = specificIndex !== undefined && 
                                insertionIndex < rowCount && 
                                (gridData.get(`${insertionIndex}:section`) || "Uncategorized") === splitSourceSection;

    const sectionName = window.prompt(`Enter new section name to ${isActuallySplitting ? 'split section at' : 'insert at'} row ${insertionIndex + 1}:`);
    if (!sectionName) return;

    if (isActuallySplitting) {
      // SPLIT MODE: Simply rename the remaining contiguous block of rows. No physical row insertion.
      setGridData(prev => {
        const next = new Map(prev);
        let r = insertionIndex;
        while (r < rowCount && (next.get(`${r}:section`) || "Uncategorized") === splitSourceSection) {
          next.set(`${r}:section`, sectionName);
          r++;
        }
        return next;
      });
      return; 
    }

    // INSERT MODE: Create a new row slot and shift existing data (used for header buttons or appending)
    const shiftKeys = (prev: Record<string, any>) => {
      const next: Record<string, any> = {};
      Object.keys(prev).forEach(key => {
        if (key.startsWith('header:')) { next[key] = prev[key]; return; }
        const [rStr, ...cParts] = key.split(':');
        const r = parseInt(rStr);
        if (isNaN(r)) { next[key] = prev[key]; return; }
        if (r < insertionIndex) next[key] = prev[key];
        else next[`${r + 1}:${cParts.join(':')}`] = prev[key];
      });
      return next;
    };

    setCellMetadata(shiftKeys);
    setCellAlignments(shiftKeys);
    setRowHeights(prev => {
      const next: Record<number, number> = {};
      Object.keys(prev).forEach(k => {
        const r = parseInt(k);
        if (r < insertionIndex) next[r] = prev[r];
        else next[r + 1] = prev[r];
      });
      return next;
    });

    // 3. Update data Map: Shift everything and perform the "Split"
    setGridData(prev => {
      const next = new Map();
      // Shift existing rows
      prev.forEach((val, key) => {
        const [rStr, col] = key.split(':');
        const r = parseInt(rStr);
        if (r < insertionIndex) {
          next.set(key, val);
        } else {
          // Rows being pushed down
          const newIdx = r + 1;
          const isSectionKey = col === 'section';
          
          // If we are pushing down rows that were part of the split section block,
          // they move into the NEW section.
          if (isSectionKey && val === splitSourceSection && r >= targetRow) {
            next.set(`${newIdx}:section`, sectionName);
          } else {
            next.set(`${newIdx}:${col}`, val);
          }
        }
      });
      
      // Insert the new header row
      next.set(`${insertionIndex}:section`, sectionName);
      next.set(`${insertionIndex}:Title / Item`, "a.");
      return next;
    });
    setRowCount(prev => prev + 1);
  };

  const handleDeleteSection = (sectionName: string) => {
    if (!window.confirm(`Are you sure you want to delete the entire section "${sectionName}" and all its rows?`)) return;
    saveStateToHistory();
    
    // 1. Identify rows to keep and calculate new indices
    const rowsToKeep: number[] = [];
    for (let r = 0; r < rowCount; r++) {
      if (gridData.get(`${r}:section`) !== sectionName) {
        rowsToKeep.push(r);
      }
    }

    const newRowCount = rowsToKeep.length;

    // 2. Rebuild the Sparse Map and Metadata with compacted indices
    setGridData(prev => {
      const next = new Map();
      rowsToKeep.forEach((oldR, newR) => {
        allHeaders.forEach(h => {
          const val = prev.get(`${oldR}:${h}`);
          if (val !== undefined) next.set(`${newR}:${h}`, val);
        });
        next.set(`${newR}:section`, prev.get(`${oldR}:section`));
      });
      return next;
    });

    const shiftMeta = (prev: Record<string, any>) => {
      const next: Record<string, any> = {};
      rowsToKeep.forEach((oldR, newR) => {
        Object.keys(prev).forEach(key => {
          if (key.startsWith(`${oldR}:`)) {
            const col = key.split(':').slice(1).join(':');
            next[`${newR}:${col}`] = prev[key];
          }
        });
      });
      return next;
    };

    const shiftHeights = (prev: Record<number, number>) => {
      const next: Record<number, number> = {};
      rowsToKeep.forEach((oldR, newR) => {
        if (prev[oldR]) next[newR] = prev[oldR];
      });
      return next;
    };

    setCellMetadata(shiftMeta);
    setCellAlignments(shiftMeta);
    setRowHeights(shiftHeights);
    setRowCount(newRowCount);
    if (newRowCount === 0) setSelectedId(null);
    setContextMenu(null);
  };

  const handleShare = () => {
    if (!selectedId) return;
    const url = `${window.location.origin}/?id=${selectedId}`;
    navigator.clipboard.writeText(url);
    alert("Shareable link copied to clipboard!");
  };

  const exportToCSV = () => {
      if (rowCount === 0) return;
      
      const headers = allHeaders;
      const csvContent = [
        headers.join(','),
        ...Array.from({ length: rowCount }).map((_, r) => 
          headers.map(h => `"${String(gridData.get(`${r}:${h}`) || '').replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${activeNode?.name || 'export'}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIndex: number, colIndex: number, headers: string[]) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      
      let nextRow = rowIndex;
      let nextColIdx = colIndex;

      if (e.key === 'Enter') {
        if (e.shiftKey) {
          nextRow = Math.max(0, rowIndex - 1);
        } else {
          nextRow = rowIndex + 1;
        }
      } else if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (colIndex > 0) {
            nextColIdx = colIndex - 1;
          } else if (rowIndex > 0) {
            nextRow = rowIndex - 1;
            nextColIdx = headers.length - 1;
          }
        } else {
          if (colIndex < headers.length - 1) {
            nextColIdx = colIndex + 1;
          } else {
            nextRow = rowIndex + 1;
            nextColIdx = 0;
          }
        }
      }

      if (nextRow >= 0 && nextRow < rowCount) {
        const nextHeader = headers[nextColIdx];
        setActiveCell({ row: nextRow, col: nextHeader });
        
        // Small timeout to allow conditional inputs (like Amount) to mount before focusing
        setTimeout(() => {
          const nextInput = document.querySelector(`[data-row="${nextRow}"][data-col="${nextHeader}"]`) as HTMLElement;
          if (nextInput) {
            nextInput.focus();
            if (nextInput instanceof HTMLInputElement) nextInput.select();
          }
        }, 10);
      }
    }
  }, [rowCount]);

  const setCellFontFamily = (row: number, col: string, fontFamily: string) => {
    setCellMetadata(prev => {
      const next = { ...prev };
      const visibleHeaders = allHeaders.filter(h => !hiddenColumns.includes(h) && h !== 'section');

      // Only apply to selection if the targeted cell is part of it
      const isPartofSelection = selection && 
        row >= Math.min(selection.startRow, selection.endRow) &&
        row <= Math.max(selection.startRow, selection.endRow) &&
        (() => {
          const startColIdx = visibleHeaders.indexOf(selection.startCol);
          const endColIdx = visibleHeaders.indexOf(selection.endCol);
          const currentColIdx = visibleHeaders.indexOf(col);
          return currentColIdx >= Math.min(startColIdx, endColIdx) && currentColIdx <= Math.max(startColIdx, endColIdx);
        })();

        if (isPartofSelection && selection) {
          const minRow = Math.min(selection.startRow, selection.endRow);
          const maxRow = Math.max(selection.startRow, selection.endRow);
          const startColIdx = visibleHeaders.indexOf(selection.startCol);
          const endColIdx = visibleHeaders.indexOf(selection.endCol);
          const minColIdx = Math.min(startColIdx, endColIdx);
          const maxColIdx = Math.max(startColIdx, endColIdx);

          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minColIdx; c <= maxColIdx; c++) {
              const key = r === -1 ? `header:${visibleHeaders[c]}` : `${r}:${visibleHeaders[c]}`;
              next[key] = { ...next[key], fontFamily };
            }
          }
        } else {
          const key = row === -1 ? `header:${col}` : `${row}:${col}`;
          next[key] = { ...next[key], fontFamily };
        }
      return next;
    });
    setContextMenu(null);
  };

  const toggleCellAlignment = useCallback((rowIndex: number, header: string) => {
    setCellAlignments(prev => {
      const next = { ...prev };
      // Determine next alignment based on the specific clicked cell
      const targetKey = `${rowIndex}:${header}`;
      const defaultAlign = (header === "Title / Item" || header === "Amount") ? "right" : "left";
      const currentAlign = prev[targetKey] || columnAlignments[header] || defaultAlign;
      
      const nextMap: Record<string, 'left' | 'center' | 'right'> = { left: 'center', center: 'right', right: 'left' };
      const nextAlign = nextMap[currentAlign];

      // Multi-cell logic: Only apply to entire selection if the clicked cell is inside the selection
      const isTargetInSelection = selection && 
        rowIndex >= Math.min(selection.startRow, selection.endRow) && 
        rowIndex <= Math.max(selection.startRow, selection.endRow) &&
        (() => {
          const startColIdx = visibleHeaders.indexOf(selection.startCol);
          const endColIdx = visibleHeaders.indexOf(selection.endCol);
          const currentColIdx = visibleHeaders.indexOf(header);
          return currentColIdx >= Math.min(startColIdx, endColIdx) && currentColIdx <= Math.max(startColIdx, endColIdx);
        })();

      if (isTargetInSelection && selection) {
          const minRow = Math.min(selection.startRow, selection.endRow);
          const maxRow = Math.max(selection.startRow, selection.endRow);
          const startColIdx = visibleHeaders.indexOf(selection.startCol);
          const endColIdx = visibleHeaders.indexOf(selection.endCol);
          const minColIdx = Math.min(startColIdx, endColIdx);
          const maxColIdx = Math.max(startColIdx, endColIdx);

          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minColIdx; c <= maxColIdx; c++) {
              // Support header key if selected
              const key = r === -1 ? `header:${visibleHeaders[c]}` : `${r}:${visibleHeaders[c]}`;
              next[key] = nextAlign;
            }
          }
        } else {
          next[targetKey] = nextAlign;
        }
      return next;
    });
  }, [columnAlignments, selection, visibleHeaders, setCellAlignments]);

  const toggleColumnVisibility = (key: string) => {
    setHiddenColumns(prev => 
      prev.includes(key) ? prev.filter(col => col !== key) : [...prev, key]
    );
  };

  const handleRenameColumn = (oldKey: string, newKey: string) => {
    const trimmedNewKey = newKey?.trim();
    if (!trimmedNewKey || oldKey === trimmedNewKey) return;

    saveStateToHistory();
    if (trimmedNewKey.toLowerCase() === 'section') {
      alert("'section' is a reserved column name used for categorization.");
      return;
    }

    if (allHeaders.includes(trimmedNewKey)) {
      alert(`A column named "${trimmedNewKey}" already exists.`);
      return;
    }

      setGridData(prev => {
        const next = new Map(prev);
        for (let r = 0; r < rowCount; r++) {
          const val = next.get(`${r}:${oldKey}`);
          if (val !== undefined) {
            next.set(`${r}:${trimmedNewKey}`, val);
            next.delete(`${r}:${oldKey}`);
          }
        }
        return next;
      });

      // Migrate alignments and metadata to the new column name
      setColumnAlignments(prev => {
        const next = { ...prev };
        if (next[oldKey]) {
          next[trimmedNewKey] = next[oldKey];
          delete next[oldKey];
        }
        return next;
      });
      setColumnWidths(prev => {
        const next = { ...prev };
        if (next[oldKey]) {
          next[trimmedNewKey] = next[oldKey];
          delete next[oldKey];
        }
        return next;
      });
      const migrateKeys = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        Object.keys(prev).forEach(key => {
          if (key.endsWith(`:${oldKey}`)) {
            const [r] = key.split(':');
            next[`${r}:${trimmedNewKey}`] = prev[key];
          } else { next[key] = prev[key]; }
        });
        return next;
      };
      setCellMetadata(migrateKeys);
      setCellAlignments(migrateKeys);

      setColumnOrder(prev => {
        const currentOrder = prev.length > 0 ? prev : allHeaders;
        return currentOrder.map(col => col === oldKey ? trimmedNewKey : col);
      });
  };

  const handleAddColumn = (name?: string) => {
    saveStateToHistory();
    const rawInput = typeof name === 'string' ? name : window.prompt("Enter new column name (leave blank for auto-name):");
    if (rawInput === null) return;
    
    let colName = rawInput.trim();

      if (!colName) {
        let i = 1;
        while (allHeaders.includes(`Column ${i}`)) i++;
        colName = `Column ${i}`;
      }

      if (colName.toLowerCase() === 'section') {
        alert("'section' is a reserved column name used for categorization.");
        return;
      }

      if (allHeaders.includes(colName)) {
        alert(`A column named "${colName}" already exists.`);
        return;
      }

      setColumnOrder(prev => {
        const currentOrder = prev.length > 0 ? prev : allHeaders;
        return [...currentOrder, colName];
      });
      // Map structure handles this automatically; we don't need to loop rows to "initialize" them
  };

  const handleDeleteColumn = (keyToDelete: string) => {
    if (!window.confirm(`Are you sure you want to delete the column "${keyToDelete}"?`)) return;
    saveStateToHistory();
    
    setGridData(prev => {
      const next = new Map(prev);
      for (let r = 0; r < rowCount; r++) {
        next.delete(`${r}:${keyToDelete}`);
      }
      return next;
    });

      // Cleanup metadata and alignments for the deleted column
      setColumnAlignments(prev => { const n = { ...prev }; delete n[keyToDelete]; return n; });
      setColumnWidths(prev => { const n = { ...prev }; delete n[keyToDelete]; return n; });
      const filterKeys = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        Object.keys(prev).forEach(key => {
          if (!key.endsWith(`:${keyToDelete}`)) next[key] = prev[key];
        });
        return next;
      };
      setCellMetadata(filterKeys);
      setCellAlignments(filterKeys);

      setColumnOrder(prev => prev.filter(col => col !== keyToDelete));
  };

  const handleInsertColumn = (relativeCol: string, position: 'before' | 'after') => {
    saveStateToHistory();
    const rawInput = window.prompt(`Enter new column name (leave blank for auto-name):`);
    if (rawInput === null) return;
    
    let colName = rawInput.trim();

    if (!colName) {
        let i = 1;
        while (allHeaders.includes(`Column ${i}`)) i++;
        colName = `Column ${i}`;
      }

      if (colName.toLowerCase() === 'section') {
        alert("'section' is a reserved column name used for categorization.");
        return;
      }

      if (allHeaders.includes(colName)) {
        alert("A column with this name already exists.");
        return;
      }

      const index = allHeaders.indexOf(relativeCol);
      const newOrder = [...allHeaders];
      if (index !== -1) {
        newOrder.splice(position === 'before' ? index : index + 1, 0, colName);
      } else {
        newOrder.push(colName);
      }

      setColumnOrder(newOrder);
  };

  const addTableRow = () => {
    saveStateToHistory();
    setRowCount(prev => prev + 1);
  };

  const addRowToSection = (sectionName: string) => {
    saveStateToHistory();
    const newIdx = rowCount;
    setGridData(prev => {
      const next = new Map(prev);
      next.set(`${newIdx}:section`, sectionName);
      next.set(`${newIdx}:Title / Item`, "a.");
      return next;
    });
    setRowCount(prev => prev + 1);
  };

  const handleInsertRow = (index: number, position: 'above' | 'after') => {
      saveStateToHistory();
      const section = gridData.get(`${index}:section`) || "Uncategorized";
      const insertIndex = position === 'above' ? index : index + 1;

      const shiftKeys = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        Object.keys(prev).forEach(key => {
          if (key.startsWith('header:')) {
            next[key] = prev[key];
            return;
          }
          const [rStr, ...cParts] = key.split(':');
          const r = parseInt(rStr);
          const col = cParts.join(':');
          if (isNaN(r)) { next[key] = prev[key]; return; }
          
          if (r < insertIndex) next[key] = prev[key];
          else next[`${r + 1}:${col}`] = prev[key];
        });
        return next;
      };
      setCellMetadata(shiftKeys);
      setCellAlignments(shiftKeys);
      setRowHeights(prev => {
        const next: Record<number, number> = {};
        Object.keys(prev).forEach(k => {
          const r = parseInt(k);
          if (r < insertIndex) next[r] = prev[r];
          else next[r + 1] = prev[r];
        });
        return next;
      });
      
      setGridData(prev => {
        const next = new Map();
        prev.forEach((val, key) => {
          const [rStr, col] = key.split(':');
          const r = parseInt(rStr);
          if (r < insertIndex) next.set(key, val);
          else next.set(`${r+1}:${col}`, val);
        });
        next.set(`${insertIndex}:section`, section);
        return next;
      });
      setRowCount(prev => prev + 1);
      setContextMenu(null);
  };

  const handleClearRow = (index: number) => {
    if (!window.confirm("Clear all data in this row?")) return;
    saveStateToHistory();
    
      setGridData(prev => {
        const next = new Map(prev);
        allHeaders.forEach(h => next.delete(`${index}:${h}`));
        next.set(`${index}:section`, prev.get(`${index}:section`));
        return next;
      });

      const clearRowMeta = (prev: Record<string, any>) => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (key.startsWith(`${index}:`)) delete next[key];
        });
        return next;
      };
      
      setCellMetadata(clearRowMeta);
      setCellAlignments(clearRowMeta);
      setContextMenu(null);
  };

  const handleClearColumn = (colName: string) => {
    if (!window.confirm(`Clear all data and formatting in column "${colName}"?`)) return;
    saveStateToHistory();

    setGridData(prev => {
      const next = new Map(prev);
      for (let r = 0; r < rowCount; r++) next.delete(`${r}:${colName}`);
      return next;
    });

      const clearColMeta = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        Object.keys(prev).forEach(key => {
          if (key.startsWith('header:')) {
            next[key] = prev[key];
            return;
          }
          const [rStr, ...cParts] = key.split(':');
          const col = cParts.join(':');
          if (col !== colName) {
            next[key] = prev[key];
          }
        });
        return next;
      };
      
      setCellMetadata(clearColMeta);
      setCellAlignments(clearColMeta);
      setContextMenu(null);
  };

  const handleResetWidths = () => {
    if (window.confirm('Reset all column widths? This will allow columns to auto-fit based on their content.')) {
      setColumnWidths({});
    }
  };

  const setCellType = (row: number, col: string, type: string, format: string = 'long') => {
    saveStateToHistory();
    setCellMetadata(prev => ({
      ...prev,
      ...(() => {
        const next: Record<string, any> = {};
        const visibleHeaders = allHeaders.filter(h => !hiddenColumns.includes(h) && h !== 'section');

          // Only apply to selection if the targeted cell is part of it
          const isPartofSelection = selection && 
            row >= Math.min(selection.startRow, selection.endRow) &&
            row <= Math.max(selection.startRow, selection.endRow) &&
            (() => {
              const startColIdx = visibleHeaders.indexOf(selection.startCol);
              const endColIdx = visibleHeaders.indexOf(selection.endCol);
              const currentColIdx = visibleHeaders.indexOf(col);
              return currentColIdx >= Math.min(startColIdx, endColIdx) && currentColIdx <= Math.max(startColIdx, endColIdx);
            })();

          if (isPartofSelection && selection) {
            const minRow = Math.min(selection.startRow, selection.endRow);
            const maxRow = Math.max(selection.startRow, selection.endRow);
            const startColIdx = visibleHeaders.indexOf(selection.startCol);
            const endColIdx = visibleHeaders.indexOf(selection.endCol);
            const minColIdx = Math.min(startColIdx, endColIdx);
            const maxColIdx = Math.max(startColIdx, endColIdx);

            for (let r = minRow; r <= maxRow; r++) {
              for (let c = minColIdx; c <= maxColIdx; c++) {
                const k = `${r}:${visibleHeaders[c]}`;
                next[k] = { ...prev[k], type, format };
              }
            }
          } else {
            next[`${row}:${col}`] = { ...prev[`${row}:${col}`], type, format };
          }
        return next;
      })()
    }));
    setContextMenu(null);
  };

  const insertMedia = (row: number, col: string, mediaType: 'image' | 'file') => {
    setPendingMedia({ row, col, type: mediaType });
    setContextMenu(null);
    // Use timeout to ensure state update doesn't interfere with the click event
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingMedia || !activeNode) return;

    const { row, col, type } = pendingMedia;
    const key = `${row}:${col}`;
    
    setIsSaving(true);
    try {
      const existing = cellMetadata[key] || {};
      const currentAttachments = existing.attachments || [];
      
      if (currentAttachments.length >= 10) {
        alert("Maximum limit of 10 attachments reached for this cell.");
        return;
      }

      // Generate a unique path in the storage bucket
      const filePath = `${activeNode.id}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      setCellMetadata(prev => ({
        ...prev,
        [key]: { 
          ...existing, 
          type: 'media', 
          attachments: [
            ...currentAttachments,
            { 
              type, 
              name: file.name, 
              url: publicUrl, 
              path: filePath, // Store the path for deletion cleanup
              size: file.size,
              contentType: file.type
            } 
          ]
        }
      }));
    } catch (err: any) {
      if (err.message?.includes('violates row-level security policy')) {
        alert('Upload failed: Security Policy Error. Please ensure Storage RLS policies are configured in Supabase.');
      } else {
        alert('Upload failed: ' + err.message);
      }
    } finally {
      setIsSaving(false);
      setPendingMedia(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeCellMetadata = async (row: number, col: string) => {
    if (!window.confirm("Are you sure you want to remove all attachments and formatting from this cell?")) return;

    const key = `${row}:${col}`;
    const meta = cellMetadata[key];

    // Cleanup all files in this cell from storage
    if (meta?.attachments) {
      const paths = meta.attachments.map((a: any) => a.path).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('attachments').remove(paths);
      }
    }

    setCellMetadata(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setContextMenu(null);
  };

  const deleteAttachment = async (row: number, col: string, index: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this attachment?")) return;

    const key = `${row}:${col}`;
    const existing = cellMetadata[key];
    if (!existing || !existing.attachments) return;

    const attachmentToDelete = existing.attachments[index];

    try {
      // Remove from Supabase storage if path exists
      if (attachmentToDelete.path) {
        await supabase.storage.from('attachments').remove([attachmentToDelete.path]);
      }

      setCellMetadata(prev => {
        const innerExisting = prev[key];
        const newAttachments = innerExisting.attachments.filter((_: any, i: number) => i !== index);

        if (newAttachments.length === 0) {
          const next = { ...prev };
          delete next[key];
          setViewingMedia(null); // Close modal if last item deleted
          return next;
        }

        const updated = {
          ...prev,
          [key]: { ...innerExisting, attachments: newAttachments }
        };
        setViewingMedia({ attachments: newAttachments, row, col });
        return updated;
      });
    } catch (err: any) {
      alert('Failed to delete file from storage: ' + err.message);
    }
  };

  const toggleComparisonId = (id: string) => {
    setComparisonIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const renderComparisonTable = () => {
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
        <div className="p-8 bg-white border border-slate-200 rounded-lg shadow-sm h-full flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Share2 className="text-blue-500" size={20} />
              Project Comparison Setup
            </h3>
            <p className="text-sm text-slate-500">Select at least two files from the list below to compare their project data side-by-side.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2">
            {allFiles.map(file => (
              <label 
                key={file.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:border-blue-300 ${
                  comparisonIds.includes(file.id) ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400' : 'bg-white border-slate-200'
                }`}
              >
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={comparisonIds.includes(file.id)}
                  onChange={() => toggleComparisonId(file.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-tighter">
                    {file.display_settings?.selectedYear || 'No Year Set'}
                  </p>
                </div>
                <FileText size={16} className={comparisonIds.includes(file.id) ? 'text-blue-500' : 'text-slate-300'} />
              </label>
            ))}
          </div>
          
          {comparisonIds.length === 1 && (
            <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-xs">
              <div className="p-1 bg-amber-200 rounded-full"><Plus size={12} /></div>
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
      <div className="flex flex-col h-full border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Side-by-Side Comparison</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setComparisonIds([])}
              className="px-2 py-1 bg-white border border-slate-300 text-slate-600 text-[10px] font-bold rounded hover:bg-red-50 hover:text-red-600 transition-colors mr-2"
            >
              Clear Selection
            </button>
            {nodesToCompare.map(n => (
              <span key={n!.id} className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded capitalize">{n!.name}</span>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
              <tr>
                <th className="p-3 text-[11px] font-bold border-r border-b text-slate-600 w-72 sticky left-0 bg-slate-100 z-20 shadow-[1px_0_0_0_#e2e8f0]">Title / Item</th>
                {nodesToCompare.map(n => (
                  <Fragment key={n!.id}>
                    <th className="p-3 text-[11px] font-bold border-r border-b text-blue-600 text-right">Amount ({n!.name})</th>
                    <th className="p-3 text-[11px] font-bold border-r border-b text-slate-400">Status/Loc</th>
                  </Fragment>
                ))}
                <th className="p-3 text-[11px] font-bold border-b bg-green-50 text-green-700 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {sortedSections.map(sectionName => {
                const projectsInSection = Array.from(sectionMap.get(sectionName)!).sort();
                
                return (
                  <Fragment key={sectionName}>
                    <tr className="bg-slate-100/80">
                      <td colSpan={2 + nodesToCompare.length * 2} className="px-3 py-1 border-b border-slate-200 font-black text-slate-800 tracking-widest text-[11px] uppercase sticky left-0 z-10 bg-slate-100 shadow-[1px_0_0_0_#e2e8f0]">
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
                        <tr key={`${sectionName}-${title}`} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                          <td className="p-3 text-sm font-medium text-slate-800 border-r bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">{title}</td>
                          {values.map((v, idx) => (
                            <Fragment key={idx}>
                              <td className="p-3 text-sm font-mono text-right border-r">
                          {v ? Number(v.Amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="p-3 text-[10px] text-slate-500 italic border-r truncate max-w-[120px]">
                                {v?.Location || v?.Allocation || ""}
                              </td>
                            </Fragment>
                          ))}
                          <td className={`p-3 text-sm font-bold text-right ${variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-slate-400'}`}>
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

  const handleMergeCells = useCallback((visibleHeaders: string[], isHeaderMerge: boolean = false) => {
    if (!selection) return;
    const { startRow, endRow, startCol, endCol } = selection;
    
    const isHeaderSelection = startRow === -1 || isHeaderMerge;

    const startColIdx = visibleHeaders.indexOf(startCol);
    const endColIdx = visibleHeaders.indexOf(endCol);
    if (startColIdx === -1 || endColIdx === -1) return;

    const minColIdx = Math.min(startColIdx, endColIdx);
    const maxColIdx = Math.max(startColIdx, endColIdx);
    const minRow = isHeaderSelection ? -1 : Math.min(startRow, endRow);
    const maxRow = isHeaderSelection ? -1 : Math.max(startRow, endRow);

    const rowSpan = isHeaderSelection ? 1 : maxRow - minRow + 1;
    const colSpan = maxColIdx - minColIdx + 1;

    if (rowSpan === 1 && colSpan === 1) return;

    if (!window.confirm(`Merge ${isHeaderSelection ? colSpan : rowSpan * colSpan} ${isHeaderSelection ? 'headers' : 'cells'}?`)) return;

    const hostCol = visibleHeaders[minColIdx];
    const hostKey = isHeaderSelection ? `header:${hostCol}` : `${minRow}:${hostCol}`;
    const newMetadata = { ...cellMetadata };

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minColIdx; c <= maxColIdx; c++) {
        const key = isHeaderSelection ? `header:${visibleHeaders[c]}` : `${r}:${visibleHeaders[c]}`;
        const m = { ...newMetadata[key] };
        delete m.rowSpan; delete m.colSpan; delete m.mergedIn;
        newMetadata[key] = m;
      }
    }

    newMetadata[hostKey] = { 
      ...newMetadata[hostKey], 
      colSpan,
      ...(isHeaderSelection ? {} : { rowSpan })
    };
    
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minColIdx; c <= maxColIdx; c++) {
        const currentKey = isHeaderSelection ? `header:${visibleHeaders[c]}` : `${r}:${visibleHeaders[c]}`;
        if (currentKey !== hostKey) {
          newMetadata[currentKey] = { ...newMetadata[currentKey], mergedIn: hostKey };
        }
      }
    }
    setCellMetadata(newMetadata);
    setSelection(null);
  }, [selection, cellMetadata]);

  const handleUnmergeCells = useCallback((row: number, col: string, visibleHeaders: string[]) => {
    const isHeader = row === -1;
    const key = isHeader ? `header:${col}` : `${row}:${col}`;
    const meta = cellMetadata[key];
    if (!meta || (!meta.rowSpan && !meta.colSpan)) return;

    const newMetadata = { ...cellMetadata };
    const { rowSpan = 1, colSpan = 1 } = meta;
    const colIdx = visibleHeaders.indexOf(col);
    
    const startR = isHeader ? -1 : row;
    const endR = isHeader ? -1 : row + rowSpan - 1;

    for (let r = startR; r <= endR; r++) {
      for (let c = colIdx; c < colIdx + colSpan; c++) {
        const currentKey = isHeader ? `header:${visibleHeaders[c]}` : `${r}:${visibleHeaders[c]}`;
        const m = { ...newMetadata[currentKey] };
        delete m.rowSpan; delete m.colSpan; delete m.mergedIn;
        if (Object.keys(m).length === 0) delete newMetadata[currentKey];
        else newMetadata[currentKey] = m;
      }
    }
    setCellMetadata(newMetadata);
  }, [cellMetadata]);

  const handleDragFillStart = (e: React.MouseEvent, row: number, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragFillRange({ startRow: row, endRow: row, col });

    const handleMouseUp = () => {
      window.removeEventListener('mouseup', handleMouseUp);
      setDragFillRange(currentRange => {
        if (currentRange) {
          applyDragFill(currentRange);
        }
        return null;
      });
    };
    window.addEventListener('mouseup', handleMouseUp);
  };

  const applyDragFill = (range: { startRow: number; endRow: number; col: string }) => {
    const { startRow, endRow, col } = range;
    saveStateToHistory();
    if (startRow === endRow) return;

    const sourceValue = gridData.get(`${startRow}:${col}`);
      const sourceMeta = cellMetadata[`${startRow}:${col}`];
      
      const newMetadata = { ...cellMetadata };
      const nextMap = new Map(gridData);

      const min = Math.min(startRow, endRow);
      const max = Math.max(startRow, endRow);

      for (let i = min; i <= max; i++) {
        if (i === startRow) continue;
        
        if (sourceValue !== undefined) nextMap.set(`${i}:${col}`, sourceValue);
        const targetKey = `${i}:${col}`;
        if (sourceMeta) {
          newMetadata[targetKey] = { ...sourceMeta };
        } else {
          delete newMetadata[targetKey];
        }
      }

      setGridData(nextMap);
      setCellMetadata(newMetadata);
  };

  const removeTableRow = async (index: number) => {
    if (!window.confirm("Are you sure you want to delete this row? Any associated attachments will be permanently removed.")) return;
    saveStateToHistory();

    // Identify all attachments in this row to cleanup storage
    const rowPrefix = `${index}:`;
    const pathsToDelete: string[] = [];
    Object.keys(cellMetadata).forEach(key => {
      if (key.startsWith(rowPrefix)) {
        const meta = cellMetadata[key];
        if (meta?.attachments) {
          meta.attachments.forEach((a: any) => { if (a.path) pathsToDelete.push(a.path); });
        }
      }
    });

    if (pathsToDelete.length > 0) {
      try {
        await supabase.storage.from('attachments').remove(pathsToDelete);
      } catch (err) { console.error("Storage cleanup failed:", err); }
    }

    try {
      setGridData(prev => {
        const next = new Map();
        prev.forEach((val, key) => {
          const [rStr, col] = key.split(':');
          const r = parseInt(rStr);
          if (r < index) next.set(key, val);
          else if (r > index) next.set(`${r - 1}:${col}`, val);
        });
        return next;
      });
      setRowCount(prev => prev - 1);

      // Shift metadata and alignments for all rows following the deleted one
      const shiftKeys = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        Object.keys(prev).forEach(key => {
          if (key.startsWith('header:')) {
            next[key] = prev[key];
            return;
          }
          const [rStr, ...cParts] = key.split(':');
          const r = parseInt(rStr);
          const col = cParts.join(':');
          if (isNaN(r)) { next[key] = prev[key]; return; }

          if (r < index) next[key] = prev[key];
          else if (r > index) next[`${r - 1}:${col}`] = prev[key];
        });
        return next;
      };
      setCellMetadata(shiftKeys);
      setCellAlignments(shiftKeys);
      setRowHeights(prev => {
        const next: Record<number, number> = {};
        Object.keys(prev).forEach(k => {
          const r = parseInt(k);
          if (r < index) next[r] = prev[r];
          else if (r > index) next[r - 1] = prev[r];
        });
        return next;
      });
    } catch (e) {
      console.error("Failed to remove row");
    }
  };

  useEffect(() => {
    if (activeNode?.type === 'file') {
      const content = Array.isArray(activeNode.content) ? activeNode.content : [];
      setGridData(arrayToSparseMap(content));
      setRowCount(content.length);
      setColumnAlignments(activeNode.display_settings?.columnAlignments || {});
      setCellAlignments(activeNode.display_settings?.cellAlignments || {});
      setColumnOrder(activeNode.display_settings?.columnOrder || []);
      setHiddenColumns(activeNode.display_settings?.hiddenColumns || []);
      setColumnWidths(activeNode.display_settings?.columnWidths || {});
      setCellMetadata(activeNode.display_settings?.cellMetadata || {});
      setRowHeights((activeNode.display_settings as any)?.rowHeights || {});
      setSelectedYear(activeNode.display_settings?.selectedYear || '2020');
      setActiveCell(null);
      setRowFilter('');
      setShowBackToTop(false);
      setScrollTop(0); // Synchronize virtualization state on file change
      tableContainerRef.current?.scrollTo({ top: 0 });
    } else {
      setGridData(new Map());
      setRowCount(0);
      setColumnAlignments({});
      setCellAlignments({});
      setColumnOrder([]);
      setHiddenColumns([]);
      setCellMetadata({});
      setRowHeights({});
      setActiveCell(null);
      setSelectedYear('2020');
      setRowFilter('');
      setShowBackToTop(false);
    }
  }, [activeNode?.id, activeNode?.type, activeNode?.content, activeNode?.display_settings]);

  const handleSave = async () => {
    if (!activeNode || activeNode.type !== 'file') return;
    
    setIsSaving(true);
    try {
      const contentArray = sparseMapToArray(gridData, rowCount, allHeaders);
      const display_settings = { columnAlignments, cellAlignments, hiddenColumns, selectedYear, columnOrder, columnWidths, cellMetadata, rowHeights };
      const { error } = await supabase.from('nodes').update({ content: contentArray, display_settings }).eq('id', activeNode.id);
      if (error) throw error;
      await fetchFiles();
    } finally {
      setIsSaving(false);
    }
  };

  const initializeExcelTemplate = () => {
    const next = new Map();
    next.set("0:Title / Item", "a."); next.set("0:Amount", 0); next.set("0:section", "Work A");
    next.set("1:Title / Item", "b."); next.set("1:Amount", 0); next.set("1:section", "Work A");
    next.set("2:Title / Item", "c."); next.set("2:Amount", 0); next.set("2:section", "Work A");
    next.set("3:Title / Item", "a."); next.set("3:Amount", 0); next.set("3:section", "Work B");
    setColumnOrder(["Title / Item", "Amount", "Location", "Allocation", "Notes"]);
    setGridData(next);
    setRowCount(4);
  };

  const renderTableEditor = () => {
    try {
      if (rowCount === 0) {
        return (
          <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 shadow-sm flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="font-semibold mb-1 text-sm">Pre-formatted Table Required</p>
              <p className="text-xs text-amber-700">Initialize the Work A / Work B structure for this file.</p>
            </div>
            <button 
              onClick={initializeExcelTemplate}
              className="px-4 py-2 bg-accent hover:opacity-90 text-accent-foreground text-xs font-bold rounded transition-colors uppercase tracking-wider shadow-sm"
            >
              Initialize Excel Template
            </button>
          </div>
        );
      }

      // Pre-calculate selection bounds for efficient highlighting
      const selStartColIdx = visibleHeaders.indexOf(selection?.startCol || "");
      const selEndColIdx = visibleHeaders.indexOf(selection?.endCol || "");
      const selMinColIdx = Math.min(selStartColIdx, selEndColIdx);
      const selMaxColIdx = Math.max(selStartColIdx, selEndColIdx);
      const selMinRow = selection ? Math.min(selection.startRow, selection.endRow) : -2;
      const selMaxRow = selection ? Math.max(selection.startRow, selection.endRow) : -2;

      // Binary search for the first visible item based on accumulated offsets
      // This handles variable row heights (resized rows) correctly.
      let startIdx = 0;
      let low = 0;
      let high = itemOffsets.length - 1;
      const adjustedScrollTop = scrollTop / zoom; // Adjust for zoom factor
      
      while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (itemOffsets[mid] <= adjustedScrollTop) {
          startIdx = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const startIndex = Math.max(0, startIdx - 5);
      const endIndex = Math.min(flatItems.length, startIndex + Math.ceil(containerHeight / (DEFAULT_ROW_HEIGHT * zoom)) + 15);
      
      const visibleItems = flatItems.slice(startIndex, endIndex);
      const translateY = itemOffsets[startIndex] || 0;

      return (
        <div className={`${GRID_THEME.editor} ${isFullScreen ? '' : 'border border-border rounded-lg shadow-sm'}`}>
          {/* Excel Toolbar */}
          <div className={GRID_THEME.toolbar}>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input type="text" placeholder="Search records..." value={rowFilter} onChange={(e) => setRowFilter(e.target.value)} className="w-full pl-9 pr-4 py-1.5 text-xs border border-border rounded focus:ring-1 focus:ring-accent outline-none bg-background text-foreground placeholder:text-muted/50" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded text-xs font-medium">
                <Type size={14} className="text-muted" />
                <select 
                  value={activeCell ? (cellMetadata[`${activeCell.row}:${activeCell.col}`]?.fontFamily || "") : ""} 
                  onChange={(e) => activeCell && setCellFontFamily(activeCell.row, activeCell.col, e.target.value)} 
                  className="bg-transparent border-0 font-bold text-accent focus:ring-0 cursor-pointer max-w-[120px] dark:bg-card"
                >
                  <option value="">Font Family...</option>
                  {FONT_FAMILIES.map(f => (
                    <option key={f.id} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded text-xs font-medium">
                <span className="text-muted">Year:</span>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent border-0 font-bold text-accent focus:ring-0 cursor-pointer dark:bg-card">
                  <option value="2020">2020</option>
                  <option value="2021">2021</option>
                  <option value="2022">2022</option>
                  <option value="2023">2023</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded text-xs font-medium">
                <span className="text-muted">Columns:</span>
                <select 
                  value="" 
                  onChange={(e) => { if(e.target.value) toggleColumnVisibility(e.target.value); e.target.value = ""; }}
                  className="bg-transparent border-0 font-bold text-accent focus:ring-0 cursor-pointer max-w-[110px] dark:bg-card"
                >
                  <option value="">{hiddenColumns.length > 0 ? `(${hiddenColumns.length} Hidden)` : "All Visible"}</option>
                  {allHeaders.filter(h => h !== 'section').map(h => (
                    <option key={h} value={h}>{hiddenColumns.includes(h) ? "Show" : "Hide"} {h}</option>
                  ))}
                </select>
              </div>
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 px-1 py-1.5 bg-card border border-border rounded text-xs font-medium shrink-0">
                <button 
                  disabled={undoStack.length === 0}
                  onClick={undo} 
                  className="p-1 hover:bg-muted/20 rounded text-muted hover:text-accent transition-colors disabled:opacity-30" 
                  title="Undo (Ctrl+Z)"
                >
                  <History size={14} className="rotate-180 flip-y" />
                </button>
                <button 
                  disabled={redoStack.length === 0}
                  onClick={redo} 
                  className="p-1 hover:bg-muted/20 rounded text-muted hover:text-accent transition-colors disabled:opacity-30" 
                  title="Redo (Ctrl+Y)"
                >
                  <History size={14} />
                </button>
              </div>
              <div className="flex items-center gap-1 px-2 py-1.5 bg-card border border-border rounded text-xs font-medium shrink-0">
                <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-1 hover:bg-muted/20 rounded text-muted hover:text-accent transition-colors" title="Zoom Out">
                  <ZoomOut size={14} />
                </button>
                <button onClick={() => setZoom(1)} className="w-10 text-center font-bold text-accent select-none hover:bg-muted/10 rounded transition-colors" title="Reset Zoom">
                  {Math.round(zoom * 100)}%
                </button>
                <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-1 hover:bg-muted/20 rounded text-muted hover:text-accent transition-colors" title="Zoom In">
                  <ZoomIn size={14} />
                </button>
              </div>
              <button onClick={handleAddSection} className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded text-xs font-medium hover:bg-muted/10 transition-colors shadow-sm text-foreground">
                <Plus size={14} className="text-green-600" /> Add Section
              </button>
              <button onClick={handleResetWidths} className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded text-xs font-medium hover:bg-muted/10 transition-colors shadow-sm text-foreground" title="Reset all columns to auto-width">
                <RefreshCcw size={14} /> Reset Widths
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <button onClick={exportToCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded text-xs font-medium hover:bg-muted/10 transition-colors shadow-sm text-foreground">
                <HardDrive size={14} /> Export CSV
              </button>
            </div>
          </div>
          
          {/* Cell Context Menu */}
          {contextMenu && (
            <div 
              className="fixed z-[100] bg-card border border-border shadow-xl rounded-lg py-1 w-48 animate-in fade-in zoom-in duration-100 context-menu-container"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.type === 'header' ? (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-black text-muted/50 tracking-widest uppercase border-b border-border/50 mb-1">Column Options</div>
                  <button 
                    onClick={() => { setIsFreezePanes(!isFreezePanes); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    {isFreezePanes ? <Minimize2 size={14} className="text-accent" /> : <Maximize2 size={14} className="text-muted" />}
                    {isFreezePanes ? 'Unfreeze Panes' : 'Freeze Panes'}
                  </button>
                  <div className="h-px bg-border my-1"></div>
                  <div className="relative group/sub">
                    <button 
                      onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showFonts: true, showFormats: false } : null)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center justify-between gap-2 text-foreground"
                    >
                      <span className="flex items-center gap-2"><Type size={14} className="text-accent" /> Set Column Font</span>
                      <ChevronRightIcon size={12} className="text-muted" />
                    </button>
                    {contextMenu.showFonts && (
                      <div className={`absolute ${contextMenu.x + 384 > window.innerWidth ? 'right-full mr-px' : 'left-full ml-px'} top-0 bg-card border border-border shadow-xl rounded-lg py-1 w-48`}>
                        {FONT_FAMILIES.map(f => (
                          <button key={f.id} onClick={() => setCellFontFamily(-1, contextMenu.col, f.value)} className="w-full text-left px-3 py-2 text-xs hover:bg-accent/10 hover:text-accent text-foreground">{f.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="h-px bg-border my-1"></div>
                  <div className="px-3 py-1.5 text-[10px] font-black text-muted/50 tracking-widest uppercase">Alignment</div>
                  <button onClick={() => setColumnAlignment(contextMenu.col, 'left')} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground">
                    <AlignLeft size={14} className={columnAlignments[contextMenu.col] === 'left' ? "text-accent" : "text-muted"} /> Left Alignment
                  </button>
                  <button onClick={() => setColumnAlignment(contextMenu.col, 'center')} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground">
                    <AlignCenter size={14} className={columnAlignments[contextMenu.col] === 'center' ? "text-accent" : "text-muted"} /> Center Alignment
                  </button>
                  <button onClick={() => setColumnAlignment(contextMenu.col, 'right')} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground">
                    <AlignRight size={14} className={columnAlignments[contextMenu.col] === 'right' ? "text-accent" : "text-muted"} /> Right Alignment
                  </button>
                  <div className="h-px bg-border my-1"></div>
                  <button 
                    onClick={() => { handleMergeCells(visibleHeaders, true); setContextMenu(null); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <TableIcon size={14} className="text-accent" /> Merge Selected Headers
                  </button>
                  {cellMetadata[`header:${contextMenu.col}`]?.colSpan > 1 && (
                    <button 
                      onClick={() => { handleUnmergeCells(-1, contextMenu.col, visibleHeaders); setContextMenu(null); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                    >
                      <X size={14} className="text-orange-500" /> Unmerge Header
                    </button>
                  )}
                  <button 
                    onClick={() => { toggleColumnVisibility(contextMenu.col); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <EyeOff size={14} /> Hide Column
                  </button>
                  <button 
                    onClick={() => { handleInsertColumn(contextMenu.col, 'before'); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <Plus size={14} className="text-accent" /> Insert Column Before
                  </button>
                  <button 
                    onClick={() => { handleInsertColumn(contextMenu.col, 'after'); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <Plus size={14} className="text-accent" /> Insert Column After
                  </button>
                  <button 
                    onClick={() => handleClearColumn(contextMenu.col)} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <X size={14} className="text-orange-500" /> Clear Column Content
                  </button>
                  <div className="h-px bg-border my-1"></div>
                  <button 
                    onClick={() => { handleDeleteColumn(contextMenu.col); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-red-500/10 text-red-500 flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Delete Column
                  </button>
                </>
              ) : contextMenu.type === 'row' ? (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-black text-muted/50 tracking-widest uppercase border-b border-border/50 mb-1">Row Options</div>
                  <button 
                    onClick={() => handleInsertRow(contextMenu.row!, 'above')} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <Plus size={14} className="text-accent" /> Insert Row Above
                  </button>
                  <button 
                    onClick={() => handleInsertRow(contextMenu.row!, 'after')} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <Plus size={14} className="text-accent" /> Insert Row Below
                  </button>
                  <button 
                    onClick={() => handleClearRow(contextMenu.row!)} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <X size={14} className="text-orange-500" /> Clear Row Content
                  </button>
                  <div className="h-px bg-border my-1"></div>
                  <div className="px-3 py-1.5 text-[10px] font-black text-muted/50 tracking-widest uppercase">Section Actions</div>
                  <button 
                    onClick={() => {
                      const section = gridData.get(`${contextMenu.row}:section`) || "Uncategorized";
                      handleInsertSection(section, 'before', contextMenu.row);
                      setContextMenu(null);
                    }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <FolderPlus size={14} className="text-accent" /> Insert Section Above
                  </button>
                  <button 
                    onClick={() => {
                      const section = gridData.get(`${contextMenu.row}:section`) || "Uncategorized";
                      handleInsertSection(section, 'after', contextMenu.row);
                      setContextMenu(null);
                    }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <FolderPlus size={14} className="text-accent" /> Insert Section Below
                  </button>
                  <button 
                    onClick={() => {
                      const section = gridData.get(`${contextMenu.row}:section`) || "Uncategorized";
                      addRowToSection(section);
                      setContextMenu(null);
                    }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <Plus size={14} className="text-accent" /> Add Row to this Section
                  </button>
                  <div className="h-px bg-border my-1"></div>
                  <button 
                    onClick={() => { removeTableRow(contextMenu.row!); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-red-500/10 text-red-500 flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Delete Row
                  </button>
                </>
              ) : (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-black text-muted/50 tracking-widest uppercase border-b border-border/50 mb-1">Selection Actions</div>
                  <button 
                    onClick={() => { handleMergeCells(visibleHeaders); setContextMenu(null); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <TableIcon size={14} className="text-accent" /> Merge Selected Cells
                  </button>
                  
                  {/* Unmerge only shows if the specific cell clicked is a merge host */}
                  {(cellMetadata[`${contextMenu.row}:${contextMenu.col}`]?.rowSpan > 1 || cellMetadata[`${contextMenu.row}:${contextMenu.col}`]?.colSpan > 1) && (
                    <button 
                      onClick={() => { handleUnmergeCells(contextMenu.row!, contextMenu.col, visibleHeaders); setContextMenu(null); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                    >
                      <X size={14} className="text-orange-500" /> Unmerge Cells
                    </button>
                  )}

                  <div className="h-px bg-border my-1"></div>

                  {cellMetadata[`${contextMenu.row!}:${contextMenu.col}`]?.type === 'media' && (
                    <>
                      <button onClick={() => removeCellMetadata(contextMenu.row!, contextMenu.col)} className="w-full text-left px-3 py-2 text-xs hover:bg-red-500/10 text-red-500 flex items-center gap-2 font-bold"><Trash2 size={14} /> Remove Attachment</button>
                      <div className="h-px bg-border my-1"></div>
                    </>
                  )}

                  <div className="px-3 py-1.5 text-[10px] font-black text-muted/50 tracking-widest uppercase">Format Cell</div>
                  <button 
                    onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showFormats: false, showFormulaFormats: false, showNumberFormats: false } : null)}
                    onClick={() => setCellType(contextMenu.row!, contextMenu.col, 'text')} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"><FileText size={14} className="text-muted" /> Default Text</button>
                  
                  <div className="relative group/sub">
                    <button 
                      onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showFormats: true, showFormulaFormats: false, showNumberFormats: false } : null)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center justify-between gap-2 text-foreground"
                    >
                      <span className="flex items-center gap-2"><Calendar size={14} className="text-accent" /> Format as Calendar</span>
                      <ChevronRightIcon size={12} className="text-muted" />
                    </button>
                    
                    {contextMenu.showFormats && (
                      <div className={`absolute ${contextMenu.x + 384 > window.innerWidth ? 'right-full mr-px' : 'left-full ml-px'} top-0 bg-card border border-border shadow-xl rounded-lg py-1 w-48`}>
                        {DATE_FORMATS.map(f => (
                          <button key={f.id} onClick={() => setCellType(contextMenu.row!, contextMenu.col, 'date', f.id)} className="w-full text-left px-3 py-2 text-xs hover:bg-accent/10 hover:text-accent text-foreground">{f.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative group/sub">
                    <button 
                      onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showNumberFormats: true, showFormats: false, showFormulaFormats: false } : null)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center justify-between gap-2 text-foreground"
                    >
                      <span className="flex items-center gap-2"><TableIcon size={14} className="text-green-600" /> Format as Number</span>
                      <ChevronRightIcon size={12} className="text-muted" />
                    </button>
                    
                    {contextMenu.showNumberFormats && (
                      <div className={`absolute ${contextMenu.x + 384 > window.innerWidth ? 'right-full mr-px' : 'left-full ml-px'} top-0 bg-card border border-border shadow-xl rounded-lg py-1 w-48`}>
                        {NUMBER_FORMATS.map(f => (
                          <button key={f.id} onClick={() => setCellType(contextMenu.row!, contextMenu.col, 'number', f.id)} className="w-full text-left px-3 py-2 text-xs hover:bg-accent/10 hover:text-accent text-foreground">{f.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative group/sub">
                    <button 
                      onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showFormulaFormats: true, showFormats: false, showNumberFormats: false } : null)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center justify-between gap-2 text-foreground"
                    >
                      <span className="flex items-center gap-2"><Sigma size={14} className="text-purple-500" /> Formula Support</span>
                      <ChevronRightIcon size={12} className="text-muted" />
                    </button>
                    
                    {contextMenu.showFormulaFormats && (
                      <div className={`absolute ${contextMenu.x + 384 > window.innerWidth ? 'right-full mr-px' : 'left-full ml-px'} top-0 bg-card border border-border shadow-xl rounded-lg py-1 w-48`}>
                        <button 
                          onClick={() => setCellType(contextMenu.row!, contextMenu.col, 'formula')} 
                          className="w-full text-left px-3 py-2 text-xs hover:bg-accent/10 hover:text-accent text-foreground font-bold"
                        >
                          Standard (Sum/Number)
                        </button>
                        <div className="h-px bg-border my-1"></div>
                        <div className="px-3 py-1 text-[9px] font-black text-muted/50 tracking-widest uppercase">Date Result Format</div>
                        {DATE_FORMATS.map(f => (
                          <button key={f.id} onClick={() => setCellType(contextMenu.row!, contextMenu.col, 'formula', f.id)} className="w-full text-left px-3 py-2 text-xs hover:bg-accent/10 hover:text-accent text-foreground">{f.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="h-px bg-border my-1"></div>
                  <div className="px-3 py-1.5 text-[10px] font-black text-muted/50 tracking-widest uppercase">Media</div>
                  <button onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showFormats: false, showFormulaFormats: false, showNumberFormats: false } : null)} onClick={() => insertMedia(contextMenu.row!, contextMenu.col, 'image')} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"><ImageIcon size={14} className="text-green-500" /> Insert Image</button>
                  <button onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showFormats: false, showFormulaFormats: false, showNumberFormats: false } : null)} onClick={() => insertMedia(contextMenu.row!, contextMenu.col, 'file')} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"><Paperclip size={14} className="text-amber-500" /> Attach File</button>
                </>
              )}
            </div>
          )}

          {/* Hidden File Input for Media Uploads */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            accept={pendingMedia?.type === 'image' ? "image/*" : "*/*"}
          />

          {/* Formula Bar - Relocated for a cleaner grid view */}
          <div className={GRID_THEME.formulaBar}>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/10 rounded border border-border text-[10px] font-black text-muted tracking-tighter min-w-[120px] justify-center shadow-sm mt-0.5">
              {activeCell ? `${activeCell.col} : Row ${activeCell.row + 1}` : 'Select a cell'}
            </div>
            <div className="h-4 w-px bg-border mx-1 self-center"></div>
            <div className="flex items-center gap-1.5 px-2 text-purple-500 mt-1">
              <Sigma size={14} className="shrink-0" />
              <span className="text-[10px] font-bold tracking-widest opacity-50">Formula</span>
            </div>
            <textarea
              ref={formulaBarRef}
              rows={1}
              placeholder="Enter formula (e.g., =SUM(A,B)) or value..."
              value={activeCell ? (data[activeCell.row][activeCell.col] || '') : ''}
              onChange={(e) => {
                if (activeCell) {
                  handleUpdateCell(activeCell.row, activeCell.col, e.target.value);
                }
              }}
              className="flex-1 bg-transparent border-0 outline-none text-sm font-mono text-foreground placeholder:text-muted/30 placeholder:italic resize-none py-1 overflow-y-auto max-h-32"
            />
          </div>

          <div
            ref={tableContainerRef}
            onScroll={(e) => {
              setShowBackToTop(e.currentTarget.scrollTop > 300);
              setScrollTop(e.currentTarget.scrollTop);
            }}
            className="flex-1 overflow-auto relative"
          >
            {/* Virtual Scroll Spacer to force correct scrollbar height */}
            <div style={{ height: totalVirtualHeight * zoom, width: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
            
            <table 
              className="w-full border-separate border-spacing-0 table-auto min-w-full origin-top-left relative"
              style={{ 
                zoom: zoom, 
                transform: `translateY(${translateY}px)`,
              } as any}
            >
              <thead className={`${isFreezePanes ? 'sticky top-0 z-30' : ''} ${GRID_THEME.tableHeader}`}>
                <tr className={GRID_THEME.tableHeaderRow}>
                  {/* The Corner Cell - Standardized border and background */}
                  <th 
                    onClick={() => {
                      if (data.length > 0 && visibleHeaders.length > 0) {
                        setSelection({
                          startRow: -1, // Include headers in selection
                          endRow: data.length - 1,
                          startCol: visibleHeaders[0],
                          endCol: visibleHeaders[visibleHeaders.length - 1]
                        });
                        setActiveCell({ row: 0, col: visibleHeaders[0] });
                      }
                    }}
                    className={`w-10 min-w-[40px] h-5 shadow-[inset_-1px_-1px_0_rgba(0,0,0,0.05)] cursor-pointer hover:bg-muted/30 ${GRID_THEME.tableIndexCell} ${isFreezePanes ? 'sticky left-0 top-0 z-50 shadow-[1px_0_0_0_var(--color-border)]' : ''}`}
                  >
                    <div className="w-full h-full flex items-center justify-center opacity-20 text-[8px] font-black text-muted">◢</div>
                  </th>
                  {visibleHeaders.map((header, idx) => {
                    const headerMeta = cellMetadata[`header:${header}`] || {};
                    const isColumnActive = activeCell?.col === header;
                    const isInHeaderLabelSelection = selection && 
                      (selection.startRow === 0 || selection.startRow === -1) && 
                      selection.endRow === rowCount - 1 &&
                      idx >= selMinColIdx && idx <= selMaxColIdx;

                    return (
                      <th 
                        key={`col-label-${idx}`} 
                        onMouseDown={(e) => {
                          if (e.button === 0 && rowCount > 0) {
                            setSelection({ startRow: 0, endRow: rowCount - 1, startCol: header, endCol: header });
                            setActiveCell({ row: 0, col: header });
                            setIsSelecting(true);
                          }
                        }}
                        onMouseEnter={() => {
                          if (isSelecting && selection && (selection.startRow === 0 || selection.startRow === -1)) {
                            setSelection(prev => prev ? { ...prev, endCol: header } : null);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          // Excel behavior: Right-click selects the whole column ONLY if not already in selection
                          const isFullColumnSelected = selection && selection.startRow === 0 && selection.endRow === data.length - 1 && idx >= selMinColIdx && idx <= selMaxColIdx;
                          
                          if (!isFullColumnSelected && rowCount > 0) {
                            setSelection({
                              startRow: 0,
                              endRow: data.length - 1,
                              startCol: header,
                              endCol: header
                            });
                            setActiveCell({ row: 0, col: header });
                          }
                          handleOpenContextMenu(e, 'header', undefined, header);
                        }}
                        style={{ 
                          fontFamily: headerMeta.fontFamily || 'inherit',
                          width: columnWidths[header] ? `${columnWidths[header]}px` : undefined,
                          minWidth: columnWidths[header] ? `${columnWidths[header]}px` : '120px' 
                        }}
                        className={`relative group/col-index text-[9px] font-black border-r border-b border-border h-5 text-center uppercase tracking-tighter cursor-pointer transition-colors ${
                          isColumnActive || isInHeaderLabelSelection ? 'bg-accent/20 text-accent shadow-[inset_0_-2px_0_0_currentColor]' : 'text-muted hover:bg-muted/30 hover:text-foreground'
                        } ${isInHeaderLabelSelection ? 'bg-accent/30' : ''} ${
                          isFreezePanes && header === "Title / Item" ? `sticky left-10 top-0 z-50 shadow-[1px_0_0_0_var(--color-border)] ${isColumnActive ? 'bg-accent/20' : 'bg-muted/10'}` : ""
                        }`}
                      >
                        {getExcelColumnLabel(idx)}
                        <div 
                          onMouseDown={(e) => startResizing(header, e)}
                          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-accent z-50 transition-colors group-hover/col-index:bg-muted/40"
                          title="Drag to resize"
                        />
                      </th>
                    );
                  })}
                  <th className="border-r border-b border-border bg-muted/5"></th>
                </tr>
                <tr>
                  <th className={`w-10 min-w-[40px] ${GRID_THEME.tableIndexCell} bg-muted/10 ${isFreezePanes ? 'sticky left-0 top-0 z-40 shadow-[1px_0_0_0_var(--color-border)]' : ''}`}></th>
                  {visibleHeaders.map((header, colIdx) => {
                    const headerMeta = cellMetadata[`header:${header}`] || {};
                    const isColumnActive = activeCell?.col === header;
                    if (headerMeta.mergedIn) return null;

                    const defaultAlign = (header === "Title / Item" || header === "Amount") ? "right" : "left";
                    const align = columnAlignments[header] || defaultAlign;
                    const alignClass = align === 'center' ? 'text-center' : 
                                     align === 'right' ? 'text-right' : 'text-left';

                    const isInHeaderSelection = selection && selMinRow <= -1 && selMaxRow >= -1 && colIdx >= selMinColIdx && colIdx <= selMaxColIdx;

                    return (
                      <th 
                      key={header} 
                      colSpan={headerMeta.colSpan}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      // Excel behavior: Preserve selection if right-clicking inside existing header selection
                      if (!isInHeaderSelection && rowCount > 0) {
                        setSelection({
                          startRow: 0,
                          endRow: data.length - 1,
                          startCol: header,
                          endCol: header
                        });
                        setActiveCell({ row: 0, col: header });
                      }
                      handleOpenContextMenu(e, 'header', undefined, header);
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 0) {
                        setSelection({ startRow: -1, endRow: -1, startCol: header, endCol: header });
                        setIsSelecting(true);
                      } else if (e.button === 2) {
                        if (!isInHeaderSelection) {
                          setSelection({ startRow: -1, endRow: -1, startCol: header, endCol: header });
                        }
                      }
                    }}
                    onMouseEnter={() => {
                      if (isSelecting && selection?.startRow === -1) {
                        setSelection(prev => prev ? { ...prev, endCol: header } : null);
                      }
                    }}
                      style={{ 
                        width: columnWidths[header] ? `${columnWidths[header]}px` : undefined,
                        minWidth: columnWidths[header] ? `${columnWidths[header]}px` : '120px' 
                    }}
                    className={`group/header px-2 py-1 text-[11px] font-bold tracking-tight border-r border-b border-border relative antialiased transition-colors ${
                      isColumnActive ? 'text-accent bg-accent/5' : 'text-muted bg-muted/10'
                    } ${
                      isFreezePanes && header === "Title / Item" ? "sticky left-10 top-0 z-40 shadow-[1px_0_0_0_var(--color-border)]" : ""
                    } ${isInHeaderSelection ? 'bg-accent/20 ring-1 ring-inset ring-accent/30 z-10' : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        <input
                          defaultValue={header}
                          onBlur={(e) => handleRenameColumn(header, e.target.value)}
                          className={`w-full bg-transparent border-0 focus:ring-1 focus:ring-accent rounded px-1 outline-none truncate hover:bg-muted/10 transition-colors ${alignClass}`}
                        />
                      </div>
                      </th>
                    );
                  })}
                  <th className="p-2 min-w-[140px] border-r border-b border-border bg-muted/5">
                    <div className="flex items-center gap-1 px-1">
                      <input
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddColumn(newColName);
                            setNewColName('');
                          }
                        }}
                        placeholder="Add Column..."
                        className="w-full bg-transparent border-0 focus:ring-1 focus:ring-accent rounded px-1 outline-none text-sm font-bold text-accent placeholder:text-accent/30"
                      />
                      <Plus size={14} className="text-accent/60" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleItems.map((item, i) => {
                  if (item.type === 'section') {
                  return (
                      <tr key={`section-${item.name}-${item.blockIdx}`} className="bg-muted/30 group/section transition-colors h-8">
                        <td colSpan={visibleHeaders.length + 2} className="px-3 py-1 border-b border-border">
                          <div className="flex items-center justify-between">
                            <input
                              defaultValue={item.name}
                              onBlur={(e) => handleRenameSectionBlock(item.startIndex, item.name, e.target.value)}
                              className="bg-transparent border-0 font-black text-foreground tracking-widest text-[11px] outline-none focus:ring-1 focus:ring-accent rounded px-1 flex-1 uppercase"
                            />
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleInsertSection(item.name, 'before')}
                                className="opacity-0 group-hover/section:opacity-100 p-1 text-muted hover:text-accent transition-all"
                                title="Insert Section Before"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button 
                                onClick={() => handleInsertSection(item.name, 'after')}
                                className="opacity-0 group-hover/section:opacity-100 p-1 text-muted hover:text-accent transition-all"
                                title="Insert Section After"
                              >
                                <ChevronDown size={12} />
                              </button>
                            <button 
                              onClick={() => handleDeleteSection(item.name)}
                              className="opacity-0 group-hover/section:opacity-100 p-1 text-muted hover:text-red-500 transition-all"
                              title="Delete Section"
                            >
                              <Trash2 size={12} />
                            </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const globalIndex = item.data._index;
                  return (
                    <GridRow 
                      key={globalIndex}
                      row={item.data}
                      globalIndex={globalIndex}
                      visibleHeaders={visibleHeaders}
                      activeCell={activeCell}
                      selection={selection}
                      cellMetadata={cellMetadata}
                      cellAlignments={cellAlignments}
                      columnAlignments={columnAlignments}
                      isFreezePanes={isFreezePanes}
                      dragFillRange={dragFillRange}
                      isSelecting={isSelecting}
                      handleUpdateCell={handleUpdateCell}
                      handleKeyDown={handleKeyDown}
                      setActiveCell={setActiveCell}
                      setSelection={setSelection}
                      setIsSelecting={setIsSelecting}
                      onOpenContextMenu={handleOpenContextMenu}
                      toggleCellAlignment={toggleCellAlignment}
                      handleDragFillStart={handleDragFillStart}
                      removeTableRow={removeTableRow}
                      setViewingMedia={setViewingMedia}
                      removeCellMetadata={removeCellMetadata}
                      evaluateFormula={evaluateFormula}
                      rowHeights={rowHeights}
                      startRowResizing={startRowResizing}
                      handleOpenDropdown={handleOpenDropdown}
                    />
                  );
                })}
              </tbody>
            </table>

            {showBackToTop && (
              <button 
                onClick={scrollToTop}
                className="fixed bottom-10 right-10 p-3 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-all z-50 animate-in fade-in zoom-in duration-300 group"
                title="Back to Top"
              >
                <ArrowUp size={20} className="group-hover:-translate-y-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      );
    } catch (e) {
      return (
        <div className="p-12 border-2 border-dashed border-red-500/20 rounded-xl bg-red-500/5 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-red-500/10 rounded-full text-red-500 mb-4">
            <Code size={24} />
          </div>
          <h3 className="text-red-500 font-bold mb-2">JSON Syntax Error</h3>
          <p className="text-sm text-red-500/70 mb-6 max-w-sm">
            {e instanceof Error ? e.message : "We encountered an error while parsing your data."}
            <br />
            <span className="opacity-70 mt-2 block">Check for missing commas, brackets, or quotes in the code view.</span>
          </p>
          <button 
            onClick={() => setViewMode('code')}
            className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm"
          >
            Switch to JSON Code to Fix
          </button>
        </div>
      );
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => { fetchFiles(); }, []);

  return (
    <main className={`${GRID_THEME.main} relative`}>
      {!isFullScreen && (
        <div className="flex h-full shrink-0 relative">
          {/* Vertical Icon Rail (Light Theme) */}
          <div className={`${GRID_THEME.rail} ${
            isExplorerVisible 
              ? 'fixed md:relative left-0 top-0 h-full md:h-auto z-50 translate-x-0 opacity-100 flex' 
              : 'fixed md:relative -translate-x-full md:translate-x-0 md:flex pointer-events-none md:pointer-events-auto opacity-0 md:opacity-100'
          } transition-all duration-300`}>
            <button
              onClick={() => setIsExplorerVisible(!isExplorerVisible)}
              className={`p-2 rounded-lg transition-all ${isExplorerVisible ? 'text-accent bg-accent/10 shadow-sm' : 'text-muted hover:text-foreground hover:bg-muted/10'}`}
              title={isExplorerVisible ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isExplorerVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
            <div className="h-px w-6 bg-border" />
            <button 
              className={`p-2 rounded-lg transition-all ${isExplorerVisible ? 'text-accent' : 'text-muted hover:text-foreground'}`}
              onClick={() => !isExplorerVisible && setIsExplorerVisible(true)}
            >
              <Folder size={20} />
            </button>
            <button className="p-2 text-muted hover:text-foreground transition-all" title="Search (Coming Soon)">
              <Search size={20} />
            </button>
            <div className="mt-auto flex flex-col gap-4">
              {recentNodes.length > 0 && (
                <div className="flex flex-col items-center gap-2 mb-2">
                  <History size={14} className="text-muted/40 mb-1" />
                  {recentNodes.map(node => (
                    <button
                      key={`recent-${node.id}`}
                      onClick={() => setSelectedId(node.id)}
                      className={`p-1.5 rounded transition-all group relative ${selectedId === node.id ? 'text-accent bg-accent/10 shadow-sm' : 'text-muted hover:text-foreground hover:bg-muted/10'}`}
                    >
                      <FileText size={16} />
                      <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[100] shadow-2xl uppercase tracking-wider transition-opacity">
                        {node.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="h-px w-6 bg-border self-center" />
              <button 
                onClick={toggleTheme}
                className="p-2 text-muted hover:text-accent transition-all"
                title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <button className="p-2 text-muted hover:text-foreground transition-all"><User size={20}/></button>
            </div>
          </div>

          {/* Explorer Drawer Panel */}
          {isExplorerVisible && (
            <div 
              className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40"
              onClick={() => setIsExplorerVisible(false)}
            />
          )}
          <aside
            className={`${GRID_THEME.drawer} ${
              isExplorerVisible 
                ? 'w-64 p-4 opacity-100 translate-x-12 md:translate-x-0' 
                : 'w-0 p-0 opacity-0 -translate-x-full md:translate-x-0 border-none pointer-events-none'
            } fixed md:relative left-0 top-0 z-50 md:z-auto h-full shadow-2xl md:shadow-none`}
          >
            <div className="flex justify-between items-center mb-4 px-1 min-w-[220px] transition-colors">
              <h1 className="font-black text-muted text-[10px] uppercase tracking-[0.2em]">Project Tree</h1>
              <div className="flex items-center gap-0.5">
                <button onClick={() => addItem('folder')} className="p-1.5 hover:bg-muted/10 rounded-md text-muted transition-colors" title="New Folder">
                  <FolderPlus size={16} />
                </button>
                <button onClick={() => addItem('file')} className="p-1.5 hover:bg-muted/10 rounded-md text-accent transition-colors" title="New File">
                  <FilePlus size={16} />
                </button>
              </div>
            </div>
            <div className="mb-4 relative group min-w-[220px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" />
              <input 
                type="text" 
                placeholder="Filter nodes..." 
                value={explorerSearch}
                onChange={(e) => setExplorerSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/5 border border-border rounded-md outline-none focus:ring-1 focus:ring-accent focus:bg-card text-foreground transition-all"
              />
            </div>
            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar min-w-[220px]">
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="animate-spin text-accent" size={20} />
                </div>
              ) : (
                filteredTree.map(node => (
                  <FileNodeItem 
                    key={node.id} node={node} onDelete={handleDelete} onRename={handleRename} onAdd={addItem}
                    onSelect={(node) => setSelectedId(node.id)} selectedId={selectedId ?? undefined}
                    searchTerm={explorerSearch} comparisonIds={comparisonIds} onToggleCompare={toggleComparisonId}
                  />
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      <div className={`flex-1 flex flex-col overflow-hidden ${isFullScreen ? 'p-0' : 'p-2 md:p-3'}`}>

        {/* Floating Mobile Toggle Button - Restored for better access while keeping the spreadsheet view maximized */}
        {!isFullScreen && !isExplorerVisible && (
          <button 
            onClick={() => setIsExplorerVisible(true)}
            className="md:hidden fixed bottom-6 left-6 z-[60] p-4 bg-accent text-accent-foreground rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <PanelLeftOpen size={24} />
          </button>
        )}

        {activeNode ? (
          <div className={`${GRID_THEME.editorContainer} ${isFullScreen ? 'bg-card' : 'bg-card border border-border rounded-xl shadow-sm'}`}>
            {!isFullScreen && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/10 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="md:p-1.5 p-0.5 bg-accent/10 text-accent rounded">
                    <FileIcon size={14} />
                  </div>
                  <h2 className="text-sm font-bold text-foreground truncate max-w-[120px] md:max-w-[240px]">{activeNode.name}</h2>
                  
                  <div className="h-4 w-px bg-border mx-1" />
                  
                  <nav className={GRID_THEME.navContainer}>
                    <button 
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
                        viewMode === 'table' ? 'bg-card text-accent shadow-sm ring-1 ring-border' : 'text-muted hover:text-foreground'
                      }`}
                    >
                      <TableIcon size={12} /> Grid
                    </button>
                    <button 
                      onClick={() => setViewMode('code')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
                        viewMode === 'code' ? 'bg-card text-accent shadow-sm ring-1 ring-border' : 'text-muted hover:text-foreground'
                      }`}
                    >
                      <Code size={12} /> JSON
                    </button>
                    <button 
                      onClick={() => setViewMode('compare')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
                        viewMode === 'compare' ? 'bg-card text-green-600 shadow-sm ring-1 ring-border' : 'text-muted hover:text-foreground'
                      }`}
                    >
                      <RefreshCcw size={12} /> Compare {comparisonIds.length > 0 && `(${comparisonIds.length})`}
                    </button>
                  </nav>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button onClick={() => window.open(`/print?id=${selectedId}`, '_blank')} className="p-1.5 text-muted hover:text-accent transition-colors" title="Printable Report"><Printer size={16} /></button>
                  <button onClick={handleShare} className="p-1.5 text-muted hover:text-accent transition-colors" title="Copy Link"><Share2 size={16} /></button>
                  <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1.5 text-muted hover:text-accent transition-colors" title="Toggle Focus Mode">{isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
                  <div className="h-4 w-px bg-border mx-1" />
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-foreground rounded text-[11px] font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm"
                  >
                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
            
            {activeNode.type === 'file' && (
              <div className="flex flex-col flex-1 min-h-0">
                {isFullScreen && (
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted shrink-0">
                      <TableIcon size={14} /> {activeNode.name}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-foreground rounded text-[11px] font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm"
                      >
                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setIsFullScreen(false)} className="text-muted hover:text-foreground p-1" title="Exit Focus Mode"><Minimize2 size={14} /></button>
                    </div>
                  </div>
                )}

                {viewMode === 'code' ? (
                  <textarea
                    value={codeViewContent}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    className="w-full h-full p-4 font-mono text-sm bg-muted/5 text-foreground rounded-lg border-0 focus:ring-2 focus:ring-accent outline-none resize-none shadow-inner"
                    placeholder='{ "content": [...], "display_settings": {...} }'
                  />
                ) : viewMode === 'table' ? (
                  renderTableEditor()
                ) : viewMode === 'compare' ? (
                  renderComparisonTable()
                ) : null}

                {/* High-density Status Bar */}
                <footer className={GRID_THEME.statusBar}>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><Clock size={12} className="text-muted/40"/> Created {new Date(activeNode.created_at).toLocaleDateString()}</div>
                    <div className="h-3 w-px bg-border" />
                    <div className="flex items-center gap-1.5"><User size={12} className="text-muted/40"/> LGU Admin</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><HardDrive size={12} className="text-muted/40"/> {formatSize(activeNode.size_bytes)}</div>
                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live System</div>
                  </div>
                </footer>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted">
            <Folder size={48} className="mb-4 opacity-10" />
            <p>Select a file to start data entry.</p>
            {!isExplorerVisible && (
              <button 
                onClick={() => setIsExplorerVisible(true)}
                className="md:hidden mt-4 flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg font-bold text-sm shadow-sm"
              >
                <PanelLeftOpen size={16} /> Open Sidebar
              </button>
            )}
          </div>
        )}

          {/* Custom Dropdown Menu (Location/Allocation) */}
          {dropdownMenu && (() => {
            const cellKey = `${dropdownMenu.row}:${dropdownMenu.col}`;
            const meta = cellMetadata[cellKey] || {};
            const dropdownFont = meta.fontFamily || 'inherit';
            // Respect both font family and size
            const dropdownSize = meta.fontSize ? (typeof meta.fontSize === 'number' ? `${meta.fontSize}px` : meta.fontSize) : '0.875rem';
            
            return (
              <div 
                className="fixed z-[120] bg-card border border-border shadow-2xl rounded-xl py-1.5 max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200 custom-scrollbar dropdown-container"
                style={{ 
                  left: Math.min(dropdownMenu.x, window.innerWidth - dropdownMenu.width - 20), 
                  top: Math.min(dropdownMenu.y, window.innerHeight - 310),
                  width: dropdownMenu.width,
                  fontFamily: dropdownFont,
                  fontSize: dropdownSize
                }}
                onClick={e => e.stopPropagation()}
              >
                {dropdownMenu.options.map((opt) => {
                  const isSelected = gridData.get(`${dropdownMenu.row}:${dropdownMenu.col}`) === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => {
                        handleUpdateCell(dropdownMenu.row, dropdownMenu.col, opt);
                        setDropdownMenu(null);
                      }}
                      className={`w-full text-left px-4 py-2 transition-colors flex items-center justify-between group ${
                        isSelected 
                        ? 'bg-accent/10 text-accent font-bold' 
                        : 'hover:bg-muted/10 text-foreground hover:text-accent'
                      }`}
                    >
                      <span className="truncate mr-2">{opt}</span>
                      {isSelected && <Check size={12} className="shrink-0" />}
                    </button>
                  );
                })}
                <div className="h-px bg-border my-1 mx-2" />
                <button
                  onClick={() => {
                    handleUpdateCell(dropdownMenu.row, dropdownMenu.col, "");
                    setDropdownMenu(null);
                  }}
                  className="w-full text-left px-4 py-2 text-muted hover:text-red-500 hover:bg-red-500/5 transition-colors italic"
                >
                  Clear Selection
                </button>
              </div>
            );
          })()}

        {/* Media Preview Modal */}
        {viewingMedia && (
          <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={() => setViewingMedia(null)}
          >
            <div 
              className="bg-card rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-border" 
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0 bg-muted/5">
                <div className="flex items-center gap-4">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <Paperclip size={18} className="text-accent" />
                    Cell Attachments ({viewingMedia.attachments.length})
                  </h3>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => insertMedia(viewingMedia.row, viewingMedia.col, 'image')}
                      className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-green-500/20 transition-colors border border-green-500/20 shadow-sm"
                    >
                      <ImageIcon size={12} /> Add Image
                    </button>
                    <button 
                      onClick={() => insertMedia(viewingMedia.row, viewingMedia.col, 'file')}
                      className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-amber-500/20 transition-colors border border-amber-500/20 shadow-sm"
                    >
                      <Paperclip size={12} /> Add File
                    </button>
                  </div>
                </div>
                <button onClick={() => setViewingMedia(null)} className="p-1 hover:bg-muted/10 rounded-full transition-colors text-muted hover:text-foreground">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto bg-background/50 flex-1">
                {/* Images Section */}
                {viewingMedia.attachments.some((m: any) => m.type === 'image') && (
                  <div className="mb-8">
                    <h4 className="text-xs font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ImageIcon size={14} className="text-green-500" /> Images
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {viewingMedia.attachments.map((img: any, idx: number) => {
                        if (img.type !== 'image') return null;
                        return (
                          <div key={idx} className="group relative bg-card p-2 rounded-xl border border-border shadow-sm hover:shadow-md transition-all">
                            <div className="relative aspect-video rounded-lg bg-background overflow-hidden">
                              <img src={img.url} alt={img.name} className="w-full h-full object-contain" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <a href={img.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-white hover:underline">Open Full Size</a>
                                <button 
                                  onClick={() => deleteAttachment(viewingMedia.row, viewingMedia.col, idx)}
                                  className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                                  title="Delete Image"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 px-1">
                              <p className="text-[10px] font-bold text-foreground truncate">{img.name}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Files Section */}
                {viewingMedia.attachments.some((m: any) => m.type === 'file') && (
                  <div>
                    <h4 className="text-xs font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                      <FileIcon size={14} className="text-amber-500" /> Documents & Files
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {viewingMedia.attachments.map((file: any, idx: number) => {
                        if (file.type !== 'file') return null;
                        return (
                          <div key={idx} className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm hover:bg-muted/5 transition-colors group">
                            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                              <FileIcon size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-foreground truncate leading-tight">{file.name}</p>
                              <p className="text-[9px] text-muted uppercase tracking-tighter">{formatSize(file.size || 0)}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <a href={file.url} download={file.name} className="p-2 bg-muted/10 text-muted rounded-lg hover:bg-accent hover:text-accent-foreground transition-all" title="Download">
                                <Save size={14} />
                              </a>
                              <button 
                                onClick={() => deleteAttachment(viewingMedia.row, viewingMedia.col, idx)}
                                className="p-2 bg-muted/10 text-muted rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                title="Delete Attachment"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-slate-400 font-sans">Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
