'use client';
import React, { useEffect, useState, useMemo, useCallback, Fragment, Suspense, useRef, createContext, useContext } from 'react';
import { flushSync } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import { buildTree, FileNode, findNodeById, CellMetadata, GridRowData } from '@/lib/tree-utils';
import { toA1Key, fromA1Key, getExcelColumnLabel, hydrateMapToArray, dehydrateArrayToMap, rekeySparseMap, rekeyMetadataRecord } from '@/lib/excel-utils';
import FileNodeItem from '@/components/FileNodeItem';
import { Clock, User, HardDrive, Folder, Save, Code, Table as TableIcon, Plus, Trash2, X, AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Search, Printer, FileText, Share2, FolderPlus, FilePlus, PanelLeftClose, PanelLeftOpen, ChevronUp, ChevronDown, ArrowUp, Loader2, RefreshCcw, Calendar, Sigma, Image as ImageIcon, Paperclip, FileIcon, ChevronRight as ChevronRightIcon, Maximize2, Minimize2, Type, History, Moon, Sun, ZoomIn, ZoomOut, Check, MoreVertical, Lock, Mail, LogIn, LogOut } from 'lucide-react';

/**
 * Enhanced FileNode type to include soft-delete metadata
 */
type TrashNode = FileNode & { is_deleted?: boolean; deleted_at?: string | null; deleted_by?: string | null };

/**
 * Theme Context to isolate theme state and prevent full dashboard re-renders.
 */
const ThemeContext = createContext<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>({ theme: 'dark', toggleTheme: () => {} });

const useTheme = () => useContext(ThemeContext);

/**
 * Isolated Toggle Component: Only this small component re-renders when the theme changes.
 */
const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button 
      onClick={toggleTheme}
      className="p-2 text-muted hover:text-accent group relative focus-visible:ring-2 focus-visible:ring-accent outline-none rounded-lg"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
        {theme === 'light' ? "Dark Mode" : "Light Mode"}
      </div>
    </button>
  );
};

/**
 * Theme Registry: Centralized class management for Dark/Light mode consistency.
 * By using semantic variables defined in globals.css, we ensure automatic theme switching.
 */
const GRID_THEME = {
  // Main Layout Containers
  main: "flex h-screen bg-background bg-[linear-gradient(to_right,var(--color-grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-grid-line)_1px,transparent_1px)] bg-[size:24px_24px] text-foreground",
  rail: "w-12 bg-card flex flex-col items-center py-4 gap-4 z-[60] border-r border-border",
  drawer: "bg-card flex flex-col shadow-sm transition-[width,padding,opacity,transform] duration-300 ease-in-out overflow-hidden whitespace-nowrap border-r border-border transform-gpu will-change-[width,padding,opacity,transform]",
  editorContainer: "flex flex-col flex-1 min-h-0 overflow-hidden",
  
  // Grid Editor Components
  editor: "flex flex-col h-full overflow-hidden bg-card",
  toolbar: "flex items-center justify-between p-2 bg-background border-b border-border gap-2 overflow-x-auto no-scrollbar whitespace-nowrap",
  formulaBar: "flex items-start gap-2 p-1.5 bg-card border-b border-border shadow-inner z-20",
  statusBar: "h-7 bg-background border-t border-border flex items-center justify-between px-3 text-[10px] font-bold text-muted uppercase tracking-wider shrink-0 select-none",
  navContainer: "flex bg-muted/10 p-0.5 rounded-md border border-border",
  
  // Table Specific Styles
  tableHeader: "bg-muted/10 shadow-[0_1px_0_var(--color-border)]",
  tableHeaderRow: "bg-muted/20 select-none h-5",
  tableIndexCell: "border-r border-b border-border",
  tableCell: "p-0 border-r border-b border-border bg-card group/cell relative align-middle",
  tableBodyRow: "hover:bg-muted/5 group relative",

  // Inputs and Interactive
  tableInput: "grid-input w-full px-2 py-1 text-sm text-foreground bg-transparent border-0 outline-none dark:bg-card whitespace-pre-wrap break-words",
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

const formatDateDisplay = (value: any, formatId: string = 'long') => {
  if (value === null || value === undefined || value === '') return '';

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else {
    const strValue = String(value);
    const parts = strValue.split('-');
    // Only manually parse if it looks like YYYY-MM-DD (ISO)
    // This prevents MM-DD-YYYY from being parsed as Year 01, Month 23...
    if (parts.length === 3 && parts[0].length === 4) {
      const [y, m, d] = parts.map(Number);
      date = new Date(y, m - 1, d);
    } else {
      date = new Date(strValue);
    }
  }

  if (isNaN(date.getTime())) return String(value);

  switch (formatId) {
    case 'medium': return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    case 'short': return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    case 'iso': {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    default: return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
};

/**
 * Helper to shift A1-style cell references in formulas during drag-fill operations.
 * Handles anchored references like $A$1.
 */
const shiftFormula = (formula: any, rowOffset: number) => {
  if (typeof formula !== 'string' || !formula.startsWith('=')) return formula;
  return formula.replace(/(\$?[A-Z]+)(\$?)(\d+)/gi, (match, col, anchor, row) => {
    if (anchor === '$') return match; // Row is anchored, do not shift
    const newRow = parseInt(row, 10) + rowOffset;
    return `${col}${anchor}${newRow}`;
  });
};

/**
 * CellEditor: Optimized uncontrolled-like component for instant typing.
 * Uses local state for characters and debounces the global "push" to gridData.
 */
const CellEditor = ({ initialValue, onSync, onKeyDown, className, isTextarea, type = "text", dataRow, dataCol }: any) => {
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

  const handleLocalChange = (val: any) => {
    setLocalValue(val);
    
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
      ref={inputRef}
      type={type}
      step={type === 'number' ? '0.01' : undefined}
      data-row={dataRow}
      data-col={dataCol}
      value={localValue}
      autoFocus
      onBlur={handleBlur}
        onChange={(e) => handleLocalChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`${className} w-full`}
    />
  );
};

interface GridRowProps {
  row: GridRowData & { section?: string; _index?: number };
  globalIndex: number;
  visibleHeaders: string[];
  activeCell: { row: number, col: string } | null;
  selection: { startRow: number; endRow: number; startCol: string; endCol: string } | null;
  cellMetadata: Record<string, CellMetadata>;
  cellAlignments: Record<string, 'left' | 'center' | 'right'>;
  columnAlignments: Record<string, 'left' | 'center' | 'right'>;
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
}

const GridRow = React.memo(({ 
  row, globalIndex, visibleHeaders, activeCell, selection, 
  cellMetadata, cellAlignments, columnAlignments, isFreezePanes,
  dragFillRange, isSelecting, handleUpdateCell, handleKeyDown,
  setActiveCell, setSelection, setIsSelecting, onOpenContextMenu, setDragFillRange,
  toggleCellAlignment, handleDragFillStart, removeTableRow,
  setViewingMedia, removeCellMetadata, evaluateFormula,
  rowHeights, startRowResizing, handleOpenDropdown, onMeasuredHeight, masterColumnOrder, zoom
}: GridRowProps) => {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const isRowActive = activeCell?.row === globalIndex;
  const startColIdx = selection ? visibleHeaders.indexOf(selection.startCol) : -1;
  const endColIdx = selection ? visibleHeaders.indexOf(selection.endCol) : -1;
  const selMinRow = selection ? Math.min(selection.startRow, selection.endRow) : -1;
  const selMaxRow = selection ? Math.max(selection.startRow, selection.endRow) : -1;
  const selMinColIdx = (selection && startColIdx !== -1 && endColIdx !== -1) ? Math.min(startColIdx, endColIdx) : -1;
  const selMaxColIdx = (selection && startColIdx !== -1 && endColIdx !== -1) ? Math.max(startColIdx, endColIdx) : -1;

  // Dynamic Height Measurement: Use ResizeObserver to detect the actual rendered height
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

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
  }, [globalIndex, onMeasuredHeight, rowHeights, zoom]);

  return (
    <tr 
      ref={rowRef}
      className={GRID_THEME.tableBodyRow} 
      style={{ height: rowHeights[String(globalIndex)] ? `${rowHeights[String(globalIndex)]}px` : undefined }}
    >
      <td
        className={`relative group/row-index w-10 min-w-10 text-[10px] font-bold text-center select-none cursor-pointer ${GRID_THEME.tableIndexCell} ${isRowActive ? 'active-header shadow-[inset_-2px_0_0_0_var(--color-accent)]' : 'bg-muted/10 text-muted hover:bg-muted/30 hover:text-foreground'} ${
          isFreezePanes ? 'sticky left-0 z-10 bg-card shadow-[1px_0_0_0_var(--color-border),0_1px_0_0_var(--color-border)]' : ''
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

        if (meta.mergedIn) return null;
        const cellAlign = cellAlignments[cellKey] || cellAlignments[legacyKey] || columnAlignments[header] || ((header === "Title / Item" || header === "Amount") ? "right" : "left");
        // Fix: Use both text-alignment and flex-justification classes
        const alignClass = cellAlign === 'center' ? 'text-center justify-center' : cellAlign === 'right' ? 'text-right justify-end' : 'text-left justify-start';

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
                setActiveCell({ row: globalIndex, col: header }); 
                setSelection({ startRow: globalIndex, endRow: globalIndex, startCol: header, endCol: header }); 
                setIsSelecting(true); 
              } 
            }}
            onMouseEnter={() => { 
              if (isSelecting) setSelection((prev: any) => prev ? { ...prev, endRow: globalIndex, endCol: header } : null); 
              if (dragFillRange) setDragFillRange(prev => prev ? { ...prev, endRow: globalIndex } : null);
            }}
            onClick={() => {
              const input = document.querySelector(`[data-row="${globalIndex}"][data-col="${header}"]`) as HTMLElement;
              if (input) input.focus();
            }}
           className={`${GRID_THEME.tableCell} ${meta.fontFamily ? '' : 'font-sans'} ${isFreezePanes && header === "Title / Item" ? "sticky left-10 z-10 shadow-[1px_0_0_0_var(--color-border)]" : ""} ${activeCell?.row === globalIndex && activeCell?.col === header ? 'ring-2 ring-inset ring-accent z-20' : ''} ${isInSelection ? `bg-accent/10 z-10 ring-1 ring-inset ring-accent/30` : ''} ${isInDragFill ? 'bg-accent/5 ring-1 ring-inset ring-accent/50 z-10' : ''}`}
            style={{ fontFamily: meta.fontFamily || 'inherit', height: '1px' /* Forces cell to respect content height */ }}
          >
            {/* Metadata Clear Button - Visible on hover for cells with formatting or files */}
            {((meta.attachments?.length ?? 0) > 0 || meta.type || meta.fontFamily) && (
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
            <button onClick={(e) => { e.stopPropagation(); toggleCellAlignment(globalIndex, header); }} className="absolute right-1 top-1 opacity-0 group-hover/cell:opacity-100 p-1 text-muted hover:text-accent bg-card/90 rounded shadow-sm z-30 transition-all">
              {cellAlign === 'center' ? <AlignCenter size={10} /> : cellAlign === 'right' ? <AlignRight size={10} /> : <AlignLeft size={10} />}
            </button>
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
                  <span className={`wrap-break-word whitespace-normal leading-tight ${cellAlign === 'center' ? 'text-center' : cellAlign === 'right' ? 'text-right' : 'text-left'}`}>
                    {row[header] || <span className="text-muted/40 italic font-normal">Select...</span>}
                  </span>
                </button>
                <ChevronDown size={12} className="absolute right-1.5 text-muted/50 group-hover/drop:text-accent shrink-0 pointer-events-none" />
              </div>
            ) : meta.type === 'date' ? (
              <div className="relative w-full flex items-center group/date min-h-7">
                <input 
                  type="date" data-row={globalIndex} data-col={header} 
                  value={typeof row[header] === 'boolean' ? String(row[header]) : (row[header] ?? '')} 
                  onChange={(e) => handleUpdateCell(globalIndex, header, e.target.value)} 
                  onClick={(e) => {
                    // Modern browsers support showPicker() on input elements to trigger the calendar
                    try { (e.currentTarget as HTMLInputElement).showPicker(); } catch (err) {}
                  }}
                  className="absolute inset-0 opacity-0 z-20 cursor-pointer w-full h-full" 
                />
                <div className={`w-full px-2 py-1.5 text-sm text-foreground ${alignClass} group-hover:bg-accent/10 flex flex-wrap items-center gap-x-2 flex-1 ${cellAlign === 'center' ? 'justify-center' : cellAlign === 'right' ? 'justify-end' : 'justify-start'}`}>
                  {row[header] ? formatDateDisplay(row[header], meta.format) : <span className="text-muted/50 font-normal italic flex items-center gap-1.5"><Calendar size={14} className="shrink-0" /> Set Date...</span>}
                </div>
              </div>
            ) : meta.type === 'formula' ? (
              <div onClick={() => setActiveCell({ row: globalIndex, col: header })} className={`w-full px-2 py-1.5 text-sm text-foreground cursor-text min-h-7 flex flex-wrap items-center gap-x-2 wrap-break-word ${activeCell?.row === globalIndex && activeCell?.col === header ? 'bg-accent/10' : 'hover:bg-muted/10'} ${alignClass}`}>
                {(() => { const result = evaluateFormula(row[header], row, meta.format); return typeof result === 'number' ? formatNumberDisplay(result, meta.format) : result; })()}
              </div>
            ) : (meta.type === 'number' || header === 'Amount') ? (
              <div className={`flex flex-wrap items-center gap-x-2 ${alignClass} w-full min-h-7 px-2 py-1`}>
                {activeCell?.row === globalIndex && activeCell?.col === header ? (
                  <CellEditor 
                    initialValue={row[header]} 
                    onSync={(val: any) => handleUpdateCell(globalIndex, header, val)} 
                    onKeyDown={(e: any) => handleKeyDown(e, globalIndex, colIndex, visibleHeaders)} 
                    className={`${GRID_THEME.tableInput} flex-1`}
                    type="number"
                  />
                ) : (
                  <div onClick={() => setActiveCell({ row: globalIndex, col: header })} className={`text-sm text-foreground cursor-text`}>{row[header] ? formatNumberDisplay(row[header], meta.format) : <span className="text-muted/30">0.00</span>}</div>
                )}
              </div>
            ) : (
              <div className={`flex flex-wrap items-center gap-x-2 ${alignClass} w-full min-h-7 px-2 py-1.5`}>
                {activeCell?.row === globalIndex && activeCell?.col === header ? (
                  <CellEditor 
                    isTextarea 
                    initialValue={row[header]} 
                    onSync={(val: any) => handleUpdateCell(globalIndex, header, val)} 
                    onKeyDown={(e: any) => handleKeyDown(e, globalIndex, colIndex, visibleHeaders)} 
                    className={`${GRID_THEME.tableInput} flex-1`}
                    dataRow={globalIndex} dataCol={header}
                  />
                ) : (
                  <div 
                    onClick={() => setActiveCell({ row: globalIndex, col: header })} 
                    className={`text-sm text-foreground cursor-text whitespace-pre-wrap wrap-break-word`}
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

  // 6. Standard UI state checks
  return (
    prev.isSelecting === next.isSelecting && 
    prev.isFreezePanes === next.isFreezePanes &&
    prev.visibleHeaders === next.visibleHeaders &&
    prev.dragFillRange === next.dragFillRange &&
    prev.masterColumnOrder === next.masterColumnOrder &&
    prev.zoom === next.zoom
  );
});

/**
 * LoginPage: Secure entry point for the MEO Data Entry system.
 */
const LoginPage = React.memo(() => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (lockoutUntil && Date.now() < lockoutUntil) {
      setError(`Too many attempts. Please try again in ${Math.ceil((lockoutUntil - Date.now()) / 1000)} seconds.`);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // If Supabase returns a 429 (Too Many Requests), trigger a local lockout
        if (error.status === 429) {
          setLockoutUntil(Date.now() + 60000); // Lock for 60 seconds
        }
        throw error;
      }
    } catch (err: any) {
      setError(err.status === 429 ? "Too many login attempts. Please wait a minute." : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-[linear-gradient(to_right,var(--color-grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-grid-line)_1px,transparent_1px)] bg-[size:24px_24px]">
      <div className="w-full max-w-md p-8 bg-card border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center mb-8">
          <div className="p-2 bg-white rounded-2xl mb-4 shadow-inner border border-border">
            <img 
              src="https://www.labason.gov.ph/images/headers/200_pixels_LGU_LOGO.png" 
              alt="LGU Labason Logo" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">MEO Data Entry</h1>
          <p className="text-sm text-muted font-medium mt-1 uppercase tracking-[0.2em]">LGU Labason System</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={18} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@labason.gov.ph" className="w-full pl-10 pr-4 py-2.5 bg-muted/5 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={18} />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-4 py-2.5 bg-muted/5 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm" />
            </div>
          </div>
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-medium">{error}</div>}
          <button 
            type="submit" 
            disabled={loading || (lockoutUntil !== null && Date.now() < lockoutUntil)} 
            className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            Sign In to System
          </button>
        </form>
      </div>
    </div>
  );
});

const DashboardContent = React.memo(({ user }: { user: any }) => {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deletedNodes, setDeletedNodes] = useState<TrashNode[]>([]);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [masterColumnOrder, setMasterColumnOrder] = useState<string[]>([]);
  const [gridData, setGridData] = useState<Map<string, any>>(new Map()); // Sparse Map State
  const [rowCount, setRowCount] = useState(0);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [columnAlignments, setColumnAlignments] = useState<Record<string, 'left' | 'center' | 'right'>>({});
  const [cellAlignments, setCellAlignments] = useState<Record<string, 'left' | 'center' | 'right'>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [cellMetadata, setCellMetadata] = useState<Record<string, any>>({});
  const [selectedYear, setSelectedYear] = useState<string>('2020');

  // Audit Logs State and Fetching
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, nodes(name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching logs:', error.message);
    } else {
      setAuditLogs(data || []);
    }
    setIsLoadingLogs(false);
  }, []);

  // History Management States and Refs
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const editStartValueRef = useRef<any>(null);
  const editingCellRef = useRef<{row: number, col: string} | null>(null);

  /**
   * Helper to log actions for auditing
   */
  const logAction = useCallback(async (action: string, nodeId: string | null, details: any = {}) => {
    const { error } = await supabase.from('audit_logs').insert([{
      action,
      node_id: nodeId,
      user_id: user.id,
      details: {
        ...details,
        user_email: user.email // Capture current email for display
      }
    }]);
    if (error) {
      console.error(`Audit Log Failed [${action}]:`, error.message);
    }
  }, [user.id]);

  /**
   * History Management: Undo/Redo Engine
   * Leverages Sparse Map referential stability for efficient snapshots.
   */
  // Optimization: Use a ref to track current state for history snapshots.
  const stateRef = useRef({ gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder });
  stateRef.current = { gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder };

  const saveStateToHistory = useCallback(() => {
    const { gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder } = stateRef.current;
    const snapshot = {
      gridData: new Map(gridData),
      rowCount: rowCount,
      cellMetadata: { ...cellMetadata },
      cellAlignments: { ...cellAlignments },
      rowHeights: { ...rowHeights },
      masterColumnOrder: [...masterColumnOrder],
      columnOrder: [...columnOrder]
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
      rowHeights: { ...rowHeights },
      masterColumnOrder: [...masterColumnOrder],
      columnOrder: [...columnOrder]
    };
    setRedoStack(prev => [...prev, currentState]);
    setUndoStack(prev => prev.slice(0, -1));
    setGridData(prevState.gridData);
    setRowCount(prevState.rowCount);
    setCellMetadata(prevState.cellMetadata);
    setCellAlignments(prevState.cellAlignments);
    setRowHeights(prevState.rowHeights);
    setMasterColumnOrder(prevState.masterColumnOrder);
    setColumnOrder(prevState.columnOrder);
  }, [undoStack, gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    const currentState = {
      gridData: new Map(gridData),
      rowCount,
      cellMetadata: { ...cellMetadata },
      cellAlignments: { ...cellAlignments },
      rowHeights: { ...rowHeights },
      masterColumnOrder: [...masterColumnOrder],
      columnOrder: [...columnOrder]
    };
    setUndoStack(prev => [...prev, currentState]);
    setRedoStack(prev => prev.slice(0, -1));
    setGridData(nextState.gridData);
    setRowCount(nextState.rowCount);
    setCellMetadata(nextState.cellMetadata);
    setCellAlignments(nextState.cellAlignments);
    setRowHeights(nextState.rowHeights);
    setMasterColumnOrder(nextState.masterColumnOrder);
    setColumnOrder(nextState.columnOrder);
  }, [redoStack, gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder]);

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

  const handleUpdateCell = useCallback((index: number, key: string, value: any) => {
    const colIndex = masterColumnOrder.indexOf(key);
    if (colIndex === -1) return;
    const coord = toA1Key(index, colIndex);
    if (stateRef.current.gridData.get(coord) === value) return;
    if (editStartValueRef.current === stateRef.current.gridData.get(coord)) {
      saveStateToHistory();
    }
    setGridData(prev => {
      const next = new Map(prev);
      next.set(coord, value);
      return next;
    });
  }, [saveStateToHistory, masterColumnOrder]);

  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'table' | 'compare' | 'logs' | 'trash'>('table');

  useEffect(() => {
    if (viewMode === 'logs') fetchAuditLogs();
    if (viewMode === 'trash') fetchFiles();
  }, [viewMode, fetchAuditLogs]);

  const [rowFilter, setRowFilter] = useState<string>('');
  const [newColName, setNewColName] = useState<string>('');
  const searchParams = useSearchParams();
  const [isExplorerVisible, setIsExplorerVisible] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isFreezeHeaders, setIsFreezeHeaders] = useState(true);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [activeCell, setActiveCell] = useState<{ row: number, col: string } | null>(null);
  const formulaBarRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingMedia, setPendingMedia] = useState<{ row: number, col: string, type: 'image' | 'file' } | null>(null);
  const [viewingMedia, setViewingMedia] = useState<any | null>(null);
  const [dropdownMenu, setDropdownMenu] = useState<{ x: number, y: number, width: number, row: number, col: string, options: string[], highlightIndex: number } | null>(null);
  
  // Profile State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(user?.user_metadata?.full_name || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.user_metadata?.avatar_url || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profilePassword, setProfilePassword] = useState('');
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Sync profile state when opening modal
  useEffect(() => {
    if (showProfileModal) {
      setProfileName(user?.user_metadata?.full_name || '');
      setProfileAvatar(user?.user_metadata?.avatar_url || '');
      setProfileEmail(user?.email || '');
      setProfilePassword('');
    }
  }, [showProfileModal, user]);

  // Virtualization State
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800); // Sane initial height to prevent partial render
  const DEFAULT_ROW_HEIGHT = 40; // Matches min-h-7 (28px) + py-1.5 (12px) = 40px

  // Throttled Height Updates: Prevents layout thrashing during sidebar resize
  const heightUpdateQueue = useRef<Record<string, number>>({});
  const heightRafId = useRef<number | null>(null);

  const onMeasuredHeight = useCallback((index: number, height: number) => {
    heightUpdateQueue.current[String(index)] = height;
    
    if (heightRafId.current !== null) return;
    
    heightRafId.current = requestAnimationFrame(() => {
      setRowHeights(prev => {
        const next = { ...prev };
        let changed = false;
        for (const [idx, h] of Object.entries(heightUpdateQueue.current)) {
          if (prev[idx] === undefined || Math.abs(prev[idx] - h) > 0.5) {
            next[idx] = h;
            changed = true;
          }
        }
        heightUpdateQueue.current = {};
        heightRafId.current = null;
        return changed ? next : prev;
      });
    });
  }, []);

  // Virtualization Performance: Use requestAnimationFrame for scroll updates.
  const scrollRafRef = useRef<number | null>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    setScrollTop(top);
    setShowBackToTop(top > 300);
  }, []);

  useEffect(() => {
    return () => { 
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current); 
      if (heightRafId.current !== null) cancelAnimationFrame(heightRafId.current);
    };
  }, []);

  // Resize Observer to track viewport height for virtualization
  useEffect(() => {
    if (!tableContainerRef.current || viewMode !== 'table') return;
    
    const observer = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        const entry = entries[0];
        if (!entry) return;
        
        // EXCEL STABILITY FIX: Use contentRect.height instead of clientHeight.
        // contentRect measures the box height BEFORE scrollbars are subtracted.
        // This breaks the feedback loop where a horizontal scrollbar appearing 
        // would otherwise shrink the 'visible height' and trigger a re-render.
        const h = Math.floor(entry.contentRect.height);
        if (h > 0) {
          // STABILITY FIX: Threshold increased to 20px (larger than a scrollbar).
          // This prevents the "Scrollbar Toggle Loop" from triggering a re-render.
          setContainerHeight(prev => (Math.abs(prev - h) > 20) ? h : prev);
        }
      });
    });
    observer.observe(tableContainerRef.current);
    setContainerHeight(tableContainerRef.current.getBoundingClientRect().height || 800);
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
  const handleOpenContextMenu = useCallback((e: React.MouseEvent, type: 'cell' | 'header' | 'row' | 'section', col: string = "", row?: number, sectionName?: string) => {
    e.preventDefault();
    const menuWidth = 192; 
    // Refined height estimates based on current item counts
    const menuHeight = type === 'row' ? 280 : (type === 'header' ? 380 : (type === 'section' ? 200 : 440)); 
    
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
    
    setContextMenu({ x, y, row, col, type, sectionName });
  }, []);

  const handleOpenDropdown = useCallback((e: React.MouseEvent, row: number, col: string, options: string[]) => {
    e.preventDefault();
    e.stopPropagation();
    // Find the cell container (the div with group/drop) to align the dropdown correctly with the column
    const container = (e.currentTarget as HTMLElement).closest('div');
    const rect = container ? container.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect();
    
    setDropdownMenu({
      x: rect.left,
      y: rect.bottom + 4,
      width: rect.width,
      row,
      col,
      options,
      highlightIndex: 0
    });
  }, []);

  const [codeViewContent, setCodeViewContent] = useState<string>('');
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [dragFillRange, setDragFillRange] = useState<{ startRow: number; endRow: number; col: string } | null>(null);

  // Keyboard navigation for dropdowns
  useEffect(() => {
    if (!dropdownMenu) return;

    const handleDropdownKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDropdownMenu(prev => prev ? { 
          ...prev, 
          highlightIndex: (prev.highlightIndex + 1) % prev.options.length 
        } : null);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDropdownMenu(prev => prev ? { 
          ...prev, 
          highlightIndex: (prev.highlightIndex - 1 + prev.options.length) % prev.options.length 
        } : null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedOption = dropdownMenu.options[dropdownMenu.highlightIndex];
        handleUpdateCell(dropdownMenu.row, dropdownMenu.col, selectedOption);
        setDropdownMenu(null);
        // Maintain focus on the trigger button
        const btn = document.querySelector(`[data-row="${dropdownMenu.row}"][data-col="${dropdownMenu.col}"]`) as HTMLElement;
        btn?.focus();
      } else if (e.key === 'Escape') {
        setDropdownMenu(null);
      }
    };

    window.addEventListener('keydown', handleDropdownKeys);
    return () => window.removeEventListener('keydown', handleDropdownKeys);
  }, [dropdownMenu, handleUpdateCell]);

  const [selection, setSelection] = useState<{ startRow: number; endRow: number; startCol: string; endCol: string } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFreezePanes, setIsFreezePanes] = useState(false);
  const [recentNodes, setRecentNodes] = useState<FileNode[]>([]);
  const [zoom, setZoom] = useState(1);

  // Track cell value before editing starts for atomic undo
  useEffect(() => {
    if (activeCell) {
      const colIdx = masterColumnOrder.indexOf(activeCell.col);
      const coord = colIdx !== -1 ? toA1Key(activeCell.row, colIdx) : '';
      const val = coord ? gridData.get(coord) : undefined;
      if (editingCellRef.current?.row !== activeCell.row || editingCellRef.current?.col !== activeCell.col) {
        editStartValueRef.current = val;
        editingCellRef.current = activeCell;
      }
    } else {
      editingCellRef.current = null;
      editStartValueRef.current = null;
    }
  }, [activeCell, gridData, masterColumnOrder]);

  const activeNode = useMemo(() => 
    selectedId ? findNodeById(tree, selectedId) : null
  , [tree, selectedId]);

  // Load preferences from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('meo-recent-files');
    if (saved) {
      try { setRecentNodes(JSON.parse(saved)); } catch (e) { console.error("Failed to parse recent files"); }
    }
    
    
  }, []);


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

  // Synchronize code view content (JSON) from state
  useEffect(() => {
    // Only synchronize state TO the code view when entering the mode or changing files.
    // This prevents the cursor from jumping to the end of the text while you are editing the JSON.
    if (viewMode !== 'code' || !activeNode || activeNode.type !== 'file') return;

    const contentArray = hydrateMapToArray(gridData, rowCount, allHeaders, masterColumnOrder);
    const fullData = {
      content: contentArray,
      display_settings: {
        columnAlignments,
        cellAlignments,
        hiddenColumns,
        selectedYear,
        columnOrder,
        columnWidths,
        cellMetadata,
        rowHeights
      }
    };
    setCodeViewContent(JSON.stringify(fullData, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeNode?.id]);

  const handleCodeChange = (val: string) => {
    setCodeViewContent(val);
    try {
      const parsed = JSON.parse(val);
      
      // If user pasted/typed the full document structure
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.content)) {
        if (parsed.display_settings) {
          const ds = parsed.display_settings;
          const master = ds.masterColumnOrder || ds.columnOrder || allHeaders;
          setMasterColumnOrder(master);
          setGridData(dehydrateArrayToMap(parsed.content, ds.columnOrder || allHeaders, master));
          setRowCount(parsed.content.length);
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
        setGridData(dehydrateArrayToMap(parsed, allHeaders, masterColumnOrder));
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

  /**
   * PERFORMANCE OPTIMIZATION: Index-based Virtualization
   * Instead of generating a full array of row objects (O(N*M)), we work with 
   * a flat array of indices. This keeps the JS main thread clear for typing.
   */
  const filteredRowIndices = useMemo(() => {
    const indices = Array.from({ length: rowCount }, (_, i) => i);
    if (!rowFilter) return indices;
    
    const lowerCaseFilter = rowFilter.toLowerCase();
    return indices.filter((i) => {
      return allHeaders.some(h => {
        const colIdx = masterColumnOrder.indexOf(h);
        const coord = colIdx !== -1 ? toA1Key(i, colIdx) : '';
        const val = coord ? gridData.get(coord) : undefined;
        return val !== undefined && String(val).toLowerCase().includes(lowerCaseFilter);
      });
    });
  }, [gridData, rowCount, allHeaders, rowFilter, masterColumnOrder]);

  const sectionBlocks = useMemo(() => {
    const blocks: { name: string, indices: number[] }[] = [];
    filteredRowIndices.forEach(idx => {
      const sectionName = gridData.get(`${idx}:section`) || "";
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.name === sectionName) lastBlock.indices.push(idx);
      else blocks.push({ name: sectionName, indices: [idx] });
    });
    return blocks;
  }, [filteredRowIndices, gridData]);

  // Virtualization: Flatten sections and rows with accurate height offsets
  const { flatItems, itemOffsets, totalVirtualHeight } = useMemo(() => {
    const items: any[] = [];
    const offsets: number[] = [];
    let currentOffset = 0;

    sectionBlocks.forEach((block, blockIdx) => {
      if (block.name !== "") {
        offsets.push(currentOffset);
        items.push({ type: 'section', name: block.name, startIndex: block.indices[0], blockIdx });
        currentOffset += 40; // Synced with row height to prevent scroll drift
      }

      block.indices.forEach(idx => {
        offsets.push(currentOffset);
        items.push({ type: 'row', index: idx });
        currentOffset += (rowHeights[String(idx)] || 40);
      });
    });

    return { 
      flatItems: items, 
      itemOffsets: offsets, 
      totalVirtualHeight: currentOffset + 40 // Optimized buffer for stability without excessive whitespace
    };
  }, [sectionBlocks, rowHeights]);

  const setColumnAlignment = useCallback((header: string, align: 'left' | 'center' | 'right') => {
    setColumnAlignments(prev => ({ ...prev, [header]: align }));
    
    // PERFORMANCE FIX: Clear cell-specific overrides using A1 keys
    const colIdx = masterColumnOrder.indexOf(header);
    setCellAlignments(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        const coords = fromA1Key(key);
        if (coords && coords.colIndex === colIdx) delete next[key];
      });
      return next;
    });
    setContextMenu(null);
  }, [masterColumnOrder, setCellAlignments]);

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

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, row?: number, col: string, type: 'cell' | 'header' | 'row' | 'section', sectionName?: string, showFormats?: boolean, showFormulaFormats?: boolean, showNumberFormats?: boolean, showFonts?: boolean } | null>(null);
  const evaluateFormula = useCallback((value: any, rowData: any, formatId?: string) => {
    if (typeof value !== 'string' || !value.startsWith('=')) return value;
    try {
      const { masterColumnOrder, columnOrder, gridData } = stateRef.current;
      const headers = columnOrder.length > 0 ? columnOrder : ["Title / Item", "Amount", "Location", "Allocation", "Notes"];

      const resolveSingleValue = (arg: string) => {
        // 1. Handle A1 Cell References using shared utility
        const coords = fromA1Key(arg.toUpperCase());
        if (coords) {
          const colName = headers[coords.colIndex];
          const mIdx = masterColumnOrder.indexOf(colName);
          if (mIdx !== -1) return gridData.get(toA1Key(coords.row, mIdx));
          return null;
        }
        // 2. Fallback: Handle Named Columns in Current Row or Literals
        const actualKey = Object.keys(rowData).find(key => key.toLowerCase() === arg.toLowerCase());
        return actualKey ? rowData[actualKey] : (isNaN(Number(arg)) ? arg : Number(arg));
      };

      if (value.toUpperCase().startsWith('=SUM(')) {
        const match = value.match(/=SUM\((.*)\)/i);
        if (!match) return '#ERROR!';
        const args = match[1].split(',').map(s => s.trim());
        
        let total = 0;
        args.forEach(arg => {
          if (arg.includes(':')) {
            const [start, end] = arg.split(':');
            const sC = fromA1Key(start.toUpperCase());
            const eC = fromA1Key(end.toUpperCase());
            if (sC && eC) {
              for (let r = Math.min(sC.row, eC.row); r <= Math.max(sC.row, eC.row); r++) {
                for (let c = Math.min(sC.colIndex, eC.colIndex); c <= Math.max(sC.colIndex, eC.colIndex); c++) {
                  const colName = headers[c];
                  const mIdx = masterColumnOrder.indexOf(colName);
                  const val = mIdx !== -1 ? gridData.get(toA1Key(r, mIdx)) : 0;
                  total += (Number(val) || 0);
                }
              }
            }
          } else {
            total += (Number(resolveSingleValue(arg)) || 0);
          }
        });
        return total;
      }

      if (value.toUpperCase().startsWith('=ADD_DAYS(')) {
        const match = value.match(/=ADD_DAYS\s*\((.*)\)/i);
        if (!match) return '#ERROR!';
        // Handle literal strings in quotes and strip them
        const args = match[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
        if (args.length !== 2) return '#ARGS!';

        let dateVal = resolveSingleValue(args[0]);
        let daysVal = resolveSingleValue(args[1]);

        // Smart Swap: If the order is reversed (e.g., =ADD_DAYS(100, M2)), swap them.
        if (!isNaN(Number(dateVal)) && isNaN(Number(daysVal))) {
          [dateVal, daysVal] = [daysVal, dateVal];
        }

        if (dateVal === null || dateVal === undefined || dateVal === '') return '';

        let date = new Date(dateVal);
        // Robust parsing for YYYY-MM-DD or MM-DD-YYYY strings
        if (isNaN(date.getTime()) && typeof dateVal === 'string' && dateVal.includes('-')) {
          const parts = dateVal.split('-');
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            } else if (parts[2].length === 4) {
              date = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
            }
          }
        }

        const days = Number(daysVal);
        if (isNaN(date.getTime())) return '#DATE!';
        if (isNaN(days)) return '#NUM!';

        const resultDate = new Date(date);
        resultDate.setDate(resultDate.getDate() + days);
        return formatDateDisplay(resultDate, formatId);
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
      setRowHeights(prev => ({ ...prev, [String(current.row)]: newHeight }));
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
    // Optimization: Include is_deleted and deleted_at to support Trash Bin
      const { data, error } = await supabase.from('nodes').select('id, name, type, parent_id, created_at, size_bytes, is_deleted, deleted_at, deleted_by').order('name');
    
    if (error) {
      console.error('Error fetching files:', error.message);
    } else if (data) {
      setTree(buildTree(data.filter((n: any) => !n.is_deleted) as FileNode[]));
        // Sort deleted nodes by date descending so the most recently deleted items appear first
        setDeletedNodes(data.filter((n: any) => n.is_deleted).sort((a: any, b: any) => new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime()) as TrashNode[]);
    }
    setIsLoading(false);
  }, []);

  const addItem = async (type: 'file' | 'folder', parentId: string | null = null) => {
    const name = window.prompt(`Enter ${type} name:`);
    if (!name) return;

    const { data, error } = await supabase.from('nodes').insert([{ name, type, parent_id: parentId }]).select().single();
    if (error) {
      alert(`Failed to create ${type}: ${error.message}`);
      return;
    }
    
    if (data) await logAction(type === 'file' ? 'FILE_CREATED' : 'FOLDER_CREATED', data.id, { name });
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
    await logAction('RENAMED', id, { old_name: node?.name, new_name: name });
    fetchFiles();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Move this item to Trash?')) return;
    const { error } = await supabase.from('nodes').update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user.email }).eq('id', id);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }
    await logAction('MOVED_TO_TRASH', id, { name: findNodeById(tree, id)?.name });
    if (selectedId === id) setSelectedId(null);
    fetchFiles();
  };

  const handleRestore = async (id: string) => {
    const { error } = await supabase.from('nodes').update({ is_deleted: false, deleted_at: null, deleted_by: null }).eq('id', id);
    if (error) {
      alert(`Failed to restore: ${error.message}`);
      return;
    }
    await logAction('RESTORED', id);
    fetchFiles();
  };

  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm('Permanently delete this item? This cannot be undone.')) return;
    const { error } = await supabase.from('nodes').delete().eq('id', id);
    if (!error) fetchFiles();
  };


  /**
   * Renames only a specific contiguous block of rows.
   * This prevents split sections from being merged back together accidentally.
   */
  const handleRenameSectionBlock = useCallback((startIndex: number, oldName: string, newName: string) => {
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
  }, [rowCount, saveStateToHistory]);

  const handleAddSection = () => {
    const sectionName = window.prompt("Enter new section name:");
    if (!sectionName) return;
    saveStateToHistory();
    const newIdx = rowCount;
    setGridData(prev => {
      const next = new Map(prev);
      next.set(`${newIdx}:section`, sectionName);
      return next;
    });
    setRowCount(prev => prev + 1);
  };

  const handleInsertSection = useCallback((relativeSectionName: string, position: 'before' | 'after', specificIndex?: number) => {
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

    const sectionName = window.prompt(`Enter new section name to insert at row ${insertionIndex + 1}:`);
    if (!sectionName) return;

    const shiftMetadata = (prev: Record<string, any>) => {
      const next: Record<string, any> = {};
      
      const transform = (k: string) => {
        const c = fromA1Key(k);
        if (!c) return k.includes(':section') ? { r: parseInt(k.split(':')[0]), ci: -1, isS: true } : null;
        return { r: c.row, ci: c.colIndex, isS: false };
      };

      Object.keys(prev).forEach(key => {
        if (key.startsWith('header:')) { next[key] = prev[key]; return; }
        const info = transform(key) as { r: number, ci: number, isS: boolean } | null;
        if (!info) { next[key] = prev[key]; return; }

        const { r, ci, isS } = info;
        const nk = (r < insertionIndex) ? key : (isS ? `${r + 1}:section` : toA1Key(r + 1, ci));
        
        const val = { ...prev[key] };
        if (val.mergedIn) {
          const h = transform(val.mergedIn) as { r: number, ci: number, isS: boolean } | null;
          if (h && !h.isS && h.r >= insertionIndex) val.mergedIn = toA1Key(h.r + 1, h.ci);
        }
        next[nk] = val;
      });
      return next;
    };

    setCellMetadata(shiftMetadata);
    setCellAlignments(shiftMetadata);
    setRowHeights(prev => {
        const next: Record<string, number> = {};
      Object.keys(prev).forEach(k => {
        const r = parseInt(k);
          if (r < insertionIndex) next[k] = prev[k];
          else next[String(r + 1)] = prev[k];
      });
      return next;
    });

    // 3. Update data Map: Shift everything and perform the "Split"
    setGridData(prev => {
      const next = new Map();
      // Shift existing rows
      prev.forEach((val, key) => {
        const coords = fromA1Key(key) || (key.includes(':section') ? { row: parseInt(key.split(':')[0]), colIndex: -1 } : null);
        if (!coords) { next.set(key, val); return; }

        const { row: r, colIndex } = coords;
        const isSectionKey = key.includes(':section');

        if (r < insertionIndex) {
          next.set(key, val);
        } else {
          // Rows being pushed down
          const newIdx = r + 1;
          
          next.set(isSectionKey ? `${newIdx}:section` : toA1Key(newIdx, colIndex), val);
        }
      });
      
      // Insert the new header row
      next.set(`${insertionIndex}:section`, sectionName);
      return next;
    });
    setRowCount(prev => prev + 1);
  }, [rowCount, gridData, masterColumnOrder, allHeaders, saveStateToHistory]);

  const handleDeleteSection = useCallback((sectionName: string) => {
    if (!window.confirm(`Are you sure you want to remove the section header "${sectionName}"? The rows belonging to this section will be kept in the grid.`)) return;
    saveStateToHistory();
    
    setGridData(prev => {
      const next = new Map(prev);
      const currentCount = stateRef.current.rowCount;
      for (let r = 0; r < currentCount; r++) {
        if (next.get(`${r}:section`) === sectionName) next.delete(`${r}:section`);
      }
      return next;
    });
    setContextMenu(null);
  }, [saveStateToHistory]);

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
        ...Array.from({ length: rowCount }).map((_, r) => {
          return headers.map(h => {
            const colIdx = masterColumnOrder.indexOf(h);
            const val = colIdx !== -1 ? gridData.get(toA1Key(r, colIdx)) : '';
            return `"${String(val || '').replace(/"/g, '""')}"`;
          }).join(',');
        })
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
    const navKeys = ['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (navKeys.includes(e.key)) {
      // If we are in a textarea, only navigate with arrows if at bounds or using Ctrl
      const isTextArea = (e.target as HTMLElement).tagName === 'TEXTAREA';
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
      } else if (e.key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1);
      else if (e.key === 'ArrowDown') nextRow = Math.min(rowCount - 1, rowIndex + 1);
      else if (e.key === 'ArrowLeft') nextColIdx = Math.max(0, colIndex - 1);
      else if (e.key === 'ArrowRight') nextColIdx = Math.min(headers.length - 1, colIndex + 1);

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
  }, [rowCount, setActiveCell]);

  const setCellFontFamily = useCallback((row: number, col: string, fontFamily: string) => {
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
              const mIdx = masterColumnOrder.indexOf(visibleHeaders[c]);
              const key = r === -1 ? `header:${visibleHeaders[c]}` : toA1Key(r, mIdx);
              next[key] = { ...next[key], fontFamily };
            }
          }
        } else {
          const mIdx = masterColumnOrder.indexOf(col);
          const key = row === -1 ? `header:${col}` : toA1Key(row, mIdx);
          next[key] = { ...next[key], fontFamily };
        }
      return next;
    });
    setContextMenu(null);
  }, [allHeaders, hiddenColumns, selection, masterColumnOrder]);

  const toggleCellAlignment = useCallback((rowIndex: number, header: string) => {
    setCellAlignments(prev => {
      const next = { ...prev };
      // Determine next alignment based on the specific clicked cell
      const targetKey = toA1Key(rowIndex, masterColumnOrder.indexOf(header));
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
              const mIdx = masterColumnOrder.indexOf(visibleHeaders[c]);
              const key = r === -1 ? `header:${visibleHeaders[c]}` : toA1Key(r, mIdx);
              next[key] = nextAlign;
            }
          }
        } else {
          next[targetKey] = nextAlign;
        }
      return next;
    });
  }, [columnAlignments, selection, visibleHeaders, masterColumnOrder, setCellAlignments]);

  const setSelectionAlignment = useCallback((align: 'left' | 'center' | 'right') => {
    if (!selection) return;
    saveStateToHistory();
    setCellAlignments(prev => {
      const next = { ...prev };
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const startColIdx = visibleHeaders.indexOf(selection.startCol);
      const endColIdx = visibleHeaders.indexOf(selection.endCol);
      const minColIdx = Math.min(startColIdx, endColIdx);
      const maxColIdx = Math.max(startColIdx, endColIdx);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minColIdx; c <= maxColIdx; c++) {
          const header = visibleHeaders[c];
          const mIdx = masterColumnOrder.indexOf(header);
          if (mIdx !== -1) {
            const key = r === -1 ? `header:${header}` : toA1Key(r, mIdx);
            next[key] = align;
          }
        }
      }
      return next;
    });
    setContextMenu(null);
  }, [selection, visibleHeaders, masterColumnOrder, saveStateToHistory]);

  const toggleColumnVisibility = (key: string) => {
    setHiddenColumns(prev => 
      prev.includes(key) ? prev.filter(col => col !== key) : [...prev, key]
    );
    setSelection(null);
  };

  const handleRenameColumn = useCallback((oldKey: string, newKey: string) => {
    const trimmedNewKey = newKey?.trim();

    // Fix: If the column is already an "Untitled" column and we are blurring with an empty value, 
    // do not trigger a rename. This prevents selection breakage for blank headers.
    if (oldKey === trimmedNewKey || (oldKey.startsWith('_UNTITLED_') && !trimmedNewKey)) return;

    let finalNewKey = trimmedNewKey;
    // If the name was cleared, assign a unique internal name to maintain "blank" appearance
    if (!finalNewKey) {
      let i = 1;
      // Use current allHeaders to check availability, but don't count the one we are renaming
      const otherHeaders = allHeaders.filter(h => h !== oldKey);
      while (otherHeaders.includes(`_UNTITLED_${i}`)) i++;
      finalNewKey = `_UNTITLED_${i}`;
    }

    saveStateToHistory();
    if (finalNewKey.toLowerCase() === 'section') {
      alert("'section' is a reserved column name used for categorization.");
      return;
    }

    if (allHeaders.includes(finalNewKey)) {
      alert(`A column named "${finalNewKey}" already exists.`);
      return;
    }

      // A1 keys are index-based and stable. Renaming doesn't move data in the Map.
      setColumnOrder(prev => {
        const currentOrder = prev.length > 0 ? prev : allHeaders;
        return currentOrder.map(col => col === oldKey ? finalNewKey : col);
      });
      setMasterColumnOrder(prev => prev.map(col => col === oldKey ? finalNewKey : col));

      // Migrate alignments and header metadata to the new column name
      setColumnAlignments(prev => {
        const next = { ...prev };
        if (next[oldKey]) {
          next[finalNewKey] = next[oldKey];
          delete next[oldKey];
        }
        return next;
      });
      setColumnWidths(prev => {
        const next = { ...prev };
        if (next[oldKey]) {
          next[finalNewKey] = next[oldKey];
          delete next[oldKey];
        }
        return next;
      });
      const migrateKeys = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        Object.keys(prev).forEach(key => {
          if (key === `header:${oldKey}`) {
            next[`header:${finalNewKey}`] = prev[key];
          } else {
            // A1 keys and row-based keys (like :section) are stable; they don't depend on column names
            next[key] = prev[key];
          }
        });
        return next;
      };
      setCellMetadata(migrateKeys);
      setCellAlignments(migrateKeys);

      // Sync selection and active cell state with the new column name to prevent UI "ghosting" or merge failure
      setSelection(prev => {
        if (!prev) return null;
        const next = { ...prev };
        if (next.startCol === oldKey) next.startCol = finalNewKey;
        if (next.endCol === oldKey) next.endCol = finalNewKey;
        return next;
      });
      setActiveCell(prev => prev && prev.col === oldKey ? { ...prev, col: finalNewKey } : prev);
  }, [allHeaders, saveStateToHistory]);

  const handleAddColumn = useCallback((name?: string) => {
    saveStateToHistory();
    let colName = typeof name === 'string' ? name.trim() : '';

    if (!colName) {
      let i = 1;
      while (allHeaders.includes(`_UNTITLED_${i}`)) i++;
      colName = `_UNTITLED_${i}`;
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
      const currentOrder = prev.length > 0 ? prev : [...allHeaders];
      return [...currentOrder, colName];
    });

    // CRITICAL: New columns must be added to the master order to allow data entry (A1 key generation)
    setMasterColumnOrder(prev => [...prev, colName]);
  }, [allHeaders, saveStateToHistory]);

  const handleDeleteColumn = useCallback((keyToDelete: string) => {
    if (!window.confirm(`Are you sure you want to delete the column "${keyToDelete}"?`)) return;
    saveStateToHistory();
    
    const colIdx = masterColumnOrder.indexOf(keyToDelete);
    if (colIdx === -1) return;

    const oldOrder = [...masterColumnOrder];
    const newOrder = masterColumnOrder.filter(col => col !== keyToDelete);

    // CRITICAL: Re-key everything because shifting the masterColumnOrder changes all A1 indices
    setGridData(prev => rekeySparseMap(prev, oldOrder, newOrder));
    setCellMetadata(prev => rekeyMetadataRecord(prev, oldOrder, newOrder));
    setCellAlignments(prev => rekeyMetadataRecord(prev, oldOrder, newOrder));

    setMasterColumnOrder(newOrder);
    setColumnOrder(prev => prev.filter(col => col !== keyToDelete));
    setSelection(null);
    
      // Cleanup metadata and alignments for the deleted column
      setColumnAlignments(prev => { const n = { ...prev }; delete n[keyToDelete]; return n; });
      setColumnWidths(prev => { const n = { ...prev }; delete n[keyToDelete]; return n; });
  }, [rowCount, masterColumnOrder, saveStateToHistory]);

  const handleInsertColumn = useCallback((relativeCol: string, position: 'before' | 'after') => {
    saveStateToHistory();

    let i = 1;
    while (allHeaders.includes(`_UNTITLED_${i}`)) i++;
    const colName = `_UNTITLED_${i}`;

      if (colName.toLowerCase() === 'section') {
        alert("'section' is a reserved column name used for categorization.");
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
      
      // New columns must be registered in the master order to enable coordinate mapping
      setMasterColumnOrder(prev => [...prev, colName]);
  }, [allHeaders, saveStateToHistory]);

  const addTableRow = useCallback(() => {
    saveStateToHistory();
    setRowCount(prev => prev + 1);
  }, [saveStateToHistory]);

  const addRowToSection = useCallback((sectionName: string) => {
    saveStateToHistory();
    const newIdx = rowCount;
    setGridData(prev => {
      const next = new Map(prev);
      next.set(`${newIdx}:section`, sectionName);
      return next;
    });
    setRowCount(prev => prev + 1);
  }, [rowCount, masterColumnOrder, saveStateToHistory]);

  const handleInsertRow = useCallback((index: number, position: 'above' | 'after') => {
      saveStateToHistory();
      const section = gridData.get(`${index}:section`) || "";
      const insertIndex = position === 'above' ? index : index + 1;

      const shiftMetadata = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        const transform = (k: string) => {
          const c = fromA1Key(k);
          if (!c) return k.includes(':section') ? { r: parseInt(k.split(':')[0]), ci: -1, isS: true } : null;
          return { r: c.row, ci: c.colIndex, isS: false };
        };

        Object.keys(prev).forEach(key => {
          if (key.startsWith('header:')) { next[key] = prev[key]; return; }
          const info = transform(key) as { r: number, ci: number, isS: boolean } | null;
          if (!info) { next[key] = prev[key]; return; }

          const { r, ci, isS } = info;
          const nk = (r < insertIndex) ? key : (isS ? `${r + 1}:section` : toA1Key(r + 1, ci));
          
          const val = { ...prev[key] };
          if (val.mergedIn) {
            const h = transform(val.mergedIn) as { r: number, ci: number, isS: boolean } | null;
            if (h && !h.isS && h.r >= insertIndex) val.mergedIn = toA1Key(h.r + 1, h.ci);
          }
          next[nk] = val;
        });
        return next;
      };
      setCellMetadata(shiftMetadata);
      setCellAlignments(shiftMetadata);
      setRowHeights(prev => {
        const next: Record<string, number> = {};
        Object.keys(prev).forEach(k => {
          const r = parseInt(k);
          if (r < insertIndex) next[k] = prev[k];
          else next[String(r + 1)] = prev[k];
        });
        return next;
      });
      
      setGridData(prev => {
        const next = new Map();
        prev.forEach((val, key) => {
          const coords = fromA1Key(key) || (key.includes(':section') ? { row: parseInt(key.split(':')[0]), colIndex: -1 } : null) as { row: number, colIndex: number } | null;
          if (!coords) { next.set(key, val); return; }
          
          const { row, colIndex } = coords;
          const isSection = key.includes(':section');

          if (row < insertIndex) next.set(key, val);
          else next.set(isSection ? `${row + 1}:section` : toA1Key(row + 1, colIndex), val);
        });
        next.set(`${insertIndex}:section`, section);
        return next;
      });
      setRowCount(prev => prev + 1);
      setContextMenu(null);
  }, [gridData, masterColumnOrder, saveStateToHistory]);

  const handleClearRow = useCallback((index: number) => {
    if (!window.confirm("Clear all data in this row?")) return;
    saveStateToHistory();
    
      setGridData(prev => {
        const next = new Map(prev);
        allHeaders.forEach(h => {
          const colIdx = masterColumnOrder.indexOf(h);
          if (colIdx !== -1) next.delete(toA1Key(index, colIdx));
        });
        next.set(`${index}:section`, prev.get(`${index}:section`));
        return next;
      });

      const clearRowMeta = (prev: Record<string, any>) => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          const coords = fromA1Key(key);
          if (coords && coords.row === index) delete next[key];
        });
        return next;
      };
      
      setCellMetadata(clearRowMeta);
      setCellAlignments(clearRowMeta);
      setContextMenu(null);
  }, [allHeaders, masterColumnOrder, saveStateToHistory]);

  const handleClearColumn = useCallback((colName: string) => {
    if (!window.confirm(`Clear all data and formatting in column "${colName}"?`)) return;
    saveStateToHistory();

    setGridData(prev => {
      const next = new Map(prev);
      const colIdx = masterColumnOrder.indexOf(colName);
      if (colIdx !== -1) {
        for (let r = 0; r < rowCount; r++) next.delete(toA1Key(r, colIdx));
      }
      return next;
    });

      const clearColMeta = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        const targetColIdx = masterColumnOrder.indexOf(colName);
        Object.keys(prev).forEach(key => {
          if (key.startsWith('header:')) { next[key] = prev[key]; return; }
          
          const coords = fromA1Key(key);
          if (coords && coords.colIndex === targetColIdx) return; // Skip (clear) this column
          next[key] = prev[key];
        });
        return next;
      };
      
      setCellMetadata(clearColMeta);
      setCellAlignments(clearColMeta);
      setContextMenu(null);
  }, [masterColumnOrder, rowCount, saveStateToHistory]);

  const handleResetWidths = () => {
    if (window.confirm('Reset all column widths? This will allow columns to auto-fit based on their content.')) {
      setColumnWidths({});
    }
  };

  const setCellType = useCallback((row: number, col: string, type: string, format: string = 'long') => {
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
            const minR = Math.min(selection.startRow, selection.endRow);
            const maxR = Math.max(selection.startRow, selection.endRow);
            const startColIdx = visibleHeaders.indexOf(selection.startCol);
            const endColIdx = visibleHeaders.indexOf(selection.endCol);
            const minColIdx = Math.min(startColIdx, endColIdx);
            const maxColIdx = Math.max(startColIdx, endColIdx);

            for (let r = minR; r <= maxR; r++) {
              for (let c = minColIdx; c <= maxColIdx; c++) {
                const colIdxInMaster = masterColumnOrder.indexOf(visibleHeaders[c]);
                const k = toA1Key(r, colIdxInMaster);
                next[k] = { ...prev[k], type, format };
              }
            }
          } else {
            next[toA1Key(row, masterColumnOrder.indexOf(col))] = { ...prev[toA1Key(row, masterColumnOrder.indexOf(col))], type, format };
          }
        return next;
      })()
    }));
    setContextMenu(null);
  }, [allHeaders, hiddenColumns, selection, masterColumnOrder, saveStateToHistory]);

  const insertMedia = useCallback((row: number, col: string, mediaType: 'image' | 'file') => {
    setPendingMedia({ row, col, type: mediaType });
    setContextMenu(null);
    // Use timeout to ensure state update doesn't interfere with the click event
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingMedia || !activeNode) return;

    const { row: r, col, type } = pendingMedia;
    const key = toA1Key(r, masterColumnOrder.indexOf(col));
    
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

  const removeCellMetadata = useCallback((row: number, col: string) => {
     if (!window.confirm("Are you sure you want to remove all attachments and formatting from this cell?")) return;
    const key = toA1Key(row, masterColumnOrder.indexOf(col));

    setCellMetadata(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setContextMenu(null);
  }, [cellMetadata, masterColumnOrder]);

  const deleteAttachment = useCallback((row: number, col: string, index: number) => {
    if (!window.confirm("Are you sure you want to remove this attachment?")) return;
    const key = toA1Key(row, masterColumnOrder.indexOf(col));

    const existing = cellMetadata[key];
    if (!existing || !existing.attachments) return;

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
  }, [cellMetadata, masterColumnOrder]);

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

  const renderTrashBin = () => {
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

  const renderAuditLogs = () => {
    if (isLoadingLogs) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <Loader2 className="animate-spin text-accent mb-4" size={32} />
          <p className="text-sm text-muted font-medium animate-pulse uppercase tracking-widest">Loading audit history...</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden shadow-sm">
        <div className="p-3 bg-muted/5 border-b border-border flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted">System Audit Trail</h3>
          <button onClick={fetchAuditLogs} className="p-1.5 text-muted hover:text-accent transition-colors" title="Refresh Logs">
            <RefreshCcw size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 bg-muted/10 z-10 shadow-sm">
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
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted italic text-sm">No activity logs found.</td>
                </tr>
              ) : (
                auditLogs.map((log) => (
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
                        'bg-muted/20 text-muted'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-bold text-foreground">
                      {log.nodes?.name || <span className="text-muted/30 italic font-normal">N/A</span>}
                    </td>
                    <td className="p-3 text-[11px] text-muted font-mono whitespace-pre-wrap">
                      {JSON.stringify(log.details, null, 1)}
                      {(() => {
                        const { user_email, ...rest } = log.details || {};
                        return Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 1) : '-';
                      })()}
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

  const handleMergeCells = useCallback((visibleHeaders: string[], isHeaderMerge: boolean = false) => {
    if (!selection) return;
    saveStateToHistory();
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
    const hostMasterIdx = masterColumnOrder.indexOf(hostCol);
    const hostKey = isHeaderSelection ? `header:${hostCol}` : toA1Key(minRow, hostMasterIdx);
    const newMetadata = { ...cellMetadata };

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minColIdx; c <= maxColIdx; c++) {
        const mIdx = masterColumnOrder.indexOf(visibleHeaders[c]);
        const key = isHeaderSelection ? `header:${visibleHeaders[c]}` : toA1Key(r, mIdx);
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
        const mIdx = masterColumnOrder.indexOf(visibleHeaders[c]);
        const currentKey = isHeaderSelection ? `header:${visibleHeaders[c]}` : toA1Key(r, mIdx);
        if (currentKey !== hostKey) {
          newMetadata[currentKey] = { ...newMetadata[currentKey], mergedIn: hostKey };
        }
      }
    }
    setCellMetadata(newMetadata);
    setSelection(null);
  }, [selection, cellMetadata, masterColumnOrder]);

  const handleUnmergeCells = useCallback((row: number, col: string, visibleHeaders: string[]) => {
    const isHeader = row === -1;
    const key = isHeader ? `header:${col}` : toA1Key(row, masterColumnOrder.indexOf(col));
    const meta = cellMetadata[key];
    if (!meta || (!meta.rowSpan && !meta.colSpan)) return;

    const newMetadata = { ...cellMetadata };
    const { rowSpan = 1, colSpan = 1 } = meta;
    const colIdx = visibleHeaders.indexOf(col);
    
    const startR = isHeader ? -1 : row;
    const endR = isHeader ? -1 : row + rowSpan - 1;

    for (let r = startR; r <= endR; r++) {
      for (let c = colIdx; c < colIdx + colSpan; c++) {
        const mIdx = masterColumnOrder.indexOf(visibleHeaders[c]);
        const currentKey = isHeader ? `header:${visibleHeaders[c]}` : toA1Key(r, mIdx);
        const m = { ...newMetadata[currentKey] };
        delete m.rowSpan; delete m.colSpan; delete m.mergedIn;
        if (Object.keys(m).length === 0) delete newMetadata[currentKey];
        else newMetadata[currentKey] = m;
      }
    }
    setCellMetadata(newMetadata);
  }, [cellMetadata, masterColumnOrder]);


  const applyDragFill = useCallback((range: { startRow: number; endRow: number; col: string }) => {
    const { startRow, endRow, col } = range;
    const { gridData, cellMetadata, masterColumnOrder } = stateRef.current;
    
    saveStateToHistory();
    if (startRow === endRow) return;

    const colIdx = masterColumnOrder.indexOf(col);
    if (colIdx === -1) return;
    
    const sourceValue = gridData.get(toA1Key(startRow, colIdx));
    const sourceMeta = cellMetadata[toA1Key(startRow, colIdx)];

    const newMetadata = { ...cellMetadata };
    const nextMap = new Map(gridData);

      const min = Math.min(startRow, endRow);
      const max = Math.max(startRow, endRow);

      for (let i = min; i <= max; i++) {
        if (i === startRow) continue;
        const rowOffset = i - startRow;
        
        const valueToApply = shiftFormula(sourceValue, rowOffset);
        if (valueToApply !== undefined) nextMap.set(toA1Key(i, colIdx), valueToApply);

        const targetKey = toA1Key(i, colIdx);
        if (sourceMeta) {
          newMetadata[targetKey] = { ...sourceMeta };
        } else {
          delete newMetadata[targetKey];
        }
      }

      setGridData(nextMap);
    setCellMetadata(newMetadata);
  }, [saveStateToHistory]);

  const handleDragFillStart = useCallback((e: React.MouseEvent, row: number, col: string) => {
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
  }, [applyDragFill]);

  const removeTableRow = useCallback((index: number) => {
    if (!window.confirm("Are you sure you want to delete this row?")) return;
    saveStateToHistory();

    try {
      setGridData(prev => {
        const next = new Map();
        prev.forEach((val, key) => {
          const coords = fromA1Key(key) || (key.includes(':section') ? { row: parseInt(key.split(':')[0]), colIndex: -1 } : null);
          if (!coords) { next.set(key, val); return; }
          
          const { row, colIndex } = coords;
          const isSection = key.includes(':section');
          
          if (row < index) next.set(key, val);
          else if (row > index) next.set(isSection ? `${row - 1}:section` : toA1Key(row - 1, colIndex), val);
        });
        return next;
      });
      setRowCount(prev => prev - 1);

      // Shift metadata and alignments for all rows following the deleted one
      const shiftMetadata = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        const transform = (k: string) => {
          const c = fromA1Key(k);
          if (!c) return k.includes(':section') ? { r: parseInt(k.split(':')[0]), ci: -1, isS: true } : null;
          return { r: c.row, ci: c.colIndex, isS: false };
        };

        Object.keys(prev).forEach(key => {
          if (key.startsWith('header:')) { next[key] = prev[key]; return; }
          const info = transform(key) as { r: number, ci: number, isS: boolean } | null;
          if (!info) { next[key] = prev[key]; return; }

          const { r, ci, isS } = info;
          if (r < index) next[key] = prev[key];
          else if (r > index) {
            const nk = isS ? `${r - 1}:section` : toA1Key(r - 1, ci);
            const val = { ...prev[key] };
            if (val.mergedIn) {
              const h = transform(val.mergedIn) as { r: number, ci: number, isS: boolean } | null;
              if (h && !h.isS && h.r > index) val.mergedIn = toA1Key(h.r - 1, h.ci);
            }
            next[nk] = val;
          }
        });
        return next;
      };
      setCellMetadata(shiftMetadata);
      setCellAlignments(shiftMetadata);
      setRowHeights(prev => {
        const next: Record<string, number> = {};
        Object.keys(prev).forEach(k => {
          const r = parseInt(k);
          if (r < index) next[k] = prev[k];
          else if (r > index) next[String(r - 1)] = prev[k];
        });
        return next;
      });
    } catch (e) {
      console.error("Failed to remove row");
    }
   }, [cellMetadata, masterColumnOrder, allHeaders, rowCount, saveStateToHistory]);


  useEffect(() => {
    const loadFileContent = async () => {
      if (!selectedId) {
        setGridData(new Map());
        setRowCount(0);
        setUndoStack([]);
        setRedoStack([]);
        setMasterColumnOrder([]);
        setColumnAlignments({});
        setCellAlignments({});
        setColumnOrder([]);
        setHiddenColumns([]);
        setCellMetadata({});
        setRowHeights({});
        setActiveCell(null);
        setSelectedYear('2020');
        setRowFilter('');
        return;
      }

      setIsLoadingFile(true);
      // Lazy Load: Fetch content and settings only for the selected file
      const { data, error } = await supabase
        .from('nodes')
        .select('content, display_settings')
        .eq('id', selectedId)
        .single();

      if (!error && data) {
        setUndoStack([]);
        setRedoStack([]);
        const content = Array.isArray(data.content) ? data.content : [];
        const ds = data.display_settings || {};
        
        const currentHeaders = ds.columnOrder?.length ? ds.columnOrder : ["Title / Item", "Amount", "Location", "Allocation", "Notes"];
        const master = ds.masterColumnOrder || currentHeaders;
        
        setMasterColumnOrder(master);
        setGridData(dehydrateArrayToMap(content, currentHeaders, master));
        setRowCount(content.length);
        
        setColumnAlignments(ds.columnAlignments || {});
        setCellAlignments(ds.cellAlignments || {});
        setColumnOrder(ds.columnOrder || []);
        setHiddenColumns(ds.hiddenColumns || []);
        setColumnWidths(ds.columnWidths || {});
        setCellMetadata(ds.cellMetadata || {});
        setRowHeights(ds.rowHeights || {});
        setSelectedYear(ds.selectedYear || '2020');
        setActiveCell(null);
        setRowFilter('');
        setScrollTop(0);
        tableContainerRef.current?.scrollTo({ top: 0 });
      }
      setIsLoadingFile(false);
    };

    loadFileContent();
  }, [selectedId]);

  const handleSave = async () => {
    if (!activeNode || activeNode.type !== 'file') return;
    
    setIsSaving(true);
    try {
      // Performance: Pre-map master column indices for O(1) lookup during normalization
      const colMap = new Map(masterColumnOrder.map((name, i) => [name, i]));

      const normalizeKeys = (metaRecord: Record<string, any>) => {
        const next: Record<string, any> = {};
        Object.keys(metaRecord).forEach(key => {
          if (key.includes(':') && !key.startsWith('header:') && !key.includes(':section')) {
            const parts = key.split(':');
            if (parts.length === 2) {
              const rowIdx = parseInt(parts[0], 10);
              const mIdx = colMap.get(parts[1]);
              if (mIdx !== undefined) {
                const newA1Key = toA1Key(rowIdx, mIdx);
                next[newA1Key] = metaRecord[key];
                return;
              }
            }
          }
          next[key] = metaRecord[key];
        });
        return next;
      };

      const contentArray = hydrateMapToArray(gridData, rowCount, allHeaders, masterColumnOrder);
      const display_settings = { columnAlignments, cellAlignments: normalizeKeys(cellAlignments), hiddenColumns, selectedYear, columnOrder, columnWidths, cellMetadata: normalizeKeys(cellMetadata), rowHeights, masterColumnOrder };
      
      const { error } = await supabase.from('nodes').update({ content: contentArray, display_settings }).eq('id', activeNode.id);
      if (error) throw error;
      await logAction('CONTENT_UPDATED', activeNode.id);
      await fetchFiles();
    } finally {
      setIsSaving(false);
    }
  };

  const initializeExcelTemplate = () => {
    const master = ["Title / Item", "Amount", "Location", "Allocation", "Notes"];
    setMasterColumnOrder(master);
    setColumnOrder(master);

    const next = new Map();
    [0, 1, 2].forEach(r => {
      next.set(toA1Key(r, 0), String.fromCharCode(97 + r) + "."); // a., b., c.
      next.set(toA1Key(r, 1), 0);
      next.set(`${r}:section`, "Work A");
    });
    next.set(toA1Key(3, 0), "a.");
    next.set(toA1Key(3, 1), 0);
    next.set("3:section", "Work B");
    
    setGridData(next);
    setRowCount(4);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUpdatingProfile(true);
    try {
      // 1. Capture the current avatar URL to check if it needs deletion from storage
      const oldAvatarUrl = profileAvatar;
      const isSupabaseUrl = oldAvatarUrl?.includes('/storage/v1/object/public/attachments/avatars/');

      // Use a distinct path for avatars within the 'attachments' bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      setProfileAvatar(publicUrl);

      // 2. If the new upload was successful, delete the old image from storage
      if (isSupabaseUrl) {
        const oldPath = oldAvatarUrl.split('/attachments/')[1];
        if (oldPath) await supabase.storage.from('attachments').remove([oldPath]);
      }
    } catch (err: any) {
      alert('Error uploading avatar: ' + err.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdateProfile = async () => {
    setIsUpdatingProfile(true);
    try {
      const updateData: any = {
        data: { full_name: profileName, avatar_url: profileAvatar }
      };
      
      if (profileEmail !== user?.email) updateData.email = profileEmail;
      if (profilePassword && profilePassword.length >= 6) updateData.password = profilePassword;

      const { error } = await supabase.auth.updateUser(updateData);
      if (error) throw error;

      if (profileEmail !== user?.email) {
        alert("Profile updated. A confirmation link has been sent to your new email address.");
      }
      setShowProfileModal(false);
      setProfilePassword('');
    } catch (err: any) {
      alert(err.message);
    }
    setIsUpdatingProfile(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderTableEditor = () => {
    try {
      if (isLoadingFile) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-12">
            <Loader2 className="animate-spin text-accent mb-4" size={32} />
            <p className="text-sm text-muted font-medium animate-pulse uppercase tracking-widest">Loading project data...</p>
          </div>
        );
      }

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
      const selMinColIdx = (selection && selStartColIdx !== -1 && selEndColIdx !== -1) ? Math.min(selStartColIdx, selEndColIdx) : -1;
      const selMaxColIdx = (selection && selStartColIdx !== -1 && selEndColIdx !== -1) ? Math.max(selStartColIdx, selEndColIdx) : -1;
      const selMinRow = selection ? Math.min(selection.startRow, selection.endRow) : -2;
      const selMaxRow = selection ? Math.max(selection.startRow, selection.endRow) : -2;
      const selColSpan = (selMinColIdx !== -1 && selMaxColIdx !== -1) ? (selMaxColIdx - selMinColIdx + 1) : 0;

      // Helper to check if a header column is part of the current column-wise selection
      const isHeaderInSelection = (idx: number) => {
        if (!selection || selMinColIdx === -1) return false;
        // Selection is valid for headers if it covers the header row (-1) or essentially all rows
        const isRowSelectionMatching = (selMinRow <= -1 && selMaxRow >= -1) || (selMinRow === 0 && selMaxRow >= rowCount - 1);
        return isRowSelectionMatching && idx >= selMinColIdx && idx <= selMaxColIdx;
      };

      const isSectionInSelection = (startIndex: number) => {
        return selection && startIndex >= selMinRow && startIndex <= selMaxRow;
      };

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

      // Buffer (Overscan): Fixed buffers prevent "jumping" caused by dynamic index shifts.
      // We use a generous overscan to handle fast scrolling without layout thrashing.
      const overscanTop = 30;
      const overscanBottom = 40; 
      
      const startIndex = Math.max(0, startIdx - overscanTop);
      const visibleRowEstimate = Math.ceil(containerHeight / (DEFAULT_ROW_HEIGHT * zoom));
      const endIndex = Math.min(flatItems.length, startIdx + visibleRowEstimate + overscanBottom);
      
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
                  value={(() => {
                    if (!activeCell) return "";
                    const mIdx = masterColumnOrder.indexOf(activeCell.col);
                    const key = toA1Key(activeCell.row, mIdx);
                    return cellMetadata[key]?.fontFamily || "";
                  })()} 
                  onChange={(e) => activeCell && setCellFontFamily(activeCell.row, activeCell.col, e.target.value)} 
                  className="bg-transparent border-0 font-bold text-accent focus:ring-0 cursor-pointer max-w-30 dark:bg-card"
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
                  className="bg-transparent border-0 font-bold text-accent focus:ring-0 cursor-pointer max-w-27.5 dark:bg-card"
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
              <div className="flex items-center gap-1 px-1 py-1.5 bg-card border border-border rounded text-xs font-medium shrink-0">
                <button 
                  onClick={() => setIsFreezeHeaders(!isFreezeHeaders)} 
                  className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${isFreezeHeaders ? 'bg-accent/10 text-accent font-bold' : 'text-muted hover:bg-muted/10'}`}
                  title="Toggle Freeze Headers (Vertical)"
                >
                  <ChevronDown size={14} className={isFreezeHeaders ? "" : "rotate-180"} /> Headers
                </button>
                <button 
                  onClick={() => setIsFreezePanes(!isFreezePanes)} 
                  className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${isFreezePanes ? 'bg-accent/10 text-accent font-bold' : 'text-muted hover:bg-muted/10'}`}
                  title="Toggle Freeze Panes (Horizontal)"
                >
                  <ChevronRightIcon size={14} /> Panes
                </button>
              </div>
            <button onClick={handleAddSection} className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded text-xs font-medium hover:bg-muted/10 shadow-sm text-foreground">
                <Plus size={14} className="text-green-600" /> Add Section
              </button>
            <button onClick={handleResetWidths} className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded text-xs font-medium hover:bg-muted/10 shadow-sm text-foreground" title="Reset all columns to auto-width">
                <RefreshCcw size={14} /> Reset Widths
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
            <button onClick={exportToCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded text-xs font-medium hover:bg-muted/10 shadow-sm text-foreground">
                <HardDrive size={14} /> Export CSV
              </button>
            </div>
          </div>
          
          {/* Cell Context Menu */}
          {contextMenu && (
            <div 
              className="fixed z-100 bg-card border border-border shadow-xl rounded-lg py-1 w-48 animate-in fade-in zoom-in duration-100 context-menu-container"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.type === 'header' ? (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-black text-muted/50 tracking-widest uppercase border-b border-border/50 mb-1">Column Options</div>
                  <div className="flex flex-col gap-0.5">
                    <button 
                      onClick={() => { setIsFreezeHeaders(!isFreezeHeaders); setContextMenu(null); }} 
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                    >
                      {isFreezeHeaders ? <Minimize2 size={14} className="text-accent" /> : <Maximize2 size={14} className="text-muted" />}
                      {isFreezeHeaders ? 'Unfreeze Headers' : 'Freeze Headers'}
                    </button>
                    <button 
                      onClick={() => { setIsFreezePanes(!isFreezePanes); setContextMenu(null); }} 
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                    >
                      {isFreezePanes ? <Minimize2 size={14} className="text-accent" /> : <Maximize2 size={14} className="text-muted" />}
                      {isFreezePanes ? 'Unfreeze Panes' : 'Freeze Panes'}
                    </button>
                  </div>
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
                  {selColSpan > 1 && (
                    <>
                      <div className="h-px bg-border my-1"></div>
                      <button 
                        onClick={() => { handleMergeCells(visibleHeaders, true); setContextMenu(null); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground font-bold"
                      >
                        <TableIcon size={14} className="text-accent" /> Merge Selected Headers
                      </button>
                    </>
                  )}
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
                      const section = gridData.get(`${contextMenu.row}:section`) || "";
                      handleInsertSection(section, 'before', contextMenu.row);
                      setContextMenu(null);
                    }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <FolderPlus size={14} className="text-accent" /> Insert Section Above
                  </button>
                  <button 
                    onClick={() => {
                      const section = gridData.get(`${contextMenu.row}:section`) || "";
                      handleInsertSection(section, 'after', contextMenu.row);
                      setContextMenu(null);
                    }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <FolderPlus size={14} className="text-accent" /> Insert Section Below
                  </button>
                  <button 
                    onClick={() => {
                      const section = gridData.get(`${contextMenu.row}:section`) || "";
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
              ) : contextMenu.type === 'section' ? (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-black text-muted/50 tracking-widest uppercase border-b border-border/50 mb-1">Section Options</div>
                  <button 
                    onClick={() => { handleInsertSection(contextMenu.sectionName!, 'before'); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <FolderPlus size={14} className="text-accent" /> Insert Section Above
                  </button>
                  <button 
                    onClick={() => { handleInsertSection(contextMenu.sectionName!, 'after'); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                  >
                    <FolderPlus size={14} className="text-accent" /> Insert Section Below
                  </button>
                  <div className="h-px bg-border my-1"></div>
                  <button 
                    onClick={() => { handleDeleteSection(contextMenu.sectionName!); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-red-500/10 text-red-500 flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Delete Section
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
                  
                  <button 
                    onClick={() => { setCellType(contextMenu.row!, contextMenu.col, 'date'); setContextMenu(null); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground font-medium"
                  >
                    <Calendar size={14} className="text-accent" /> Insert Calendar
                  </button>

                  {/* Unmerge only shows if the specific cell clicked is a merge host */}
                  {(() => {
                    const key = toA1Key(contextMenu.row!, masterColumnOrder.indexOf(contextMenu.col));
                    const meta = cellMetadata[key];
                    return (meta?.rowSpan > 1 || meta?.colSpan > 1) && (
                    <button 
                      onClick={() => { handleUnmergeCells(contextMenu.row!, contextMenu.col, visibleHeaders); setContextMenu(null); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground"
                    >
                      <X size={14} className="text-orange-500" /> Unmerge Cells
                    </button>
                    );
                  })()}

                  <div className="h-px bg-border my-1"></div>
                  <div className="px-3 py-1.5 text-[10px] font-black text-muted/50 tracking-widest uppercase">Alignment</div>
                  <button onClick={() => setSelectionAlignment('left')} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground">
                    <AlignLeft size={14} className="text-muted" /> Align Left
                  </button>
                  <button onClick={() => setSelectionAlignment('center')} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground">
                    <AlignCenter size={14} className="text-muted" /> Align Center
                  </button>
                  <button onClick={() => setSelectionAlignment('right')} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/10 flex items-center gap-2 text-foreground">
                    <AlignRight size={14} className="text-muted" /> Align Right
                  </button>

                  <div className="h-px bg-border my-1"></div>

                  {(() => {
                    const colIdx = masterColumnOrder.indexOf(contextMenu.col);
                    const key = colIdx !== -1 ? toA1Key(contextMenu.row!, colIdx) : '';
                    const meta = cellMetadata[key];
                    return meta?.type === 'media' && (
                    <>
                      <button onClick={() => removeCellMetadata(contextMenu.row!, contextMenu.col)} className="w-full text-left px-3 py-2 text-xs hover:bg-red-500/10 text-red-500 flex items-center gap-2 font-bold"><Trash2 size={14} /> Remove Attachment</button>
                      <div className="h-px bg-border my-1"></div>
                    </>
                   );
                  })()}

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
          <div className={`${GRID_THEME.formulaBar} min-h-9.5`}>
            <div 
              id="address-indicator"
              className="flex items-center gap-1.5 px-3 py-1 bg-muted/10 rounded border border-border text-[10px] font-black text-muted tracking-tighter min-w-30 justify-center shadow-sm mt-0.5"
            >
              {/* Sync with visual sequential labels (A, B, C...) regardless of internal master index */}
              {activeCell ? toA1Key(activeCell.row, visibleHeaders.indexOf(activeCell.col)) : 'Select...'}
            </div>
            <div className="h-4 w-px bg-border mx-1 self-center"></div>
            <div className="flex items-center gap-1.5 px-2 text-purple-500 mt-1">
              <Sigma size={14} className="shrink-0" />
              <span className="text-[10px] font-bold tracking-widest opacity-50">Formula</span>
            </div>
            <textarea
              ref={formulaBarRef}
              rows={1}
              placeholder="Enter value or formula (e.g., =SUM(A1, B1) or =ADD_DAYS(A1, 5))..."
              value={activeCell ? (gridData.get(toA1Key(activeCell.row, masterColumnOrder.indexOf(activeCell.col))) || '') : ''}
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
            onScroll={handleScroll}
            className="flex-1 overflow-x-auto overflow-y-scroll relative custom-scrollbar-zoomed"
            style={{ 
              scrollbarGutter: 'stable',
              overflowAnchor: 'none', // Prevents browser from trying to "correct" scroll position
              willChange: 'scroll-position',
              '--grid-scrollbar-size': `${Math.max(8, 12 * zoom)}px`,
            } as any}
          >
            {/* Virtual Scroll Spacer to force correct scrollbar height */}
            <div style={{ height: totalVirtualHeight * zoom, width: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
            
            <table 
              className="w-full border-separate border-spacing-0 table-auto min-w-full origin-top-left absolute left-0 top-0"
              style={{ 
                zoom: zoom, 
              } as any}
            >
              <thead className={GRID_THEME.tableHeader}>
                <tr className={`${GRID_THEME.tableHeaderRow} relative z-40 bg-card shadow-sm`}>
                  {/* The Corner Cell - Standardized border and background */}
                  <th 
                    onClick={() => {
                      if (rowCount > 0 && visibleHeaders.length > 0) {
                        setSelection({
                          startRow: -1, // Include headers in selection
                          endRow: rowCount - 1,
                          startCol: visibleHeaders[0],
                          endCol: visibleHeaders[visibleHeaders.length - 1]
                        });
                        setActiveCell({ row: 0, col: visibleHeaders[0] });
                      }
                    }}
                    className={`w-10 min-w-10 h-5 shadow-[inset_-1px_-1px_0_var(--color-border)] cursor-pointer hover:bg-muted/30 ${GRID_THEME.tableIndexCell} sticky left-0 z-50 bg-card shadow-[1px_0_0_0_var(--color-border),0_1px_0_0_var(--color-border)] ${
                      isFreezeHeaders ? 'top-0' : ''
                    }`}
                  >
                    <div className="w-full h-full flex items-center justify-center opacity-20 text-[8px] font-black text-muted">◢</div>
                  </th>
                  {visibleHeaders.map((header, idx) => {
                    const headerMeta = cellMetadata[`header:${header}`] || {};
                    const isColumnActive = activeCell?.col === header;
                    const isInHeaderLabelSelection = isHeaderInSelection(idx);

                    if (headerMeta.mergedIn) return null;

                    return (
                      <th 
                        key={`col-label-${idx}`} 
                        colSpan={headerMeta.colSpan}
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
                          // Excel behavior: Preserve selection if right-clicking inside existing header selection
                          const isAlreadySelected = isHeaderInSelection(idx);
                          
                          if (!isAlreadySelected && rowCount > 0) {
                            setSelection({
                              startRow: 0,
                              endRow: rowCount - 1,
                              startCol: header,
                              endCol: header
                            });
                            setActiveCell({ row: 0, col: header });
                          }
                          handleOpenContextMenu(e, 'header', header);
                        }}
                        style={{ 
                          fontFamily: headerMeta.fontFamily || 'inherit',
                          width: columnWidths[header] ? `${columnWidths[header]}px` : undefined,
                          minWidth: columnWidths[header] ? `${columnWidths[header]}px` : '120px' 
                        }}
                        className={`relative group/col-index text-[9px] font-black border-r border-b border-border h-5 text-center uppercase tracking-tighter cursor-pointer bg-card ${isFreezeHeaders ? 'sticky top-0 z-40' : ''} ${
                          isColumnActive || isInHeaderLabelSelection ? 'active-header' : 'text-muted hover:bg-muted/30 hover:text-foreground'
                        } ${isInHeaderLabelSelection ? 'bg-accent/30' : ''} ${
                          isFreezePanes && header === "Title / Item" ? `sticky left-10 z-50 shadow-[1px_0_0_0_var(--color-border)] ${isColumnActive ? 'bg-accent/20' : 'bg-muted/10'}` : ""
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
                  <th className="border-r border-b border-border bg-card"></th>
                </tr>
                <tr className="">
                  <th className={`w-10 min-w-10 ${GRID_THEME.tableIndexCell} bg-card sticky left-0 z-30 shadow-[1px_0_0_0_var(--color-border),0_1px_0_0_var(--color-border)] ${
                    isFreezeHeaders ? 'top-[20px]' : ''
                  }`}></th>
                  {visibleHeaders.map((header, colIdx) => {
                    const headerMeta = cellMetadata[`header:${header}`] || {};
                    const isColumnActive = activeCell?.col === header;
                    
                    if (headerMeta.mergedIn) return null;

                    const defaultAlign = (header === "Title / Item" || header === "Amount") ? "right" : "left";
                    const align = columnAlignments[header] || defaultAlign;
                    const alignClass = align === 'center' ? 'text-center' : 
                                     align === 'right' ? 'text-right' : 'text-left';

                    const isInHeaderSelection = isHeaderInSelection(colIdx);

                    return (
                      <th 
                      key={header} 
                      colSpan={headerMeta.colSpan}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      // Unified Excel behavior: Right-click selects whole column if not part of multi-selection
                      if (!isInHeaderSelection && rowCount > 0) {
                        setSelection({
                          startRow: 0,
                          endRow: rowCount - 1,
                          startCol: header,
                          endCol: header
                        });
                        setActiveCell({ row: 0, col: header });
                      }
                        handleOpenContextMenu(e, 'header', header);
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
                    className={`group/header px-2 py-1 text-[11px] font-bold tracking-tight border-r border-b border-border relative antialiased ${isFreezeHeaders ? 'sticky top-[20px] z-30 shadow-sm' : ''} ${
                      isColumnActive ? 'text-accent bg-accent/10' : 'text-muted bg-card'
                    } ${
                      isFreezePanes && header === "Title / Item" ? "sticky left-10 z-40 shadow-[1px_0_0_0_var(--color-border)]" : ""
                    } ${isInHeaderSelection ? 'bg-accent/20 ring-1 ring-inset ring-accent/30 z-10' : 'z-0'}`}
                    >
                      <div className="flex items-center gap-1">
                        <input
                          defaultValue={header.startsWith('_UNTITLED_') ? '' : header}
                          onBlur={(e) => handleRenameColumn(header, e.target.value)}
                          className={`w-full bg-transparent border-0 focus:ring-1 focus:ring-accent rounded px-1 outline-none truncate hover:bg-muted/10 ${alignClass}`}
                        />
                      </div>
                      </th>
                    );
                  })}
                  <th className={`p-2 min-w-35 border-r border-b border-border bg-card ${
                    isFreezeHeaders ? 'sticky top-[20px] z-30' : ''
                  }`}>
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
                      <Plus size={14} className="text-accent/60 shrink-0" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Virtualization Spacer: Pushes content down to correct scroll position 
                    while allowing the headers above to remain sticky at the top. */}
                <tr style={{ height: `${translateY}px` }} className="border-none"><td colSpan={visibleHeaders.length + 2} className="p-0 border-none" /></tr>
                {visibleItems.map((item, i) => {
                  if (item.type === 'section') {
                  return (
                      <tr 
                        key={`section-${item.name}-${item.blockIdx}`} 
                        className={`group/section h-10 transition-colors ${isSectionInSelection(item.startIndex) ? 'bg-accent/20' : 'bg-muted/30'}`}
                        onContextMenu={(e) => handleOpenContextMenu(e, 'section', "", undefined, item.name)}
                      >
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

                  const globalIndex = item.index;
                  // Construct row object ONLY for visible rows to save memory
                  const rowData: any = { _index: globalIndex };
                  allHeaders.forEach(h => {
                    const colIdx = masterColumnOrder.indexOf(h);
                    rowData[h] = colIdx !== -1 ? gridData.get(toA1Key(globalIndex, colIdx)) : undefined;
                  });
                  rowData.section = gridData.get(`${globalIndex}:section`);

                  return (
                    <GridRow 
                      key={globalIndex}
                      row={rowData}
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
                      setDragFillRange={setDragFillRange}
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
                      onMeasuredHeight={onMeasuredHeight}
                      masterColumnOrder={masterColumnOrder}
                      zoom={zoom}
                    />
                  );
                })}
                {/* Bottom Stability Spacer: Ensures the browser doesn't think the 
                    content height is changing exactly when we hit the bottom pixel. */}
                <tr style={{ height: '20px' }} className="border-none">
                  <td colSpan={visibleHeaders.length + 2} className="p-0 border-none" />
                </tr>
              </tbody>
            </table>

            {showBackToTop && (
              <button 
                onClick={scrollToTop}
                className="fixed bottom-10 right-10 p-3 bg-accent text-accent-foreground rounded-full shadow-2xl hover:opacity-90 transition-all z-50 animate-in fade-in zoom-in duration-300 group"
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
            className="px-6 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:opacity-90 transition-all shadow-sm"
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
      <main className={`${GRID_THEME.main} relative antialiased`}>
      {!isFullScreen && (
        <div className="flex h-full shrink-0 relative">
          {/* Vertical Icon Rail (Light Theme) */}
          <div className={`${GRID_THEME.rail} ${
            isExplorerVisible 
              ? 'fixed md:relative left-0 top-0 h-full md:h-auto translate-x-0 opacity-100 flex' 
              : 'fixed md:relative -translate-x-full md:translate-x-0 md:flex pointer-events-none md:pointer-events-auto opacity-0 md:opacity-100'
          } transition-[transform,opacity] duration-300`}>
            <button
              onClick={() => setIsExplorerVisible(!isExplorerVisible)}
              className={`p-2 rounded-lg group relative ${isExplorerVisible ? 'text-accent bg-accent/10 shadow-sm' : 'text-muted hover:text-foreground hover:bg-muted/10'}`}
            >
              {isExplorerVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
              <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
                {isExplorerVisible ? "Collapse Sidebar" : "Expand Sidebar"}
              </div>
            </button>
            <div className="h-px w-6 bg-border" />
            <button 
              className={`p-2 rounded-lg group relative ${isExplorerVisible ? 'text-accent' : 'text-muted hover:text-foreground'}`}
              onClick={() => !isExplorerVisible && setIsExplorerVisible(true)}
            >
              <Folder size={20} />
              <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
                Project Explorer
              </div>
            </button>
            <button 
              onClick={() => setViewMode('logs')}
              className={`p-2 rounded-lg group relative ${viewMode === 'logs' ? 'text-purple-500 bg-purple-500/10 shadow-sm' : 'text-muted hover:text-foreground hover:bg-muted/10'}`}
            >
              <History size={20} />
              <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
                System Audit Logs
              </div>
            </button>
            <button 
              onClick={() => setViewMode('trash')}
              className={`p-2 rounded-lg group relative ${viewMode === 'trash' ? 'text-orange-500 bg-orange-500/10 shadow-sm' : 'text-muted hover:text-foreground hover:bg-muted/10'}`}
            >
              <Trash2 size={20} />
              <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
                Trash Bin
              </div>
            </button>
            <button className="p-2 text-muted hover:text-foreground group relative">
              <Search size={20} />
              <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
                Search System
              </div>
            </button>
            <div className="mt-auto flex flex-col gap-4">
              {recentNodes.length > 0 && (
                <div className="flex flex-col items-center gap-2 mb-2">
                  <History size={14} className="text-muted/40 mb-1" />
                  {recentNodes.map(node => (
                    <button
                      key={`recent-${node.id}`}
                      onClick={() => setSelectedId(node.id)}
                      className={`p-1.5 rounded group relative ${selectedId === node.id ? 'text-accent bg-accent/10 shadow-sm' : 'text-muted hover:text-foreground hover:bg-muted/10'}`}
                    >
                      <FileText size={16} />
                      <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
                        {node.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="h-px w-6 bg-border self-center" />
              <button 
                onClick={() => setShowProfileModal(true)}
                className="p-2 text-muted hover:text-accent group relative"
              >
                {profileAvatar ? (
                  <div className="w-6 h-6 rounded-md overflow-hidden border border-border group-hover:border-accent transition-colors shadow-inner">
                    <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <User size={20} />
                )}
                <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
                  Profile Settings
                </div>
              </button>
              <ThemeToggle />
              
              <div className="h-px w-6 bg-border self-center" />
              
              <button 
                onClick={handleLogout}
                className="p-2 text-muted hover:text-red-500 group relative"
              >
                <LogOut size={20}/>
                <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
                  Sign Out
                </div>
              </button>
            </div>
          </div>

          {/* Explorer Drawer Panel */}
          {isExplorerVisible && (
            <div 
              className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-[2px] z-40"
              onClick={() => setIsExplorerVisible(false)}
            />
          )}
          <aside
            className={`${GRID_THEME.drawer} ${
              isExplorerVisible 
                ? 'w-64 p-4 opacity-100 translate-x-12 md:translate-x-0 pointer-events-auto' 
                : 'w-0 p-0 opacity-0 -translate-x-full md:translate-x-0 pointer-events-none'
            } fixed md:relative left-0 top-0 z-50 md:z-auto h-full shadow-2xl md:shadow-none`}
          >
            <div className="flex justify-between items-center mb-4 px-1 min-w-55 transition-colors">
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
            <div className="mb-4 relative group min-w-55">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent" />
              <input 
                type="text" 
                placeholder="Filter nodes..." 
                value={explorerSearch}
                onChange={(e) => setExplorerSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/5 border border-border rounded-md outline-none focus:ring-1 focus:ring-accent focus:bg-card text-foreground"
              />
            </div>
            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar min-w-55 [contain:content]">
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="animate-spin text-accent" size={20} />
                </div>
              ) : (
                filteredTree.map(node => (
                  <FileNodeItem 
                    key={node.id} node={node} onDelete={handleDelete} onRename={handleRename} onAdd={addItem}
                    onSelect={(node) => {
                      if (selectedId !== node.id) {
                        setIsLoadingFile(true);
                        setSelectedId(node.id);
                      if (viewMode === 'logs') setViewMode('table');
                      }
                    }} 
                    selectedId={selectedId ?? undefined}
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
            className="md:hidden fixed bottom-6 left-6 z-60 p-4 bg-accent text-accent-foreground rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <PanelLeftOpen size={24} />
          </button>
        )}

        {activeNode || viewMode === 'logs' || viewMode === 'trash' ? (
          <div className={`${GRID_THEME.editorContainer} ${isFullScreen ? 'bg-card' : 'bg-card border border-border rounded-xl shadow-sm'}`}>
            {!isFullScreen && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/10 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-3 shrink-0">
                  {viewMode === 'logs' ? (
                    <>
                      <div className="md:p-1.5 p-0.5 bg-purple-500/10 text-purple-500 rounded">
                        <History size={14} />
                      </div>
                      <h2 className="text-sm font-bold text-foreground">System Audit Logs</h2>
                    </>
                  ) : viewMode === 'trash' ? (
                    <>
                      <div className="md:p-1.5 p-0.5 bg-orange-500/10 text-orange-500 rounded">
                        <Trash2 size={14} />
                      </div>
                      <h2 className="text-sm font-bold text-foreground">Trash Bin</h2>
                    </>
                  ) : (
                    <>
                      <div className="md:p-1.5 p-0.5 bg-accent/10 text-accent rounded">
                        <FileIcon size={14} />
                      </div>
                      <h2 className="text-sm font-bold text-foreground truncate max-w-30 md:max-w-60">{activeNode?.name}</h2>
                    </>
                  )}
                  
                  <div className="h-4 w-px bg-border mx-1" />
                  
                  <nav className={GRID_THEME.navContainer}>
                    <button 
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${
                        viewMode === 'table' ? 'bg-card text-accent shadow-sm ring-1 ring-border' : 'text-muted hover:text-foreground'
                      }`}
                    >
                      <TableIcon size={12} /> Grid
                    </button>
                    {viewMode !== 'logs' && viewMode !== 'trash' && (
                    <button 
                      onClick={() => setViewMode('code')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${
                        viewMode === 'code' ? 'bg-card text-accent shadow-sm ring-1 ring-border' : 'text-muted hover:text-foreground'
                      }`}
                    >
                      <Code size={12} /> JSON
                    </button>
                    )}
                    {viewMode !== 'logs' && viewMode !== 'trash' && (
                    <button 
                      onClick={() => setViewMode('compare')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded ${
                        viewMode === 'compare' ? 'bg-card text-green-600 shadow-sm ring-1 ring-border' : 'text-muted hover:text-foreground'
                      }`}
                    >
                      <RefreshCcw size={12} /> Compare {comparisonIds.length > 0 && `(${comparisonIds.length})`}
                    </button>
                    )}
                  </nav>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {activeNode && <button onClick={() => window.open(`/print?id=${selectedId}`, '_blank')} className="p-1.5 text-muted hover:text-accent transition-colors" title="Printable Report"><Printer size={16} /></button>}
                  {activeNode && <button onClick={handleShare} className="p-1.5 text-muted hover:text-accent transition-colors" title="Copy Link"><Share2 size={16} /></button>}
                  <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1.5 text-muted hover:text-accent transition-colors" title="Toggle Focus Mode">{isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
                  <div className="h-4 w-px bg-border mx-1" />
                  {activeNode && (
                    <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-foreground rounded text-[11px] font-bold hover:opacity-90 disabled:opacity-50 shadow-sm"
                    >
                      {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {viewMode === 'logs' ? (
              <div className="flex flex-col flex-1 min-h-0">
                {renderAuditLogs()}
                <footer className={GRID_THEME.statusBar}>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5"><User size={12} className="text-muted/40"/> LGU Admin</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live System</div>
                      </div>
                    </footer>
                  </div>
                ) : viewMode === 'trash' ? (
                  <div className="flex flex-col flex-1 min-h-0">
                    {renderTrashBin()}
                    <footer className={GRID_THEME.statusBar}>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><User size={12} className="text-muted/40"/> LGU Admin</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live System</div>
                  </div>
                </footer>
              </div>
            ) : (activeNode?.type === 'file' && (
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
                    {activeNode && (
                      <>
                        <div className="flex items-center gap-1.5"><Clock size={12} className="text-muted/40"/> Created {new Date(activeNode.created_at).toLocaleDateString()}</div>
                        <div className="h-3 w-px bg-border" />
                      </>
                    )}
                    <div className="flex items-center gap-1.5"><User size={12} className="text-muted/40"/> LGU Admin</div>
                  </div>
                  <div className="flex items-center gap-4">
                    {activeNode && (
                      <div className="flex items-center gap-1.5"><HardDrive size={12} className="text-muted/40"/> {formatSize(activeNode.size_bytes)}</div>
                    )}
                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live System</div>
                  </div>
                </footer>
              </div>
            ))}
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
            const colIdx = masterColumnOrder.indexOf(dropdownMenu.col);
            const cellKey = colIdx !== -1 ? toA1Key(dropdownMenu.row, colIdx) : '';
            const meta = cellMetadata[cellKey] || {};
            const dropdownFont = meta.fontFamily || 'inherit';
            // Respect both font family and size
            const dropdownSize = meta.fontSize ? (typeof meta.fontSize === 'number' ? `${meta.fontSize}px` : meta.fontSize) : '0.875rem';
            
            return (
              <div 
                className="fixed z-120 bg-card border border-border shadow-2xl rounded-xl py-1.5 max-h-75 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200 custom-scrollbar dropdown-container"
                style={{ 
                  left: Math.min(dropdownMenu.x, window.innerWidth - dropdownMenu.width - 20), 
                  top: Math.min(dropdownMenu.y, window.innerHeight - 310),
                  width: dropdownMenu.width,
                  fontFamily: dropdownFont,
                  fontSize: dropdownSize
                }}
                onClick={e => e.stopPropagation()}
              >
              {dropdownMenu.options.map((opt, idx) => {
                  const mIdx = masterColumnOrder.indexOf(dropdownMenu.col);
                  const coord = mIdx !== -1 ? toA1Key(dropdownMenu.row, mIdx) : '';
                  const isSelected = coord ? gridData.get(coord) === opt : false;
                const isHighlighted = dropdownMenu.highlightIndex === idx;

                  return (
                    <button
                      key={opt}
                      onClick={() => {
                        handleUpdateCell(dropdownMenu.row, dropdownMenu.col, opt);
                        setDropdownMenu(null);
                      }}
                      className={`w-full text-left px-4 py-2 flex items-center justify-between group ${
                      (isSelected || isHighlighted)
                      ? 'bg-accent/10 text-accent font-bold'
                      : 'hover:bg-muted/10 text-foreground'
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
                  className="w-full text-left px-4 py-2 text-muted hover:text-red-500 hover:bg-red-500/5 italic"
                >
                  Clear Selection
                </button>
              </div>
            );
          })()}

        {/* Media Preview Modal */}
        {viewingMedia && (
          <div 
            className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" 
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

        {/* Profile Settings Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 z-300 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-border bg-muted/5 flex justify-between items-center">
                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-foreground">User Profile</h3>
                <button onClick={() => setShowProfileModal(false)} className="p-1 text-muted hover:text-foreground"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex flex-col items-center">
                  <div 
                    className="w-24 h-24 rounded-2xl bg-accent/10 border-2 border-accent/20 flex items-center justify-center text-accent overflow-hidden mb-4 shadow-inner cursor-pointer group relative"
                    onClick={() => avatarFileInputRef.current?.click()}
                    title="Click to upload new photo"
                  >
                    {profileAvatar ? (
                      <img src={profileAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={48} />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ImageIcon size={24} className="text-white" />
                    </div>
                  </div>
                  <input type="file" ref={avatarFileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                  <h4 className="font-bold text-lg text-foreground">{profileName || 'MEO Administrator'}</h4>
                  <p className="text-xs text-muted font-mono">{user?.email}</p>
                  <span className="mt-2 px-2 py-0.5 bg-accent/20 text-accent text-[9px] font-black uppercase rounded tracking-widest">
                    {user?.app_metadata?.role || 'User'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Full Name</label>
                    <input 
                      type="text" 
                      value={profileName} 
                      onChange={(e) => setProfileName(e.target.value)} 
                      placeholder="e.g. Juan Dela Cruz"
                      className="w-full px-4 py-2.5 bg-muted/5 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Email Address</label>
                    <input 
                      type="email" 
                      value={profileEmail} 
                      onChange={(e) => setProfileEmail(e.target.value)} 
                      placeholder="admin@labason.gov.ph"
                      className="w-full px-4 py-2.5 bg-muted/5 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">New Password</label>
                    <input 
                      type="password" 
                      value={profilePassword} 
                      onChange={(e) => setProfilePassword(e.target.value)} 
                      placeholder="Leave blank to keep current"
                      className="w-full px-4 py-2.5 bg-muted/5 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setShowProfileModal(false)}
                    className="flex-1 py-3 border border-border text-foreground rounded-xl font-bold text-xs hover:bg-muted/10 transition-all uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleUpdateProfile}
                    disabled={isUpdatingProfile}
                    className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-bold text-xs shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    {isUpdatingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Update Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
});

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'unauthorized' | 'ready'>('loading');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const isTransitioning = useRef(false);

  // Theme Management Logic
  useEffect(() => {
    const savedTheme = localStorage.getItem('meo-theme') as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('meo-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    if (isTransitioning.current) return;

    const next = theme === 'light' ? 'dark' : 'light';
    
    // @ts-ignore - View Transitions API support
    if (!document.startViewTransition) {
      setTheme(next);
      return;
    }
    
    isTransitioning.current = true;
    // Apply theme change inside the transition callback
    // @ts-ignore
    const transition = document.startViewTransition(() => {
      flushSync(() => {
        setTheme(next);
      });
    });

    transition.finished.finally(() => {
      isTransitioning.current = false;
    });
  }, [theme]);
  
  useEffect(() => {
    const checkAuth = async (currentSession: any) => {
      if (!currentSession) {
        setSession(null);
        setStatus('unauthorized');
        return;
      }

      // Security Check: Verify Admin Role in app_metadata
      // Note: You must set the user's role to 'admin' in the Supabase Auth dashboard
      const isAuthorized = currentSession.user?.app_metadata?.role === 'admin';
      
      if (!isAuthorized) {
        try {
          // Force sign out even if network is flaky
          await supabase.auth.signOut();
          alert("Access Denied: This account does not have administrator privileges for the MEO Data Entry system.");
        } catch (e) {
          console.error("Sign out during unauthorized access check failed", e);
        } finally {
          setSession(null);
          setStatus('unauthorized');
        }
      } else {
        setSession(currentSession);
        setStatus('ready');
      }
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => checkAuth(session));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => checkAuth(session));

    return () => subscription.unsubscribe();
  }, []);

  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center bg-background text-muted text-xs font-black uppercase tracking-[0.3em] animate-pulse">
      Verifying Encrypted Session...
    </div>;
  }

  if (!session || status === 'unauthorized') return <LoginPage />;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted font-sans animate-pulse uppercase tracking-widest text-xs font-black">Loading Dashboard...</div>}>
        <DashboardContent user={session.user} />
      </Suspense>
    </ThemeContext.Provider>
  );
}
