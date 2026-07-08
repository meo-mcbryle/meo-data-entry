import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, Type, Sigma, History, ZoomOut, ZoomIn, ChevronDown, ChevronUp,
  ChevronRight as ChevronRightIcon, Plus, RefreshCcw, HardDrive,
  Minimize2, Maximize2, Table as TableIcon, X, AlignLeft, AlignCenter,
  AlignRight, EyeOff, FolderPlus, Trash2, Calendar, Image as ImageIcon,
  Paperclip, FileText, Code, ArrowUp, Loader2, Copy, Clipboard, Sliders
} from 'lucide-react';
import { toA1Key, getExcelColumnLabel } from '@/lib/excel-utils';
import { GRID_THEME, FONT_FAMILIES, DATE_FORMATS, NUMBER_FORMATS } from '@/lib/constants';
import { GridRow } from './GridRow';
import { useSpreadsheetOperations } from '@/hooks/useSpreadsheetOperations';
import { MobileBottomSheet } from './MobileBottomSheet';

interface TableEditorProps {
  isLoadingFile: boolean;
  loadProgress: number;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  containerHeight: number;
  setContainerHeight: React.Dispatch<React.SetStateAction<number>>;
  isFullScreen: boolean;
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  onMeasuredHeight: (index: number, height: number) => void;
  setViewMode: (mode: 'code' | 'table' | 'compare' | 'logs' | 'trash') => void;
  selectedId: string | null;
  isSidebarMoving: boolean;
  isFreezeHeaders: boolean;
  setIsFreezeHeaders: React.Dispatch<React.SetStateAction<boolean>>;
  isFreezePanes: boolean;
  setIsFreezePanes: React.Dispatch<React.SetStateAction<boolean>>;
  spreadsheet: ReturnType<typeof useSpreadsheetOperations>;
}

export const TableEditor = ({
  isLoadingFile,
  loadProgress,
  zoom,
  setZoom,
  containerHeight,
  setContainerHeight,
  isFullScreen,
  setIsFullScreen,
  onMeasuredHeight,
  setViewMode,
  selectedId,
  isSidebarMoving,
  isFreezeHeaders,
  setIsFreezeHeaders,
  isFreezePanes,
  setIsFreezePanes,
  spreadsheet
}: TableEditorProps) => {
  const {
    rowCount,
    setRowCount,
    initializeExcelTemplate,
    visibleHeaders,
    selection,
    setSelection,
    activeCell,
    setActiveCell,
    masterColumnOrder,
    cellMetadata,
    setCellMetadata,
    setCellFontFamily,
    selectedYear,
    setSelectedYear,
    hiddenColumns,
    toggleColumnVisibility,
    allHeaders,
    undoStack,
    redoStack,
    undo,
    redo,
    handleAddSection,
    handleResetWidths,
    exportToCSV,
    contextMenu,
    setContextMenu,
    handleMergeCells,
    handleUnmergeCells,
    setColumnAlignment,
    columnAlignments,
    handleRenameColumn,
    handleAddColumn,
    handleDeleteColumn,
    handleInsertColumn,
    handleInsertRow,
    handleClearRow,
    handleInsertSection,
    addRowToSection,
    handleDeleteSection,
    removeTableRow,
    handleClearColumn,
    gridData,
    cellAlignments,
    rowHeights,
    dragFillRange,
    setDragFillRange,
    isSelecting,
    setIsSelecting,
    handleUpdateCell,
    handleKeyDown,
    handleOpenContextMenu,
    toggleCellAlignment,
    handleDragFillStart,
    setViewingMedia,
    removeCellMetadata,
    evaluateFormula,
    startRowResizing,
    handleOpenDropdown,
    columnWidths,
    startResizing,
    handleRenameSectionBlock,
    handleFileSelect,
    pendingMedia,
    fileInputRef,
    formulaBarRef,
    setCellType,
    setSelectionAlignment,
    insertMedia,
    handleCopyCells,
    handlePasteCells
  } = spreadsheet;
  const [rowFilter, setRowFilter] = useState<string>('');
  const [newColName, setNewColName] = useState<string>('');
  const [scrollTop, setScrollTop] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [editingValue, setEditingValue] = useState('');
  const [isToolsSheetOpen, setIsToolsSheetOpen] = useState(false);
  const [isFormulaExpanded, setIsFormulaExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuSubSection, setMobileMenuSubSection] = useState<'formats' | 'numbers' | 'formulas' | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!contextMenu) {
      setMobileMenuSubSection(null);
    }
  }, [contextMenu]);

  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(null);
  if (selectedId !== prevSelectedId) {
    setPrevSelectedId(selectedId);
    setScrollTop(0);
  }

  // Grid entry animation key — re-mounts on every new file selection
  const gridKey = selectedId ?? 'grid';

  const activeCellKey = activeCell ? toA1Key(activeCell.row, masterColumnOrder.indexOf(activeCell.col)) : null;
  const activeCellValue = activeCellKey ? (gridData.get(activeCellKey) || '') : '';

  useEffect(() => {
    setEditingValue(activeCellValue);
  }, [activeCellKey, activeCellValue]);

  // Auto-grow formula bar textarea based on content (only when expanded)
  useEffect(() => {
    const el = formulaBarRef.current;
    if (el) {
      if (isFormulaExpanded) {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      } else {
        el.style.height = '';
      }
    }
  }, [editingValue, isFormulaExpanded, formulaBarRef]);

  const handleLocalEditing = useCallback((val: string) => {
    setEditingValue(val);
  }, []);

  // Delete key: clear the active cell's content when it's selected but NOT actively being edited in an input/textarea
  useEffect(() => {
    const handleDeleteKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!activeCell) return;

      // Don't intercept if user is typing inside a cell editor input/textarea
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      // Don't intercept if user is typing in a search/filter input
      const el = document.activeElement as HTMLElement;
      if (el?.closest('[data-no-delete-intercept]')) return;

      e.preventDefault();
      handleUpdateCell(activeCell.row, activeCell.col, '');
    };

    window.addEventListener('keydown', handleDeleteKey);
    return () => window.removeEventListener('keydown', handleDeleteKey);
  }, [activeCell, handleUpdateCell]);

  const DEFAULT_ROW_HEIGHT = 30;

  // Reset scroll state on node change
  useEffect(() => {
    setScrollTop(0);
    setShowBackToTop(false);
    tableContainerRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  // Virtualization state and Web Worker logic
  const [filteredRowIndices, setFilteredRowIndices] = useState<number[]>([]);
  const filterWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize the worker relative to the bundle
    filterWorkerRef.current = new Worker(new URL('../app/filter.worker.ts', import.meta.url));
    filterWorkerRef.current.onmessage = (e: MessageEvent<number[]>) => {
      setFilteredRowIndices(e.data);
    };
    return () => filterWorkerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!rowFilter) {
      setFilteredRowIndices(Array.from({ length: rowCount }, (_, i) => i));
      return;
    }
    if (filterWorkerRef.current) {
      filterWorkerRef.current.postMessage({
        rowCount,
        rowFilter,
        allHeaders,
        masterColumnOrder,
        gridData
      });
    }
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
        currentOffset += 30;
      }

      block.indices.forEach(idx => {
        offsets.push(currentOffset);
        items.push({ type: 'row', index: idx });
        currentOffset += (rowHeights[String(idx)] || 30);
      });
    });

    return {
      flatItems: items,
      itemOffsets: offsets,
      totalVirtualHeight: currentOffset + 30
    };
  }, [sectionBlocks, rowHeights]);

  // Refs to avoid unnecessary scroll re-triggers during live grid cell edits
  const flatItemsRef = useRef(flatItems);
  const itemOffsetsRef = useRef(itemOffsets);
  const rowHeightsRef = useRef(rowHeights);
  const zoomRef = useRef(zoom);
  const containerHeightRef = useRef(containerHeight);

  flatItemsRef.current = flatItems;
  itemOffsetsRef.current = itemOffsets;
  rowHeightsRef.current = rowHeights;
  zoomRef.current = zoom;
  containerHeightRef.current = containerHeight;

  // Scroll active cell into view when it changes and is off-screen
  useEffect(() => {
    if (isLoadingFile || !activeCell || !tableContainerRef.current) return;

    // Defer scroll action slightly to allow browser layout paint
    const timer = setTimeout(() => {
      const container = tableContainerRef.current;
      if (!container) return;

      const currentFlatItems = flatItemsRef.current;
      const currentItemOffsets = itemOffsetsRef.current;
      const currentRowHeights = rowHeightsRef.current;
      const currentZoom = zoomRef.current;
      const currentContainerHeight = containerHeightRef.current;

      if (currentFlatItems.length === 0) return;

      // Find the item index for the active cell row
      const itemIndex = currentFlatItems.findIndex(item => item.type === 'row' && item.index === activeCell.row);
      if (itemIndex === -1) return;

      const rowTop = currentItemOffsets[itemIndex];
      const rowHeight = currentRowHeights[String(activeCell.row)] || 30;

      const rowTopScreen = rowTop * currentZoom;
      const rowHeightScreen = rowHeight * currentZoom;

      const currentScrollTop = container.scrollTop;
      const containerRect = container.getBoundingClientRect();
      const containerHeightPx = containerRect.height || currentContainerHeight || 800;

      const isAbove = rowTopScreen < currentScrollTop;
      const isBelow = rowTopScreen + rowHeightScreen > currentScrollTop + containerHeightPx;

      if (isAbove) {
        container.scrollTo({
          top: Math.max(0, rowTopScreen),
          behavior: 'smooth'
        });
      } else if (isBelow) {
        container.scrollTo({
          top: Math.max(0, rowTopScreen + rowHeightScreen - containerHeightPx),
          behavior: 'smooth'
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeCell, isLoadingFile]);

  // Scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    setScrollTop(top);
    setShowBackToTop(top > 300);
  }, []);

  const scrollToTop = () => {
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Viewport tracking for ResizeObserver
  useEffect(() => {
    if (!tableContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (isSidebarMoving) return;
      requestAnimationFrame(() => {
        const entry = entries[0];
        if (!entry) return;

        const h = Math.floor(entry.contentRect.height);
        if (h > 0) {
          setContainerHeight(prev => (Math.abs(prev - h) > 20) ? h : prev);
        }
      });
    });
    observer.observe(tableContainerRef.current);
    setContainerHeight(tableContainerRef.current.getBoundingClientRect().height || 800);
    return () => observer.disconnect();
  }, [setContainerHeight, selectedId, isSidebarMoving]);

  try {
    if (!isLoadingFile && rowCount === 0) {
      return (
        <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 shadow-sm flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="font-semibold mb-1 text-sm">Pre-formatted Table Required</p>
            <p className="text-xs text-amber-700">Initialize the Work A / Work B structure for this file.</p>
          </div>
          <button
            onClick={initializeExcelTemplate}
            className="px-4 py-2 bg-accent hover:opacity-90 text-accent-foreground text-xs font-bold rounded-lg transition-colors uppercase tracking-wider shadow-sm cursor-pointer"
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
      const isRowSelectionMatching = (selMinRow <= -1 && selMaxRow >= -1) || (selMinRow === 0 && selMaxRow >= rowCount - 1);
      return isRowSelectionMatching && idx >= selMinColIdx && idx <= selMaxColIdx;
    };

    const isSectionInSelection = (startIndex: number) => {
      return selection && startIndex >= selMinRow && startIndex <= selMaxRow;
    };

    // Binary search for first visible virtual index
    let startIdx = 0;
    let low = 0;
    let high = itemOffsets.length - 1;
    const adjustedScrollTop = scrollTop / zoom;

    while (low <= high) {
      let mid = Math.floor((low + high) / 2);
      if (itemOffsets[mid] <= adjustedScrollTop) {
        startIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const overscanTop = 30;
    const overscanBottom = 40;

    const startIndex = Math.max(0, startIdx - overscanTop);
    const visibleRowEstimate = Math.ceil(containerHeight / (DEFAULT_ROW_HEIGHT * zoom));
    const endIndex = Math.min(flatItems.length, startIdx + visibleRowEstimate + overscanBottom);

    const visibleItems = flatItems.slice(startIndex, endIndex);
    const translateY = itemOffsets[startIndex] || 0;

    return (
      <div className={`${GRID_THEME.editor} ${isFullScreen ? '' : 'border border-border rounded-lg shadow-sm'}`}>
        {/* Desktop Excel Toolbar */}
        <div className={`hidden md:flex ${GRID_THEME.toolbar}`}>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input type="text" placeholder="Search records..." value={rowFilter} onChange={(e) => setRowFilter(e.target.value)} className="w-full pl-9 pr-4 py-1 text-xs border border-border rounded focus:ring-1 focus:ring-accent outline-none bg-background text-foreground placeholder:text-muted/50" />
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border rounded text-xs font-medium">
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
            <div className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border rounded text-xs font-medium">
              <span className="text-muted">Year:</span>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent border-0 font-bold text-accent focus:ring-0 cursor-pointer dark:bg-card">
                <option value="2020">2020</option>
                <option value="2021">2021</option>
                <option value="2022">2022</option>
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border rounded text-xs font-medium">
              <span className="text-muted">Columns:</span>
              <select
                value=""
                onChange={(e) => { if (e.target.value) toggleColumnVisibility(e.target.value); e.target.value = ""; }}
                className="bg-transparent border-0 font-bold text-accent focus:ring-0 cursor-pointer max-w-27.5 dark:bg-card"
              >
                <option value="">{hiddenColumns.length > 0 ? `(${hiddenColumns.length} Hidden)` : "All Visible"}</option>
                {allHeaders.filter(h => h !== 'section').map(h => (
                  <option key={h} value={h}>{hiddenColumns.includes(h) ? "Show" : "Hide"} {h}</option>
                ))}
              </select>
            </div>
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 px-1 py-1 bg-card border border-border rounded text-xs font-medium shrink-0">
              <button
                disabled={undoStack.length === 0}
                onClick={undo}
                className="p-1 hover:bg-muted/20 rounded text-muted hover:text-accent transition-colors disabled:opacity-30 cursor-pointer"
                title="Undo (Ctrl+Z)"
              >
                <History size={14} className="rotate-180 flip-y" />
              </button>
              <button
                disabled={redoStack.length === 0}
                onClick={redo}
                className="p-1 hover:bg-muted/20 rounded text-muted hover:text-accent transition-colors disabled:opacity-30 cursor-pointer"
                title="Redo (Ctrl+Y)"
              >
                <History size={14} />
              </button>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-1 bg-card border border-border rounded text-xs font-medium shrink-0">
              <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-1 hover:bg-muted/20 rounded text-muted hover:text-accent transition-colors cursor-pointer" title="Zoom Out">
                <ZoomOut size={14} />
              </button>
              <button onClick={() => setZoom(1)} className="w-10 text-center font-bold text-accent select-none hover:bg-muted/10 rounded transition-colors cursor-pointer" title="Reset Zoom">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-1 hover:bg-muted/20 rounded text-muted hover:text-accent transition-colors cursor-pointer" title="Zoom In">
                <ZoomIn size={14} />
              </button>
            </div>
            <div className="flex items-center gap-1 px-1 py-1 bg-card border border-border rounded text-xs font-medium shrink-0">
              <button
                onClick={() => setIsFreezeHeaders(!isFreezeHeaders)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer ${isFreezeHeaders ? 'bg-accent/10 text-accent font-bold' : 'text-muted hover:bg-muted/10'}`}
                title="Toggle Freeze Headers (Vertical)"
              >
                <ChevronDown size={14} className={isFreezeHeaders ? "" : "rotate-180"} /> Headers
              </button>
              <button
                onClick={() => setIsFreezePanes(!isFreezePanes)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer ${isFreezePanes ? 'bg-accent/10 text-accent font-bold' : 'text-muted hover:bg-muted/10'}`}
                title="Toggle Freeze Panes (Horizontal)"
              >
                <ChevronRightIcon size={14} /> Panes
              </button>
            </div>
            <button onClick={handleAddSection} className="flex items-center gap-1 px-2 py-1 bg-card border border-border rounded text-xs font-medium hover:bg-muted/10 shadow-sm text-foreground cursor-pointer">
              <Plus size={14} className="text-green-600" /> Add Section
            </button>
            <button onClick={handleResetWidths} className="flex items-center gap-1 px-2 py-1 bg-card border border-border rounded text-xs font-medium hover:bg-muted/10 shadow-sm text-foreground cursor-pointer" title="Reset all columns to auto-width">
              <RefreshCcw size={14} /> Reset Widths
            </button>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-4">
            <button onClick={exportToCSV} className="flex items-center gap-1 px-2 py-1 bg-card border border-border rounded text-xs font-medium hover:bg-muted/10 shadow-sm text-foreground cursor-pointer">
              <HardDrive size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Mobile Excel Toolbar */}
        <div className="md:hidden flex items-center justify-between py-1.5 px-3 bg-background/25 border-b border-border/40 gap-2 shrink-0">
          <div className="relative flex-1 max-w-[200px]">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
            <input 
              type="text" 
              placeholder="Search rows..." 
              value={rowFilter} 
              onChange={(e) => setRowFilter(e.target.value)} 
              className="w-full pl-7 pr-3 py-1 text-xs border border-border rounded-lg outline-none focus:ring-1 focus:ring-accent bg-background text-foreground" 
            />
          </div>

          <button
            onClick={() => setIsToolsSheetOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-card border border-border rounded-lg text-xs font-bold text-foreground hover:bg-muted/15 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Sliders size={13} className="text-accent" />
            <span>Grid Tools</span>
          </button>
        </div>

        {/* Mobile Tools Bottom Sheet */}
        <MobileBottomSheet
          isOpen={isToolsSheetOpen}
          onClose={() => setIsToolsSheetOpen(false)}
          title="Grid Configuration"
        >
          <div className="flex flex-col gap-4">
            {/* Undo / Redo */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1">Actions history</span>
              <div className="flex gap-2">
                <button
                  disabled={undoStack.length === 0}
                  onClick={undo}
                  className="flex-1 py-2.5 bg-muted/5 border border-border/70 rounded-xl text-xs font-bold text-foreground flex items-center justify-center gap-2 disabled:opacity-30 cursor-pointer"
                >
                  <History size={15} className="rotate-180 flip-y" />
                  <span>Undo</span>
                </button>
                <button
                  disabled={redoStack.length === 0}
                  onClick={redo}
                  className="flex-1 py-2.5 bg-muted/5 border border-border/70 rounded-xl text-xs font-bold text-foreground flex items-center justify-center gap-2 disabled:opacity-30 cursor-pointer"
                >
                  <History size={15} />
                  <span>Redo</span>
                </button>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Zoom Controls */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1">Zoom ({Math.round(zoom * 100)}%)</span>
              <div className="flex bg-muted/10 p-1 rounded-xl border border-border/30 items-center justify-between">
                <button 
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} 
                  className="p-2 hover:bg-muted/20 rounded-lg text-muted cursor-pointer"
                >
                  <ZoomOut size={16} />
                </button>
                <button 
                  onClick={() => setZoom(1)} 
                  className="text-xs font-black text-accent px-4 py-1.5 bg-card rounded-lg shadow-sm border border-border/20 cursor-pointer"
                >
                  Reset (100%)
                </button>
                <button 
                  onClick={() => setZoom(Math.min(2, zoom + 0.1))} 
                  className="p-2 hover:bg-muted/20 rounded-lg text-muted cursor-pointer"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Freeze Toggles */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1">Header Locking</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsFreezeHeaders(!isFreezeHeaders)}
                  className={`flex-1 py-2.5 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isFreezeHeaders
                      ? 'bg-accent/10 border-accent text-accent font-black'
                      : 'bg-muted/5 border-border/70 text-muted hover:bg-muted/10'
                  }`}
                >
                  <ChevronDown size={14} className={isFreezeHeaders ? "" : "rotate-180"} />
                  Freeze Headers
                </button>
                <button
                  onClick={() => setIsFreezePanes(!isFreezePanes)}
                  className={`flex-1 py-2.5 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isFreezePanes
                      ? 'bg-accent/10 border-accent text-accent font-black'
                      : 'bg-muted/5 border-border/70 text-muted hover:bg-muted/10'
                  }`}
                >
                  <ChevronRightIcon size={14} />
                  Freeze Title
                </button>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Font Family & Year */}
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1">Font family</span>
                <div className="relative bg-muted/5 border border-border/70 rounded-xl px-3 py-1">
                  <select
                    value={(() => {
                      if (!activeCell) return "";
                      const mIdx = masterColumnOrder.indexOf(activeCell.col);
                      const key = toA1Key(activeCell.row, mIdx);
                      return cellMetadata[key]?.fontFamily || "";
                    })()}
                    onChange={(e) => activeCell && setCellFontFamily(activeCell.row, activeCell.col, e.target.value)}
                    className="w-full bg-transparent border-0 font-bold text-accent text-xs focus:ring-0 cursor-pointer h-8 outline-none dark:bg-card"
                  >
                    <option value="">Default Font</option>
                    {FONT_FAMILIES.map(f => (
                      <option key={f.id} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1">Active Year</span>
                <div className="relative bg-muted/5 border border-border/70 rounded-xl px-3 py-1">
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(e.target.value)} 
                    className="w-full bg-transparent border-0 font-bold text-accent text-xs focus:ring-0 cursor-pointer h-8 outline-none dark:bg-card"
                  >
                    <option value="2020">2020</option>
                    <option value="2021">2021</option>
                    <option value="2022">2022</option>
                    <option value="2023">2023</option>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Column Toggles */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1">Visible columns</span>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {allHeaders.filter(h => h !== 'section').map(header => {
                  const isVisible = !hiddenColumns.includes(header);
                  return (
                    <button
                      key={`toggle-col-${header}`}
                      onClick={() => toggleColumnVisibility(header)}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold border transition-all cursor-pointer truncate ${
                        isVisible
                          ? 'bg-accent/15 border-accent/35 text-accent font-bold'
                          : 'bg-muted/5 border-border/70 text-muted/65 hover:bg-muted/10'
                      }`}
                    >
                      {isVisible ? '✓ ' : '✗ '} {header}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Other actions */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1">Table Actions</span>
              <button 
                onClick={() => { handleAddSection(); setIsToolsSheetOpen(false); }} 
                className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
              >
                <Plus size={16} className="text-green-600" /> 
                Add New Section
              </button>
              <button 
                onClick={() => { handleResetWidths(); setIsToolsSheetOpen(false); }} 
                className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
              >
                <RefreshCcw size={16} className="text-muted" /> 
                Reset Column Widths
              </button>
              <button 
                onClick={() => { exportToCSV(); setIsToolsSheetOpen(false); }} 
                className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
              >
                <HardDrive size={16} className="text-accent" /> 
                Export to CSV File
              </button>
            </div>
          </div>
        </MobileBottomSheet>

        {/* Cell Context Menu */}
        {contextMenu && !isMobile && (
          <div
            className="fixed z-[100] bg-card border border-border/60 shadow-2xl rounded-xl py-1 w-48 animate-in fade-in zoom-in-95 duration-150 context-menu-container flex flex-col gap-0.5 p-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'header' ? (
              <>
                <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-0.5 mt-1">Column Options</div>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => { setIsFreezeHeaders(!isFreezeHeaders); setContextMenu(null); }}
                    className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                  >
                    {isFreezeHeaders ? <Minimize2 size={13} className="text-accent" /> : <Maximize2 size={13} className="text-muted" />}
                    {isFreezeHeaders ? 'Unfreeze Headers' : 'Freeze Headers'}
                  </button>
                  <button
                    onClick={() => { setIsFreezePanes(!isFreezePanes); setContextMenu(null); }}
                    className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                  >
                    {isFreezePanes ? <Minimize2 size={13} className="text-accent" /> : <Maximize2 size={13} className="text-muted" />}
                    {isFreezePanes ? 'Unfreeze Panes' : 'Freeze Panes'}
                  </button>
                </div>
                <div className="h-px bg-border/50 my-1 mx-2"></div>
                <div className="relative group/sub">
                  <button
                    onMouseEnter={() => setContextMenu((prev: any) => prev ? { ...prev, showFonts: true, showFormats: false } : null)}
                    className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center justify-between gap-2.5 text-foreground rounded-md transition-colors"
                  >
                    <span className="flex items-center gap-2"><Type size={13} className="text-accent" /> Set Column Font</span>
                    <ChevronRightIcon size={12} className="text-muted" />
                  </button>
                  {contextMenu.showFonts && (
                    <div className={`absolute ${contextMenu.x + 368 > window.innerWidth ? 'right-full mr-1.5' : 'left-full ml-1.5'} top-0 bg-card border border-border/60 shadow-2xl rounded-xl py-1 w-44 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-0.5 p-1`}>
                      {FONT_FAMILIES.map(f => (
                        <button key={f.id} onClick={() => setCellFontFamily(-1, contextMenu.col, f.value)} className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 text-foreground rounded-md transition-colors">{f.label}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="h-px bg-border/50 my-1 mx-2"></div>
                <div className="px-2 py-1 flex items-center justify-between mx-1 gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Align</span>
                  <div className="flex bg-muted/20 p-0.5 rounded-md border border-border/30 w-32">
                    {(['left', 'center', 'right'] as const).map((a) => {
                      const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                      const defaultAlign = (contextMenu.col === "Title / Item" || contextMenu.col === "Amount") ? "right" : "left";
                      const active = (cellAlignments[`header:${contextMenu.col}`] || columnAlignments[contextMenu.col] || defaultAlign) === a;
                      return (
                        <button
                          key={a}
                          onClick={() => setColumnAlignment(contextMenu.col, a)}
                          title={`${a.charAt(0).toUpperCase() + a.slice(1)} Alignment`}
                          className={`flex-1 py-1 flex justify-center items-center rounded transition-all ${active
                              ? 'bg-card text-accent shadow-sm border border-border/20 font-medium'
                              : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                          <Icon size={12} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selColSpan > 1 && (
                  <>
                    <div className="h-px bg-border/50 my-1 mx-2"></div>
                    <button
                      onClick={() => { handleMergeCells(visibleHeaders, true); setContextMenu(null); }}
                      className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md font-bold transition-colors"
                    >
                      <TableIcon size={13} className="text-accent" /> Merge Selected Headers
                    </button>
                  </>
                )}
                {cellMetadata[`header:${contextMenu.col}`]?.colSpan > 1 && (
                  <button
                    onClick={() => { handleUnmergeCells(-1, contextMenu.col, visibleHeaders); setContextMenu(null); }}
                    className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                  >
                    <X size={13} className="text-orange-500" /> Unmerge Header
                  </button>
                )}
                <button
                  onClick={() => { toggleColumnVisibility(contextMenu.col); setContextMenu(null); }}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <EyeOff size={13} /> Hide Column
                </button>
                <button
                  onClick={() => { handleInsertColumn(contextMenu.col, 'before'); setContextMenu(null); }}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <Plus size={13} className="text-accent" /> Insert Column Before
                </button>
                <button
                  onClick={() => { handleInsertColumn(contextMenu.col, 'after'); setContextMenu(null); }}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <Plus size={13} className="text-accent" /> Insert Column After
                </button>
                <button
                  onClick={() => handleClearColumn(contextMenu.col)}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <X size={13} className="text-orange-500" /> Clear Column Content
                </button>
                <div className="h-px bg-border/50 my-1 mx-2"></div>
                <button
                  onClick={() => { handleDeleteColumn(contextMenu.col); setContextMenu(null); }}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-red-500/15 text-red-500 flex items-center gap-2.5 rounded-md transition-colors"
                >
                  <Trash2 size={13} /> Delete Column
                </button>
              </>
            ) : contextMenu.type === 'row' ? (
              <>
                <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-0.5 mt-1">Row Options</div>
                <button
                  onClick={() => handleInsertRow(contextMenu.row!, 'above')}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <Plus size={13} className="text-accent" /> Insert Row Above
                </button>
                <button
                  onClick={() => handleInsertRow(contextMenu.row!, 'after')}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <Plus size={13} className="text-accent" /> Insert Row Below
                </button>
                <button
                  onClick={() => handleClearRow(contextMenu.row!)}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <X size={13} className="text-orange-500" /> Clear Row Content
                </button>
                <div className="h-px bg-border/50 my-1 mx-2"></div>
                <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-0.5 mt-1">Section Actions</div>
                <button
                  onClick={() => {
                    const section = gridData.get(`${contextMenu.row}:section`) || "";
                    handleInsertSection(section, 'before', contextMenu.row);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <FolderPlus size={13} className="text-accent" /> Insert Section Above
                </button>
                <button
                  onClick={() => {
                    const section = gridData.get(`${contextMenu.row}:section`) || "";
                    handleInsertSection(section, 'after', contextMenu.row);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <FolderPlus size={13} className="text-accent" /> Insert Section Below
                </button>
                <button
                  onClick={() => {
                    const section = gridData.get(`${contextMenu.row}:section`) || "";
                    addRowToSection(section);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <Plus size={13} className="text-accent" /> Add Row to this Section
                </button>
                <div className="h-px bg-border/50 my-1 mx-2"></div>
                <button
                  onClick={() => { removeTableRow(contextMenu.row!); setContextMenu(null); }}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-red-500/15 text-red-500 flex items-center gap-2.5 rounded-md transition-colors"
                >
                  <Trash2 size={13} /> Delete Row
                </button>
              </>
            ) : (
              <>
                <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-0.5 mt-1">Clipboard</div>
                <button
                  onClick={() => {
                    handleCopyCells(selection, contextMenu.row !== undefined ? { row: contextMenu.row, col: contextMenu.col } : null, visibleHeaders);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <Copy size={13} className="text-accent" /> Copy
                </button>
                <button
                  onClick={() => {
                    handlePasteCells(contextMenu.row !== undefined ? { row: contextMenu.row, col: contextMenu.col } : null, visibleHeaders);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1 text-xs hover:bg-accent/15 flex items-center gap-2.5 text-foreground rounded-md transition-colors"
                >
                  <Clipboard size={13} className="text-accent" /> Paste
                </button>
              </>
            )}
          </div>
        )}

        {/* Cell Context Menu (Mobile Bottom Sheet) */}
        {contextMenu && isMobile && contextMenu.type === 'cell' && (() => {
          const colIdx = masterColumnOrder.indexOf(contextMenu.col);
          const key = colIdx !== -1 ? toA1Key(contextMenu.row!, colIdx) : '';
          const meta = cellMetadata[key];
          const hasAttachments = meta?.type === 'media' || (meta?.attachments?.length ?? 0) > 0;

          return (
            <MobileBottomSheet
              isOpen={true}
              onClose={() => setContextMenu(null)}
              title={`Cell Options: ${toA1Key(contextMenu.row!, masterColumnOrder.indexOf(contextMenu.col))}`}
            >
              <div className="flex flex-col gap-4">
                {/* Clipboard actions */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1">Clipboard</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleCopyCells(selection, { row: contextMenu.row!, col: contextMenu.col }, visibleHeaders);
                        setContextMenu(null);
                      }}
                      className="flex-1 py-2.5 bg-muted/5 border border-border/40 rounded-xl text-xs font-bold text-foreground flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      <Copy size={15} className="text-accent" />
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => {
                        handlePasteCells({ row: contextMenu.row!, col: contextMenu.col }, visibleHeaders);
                        setContextMenu(null);
                      }}
                      className="flex-1 py-2.5 bg-muted/5 border border-border/40 rounded-xl text-xs font-bold text-foreground flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      <Clipboard size={15} className="text-accent" />
                      <span>Paste</span>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Grid Structure */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1">Selection Actions</span>
                  <button
                    onClick={() => { handleMergeCells(visibleHeaders); setContextMenu(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <TableIcon size={16} className="text-accent" />
                    <span>Merge Selected Cells</span>
                  </button>
                  <button
                    onClick={() => { setCellType(contextMenu.row!, contextMenu.col, 'date'); setContextMenu(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <Calendar size={16} className="text-accent" />
                    <span>Insert Calendar Picker</span>
                  </button>
                </div>

                <div className="h-px bg-border/50" />

                {/* Media options */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1">Media Attachments</span>
                  {hasAttachments && (
                    <button
                      onClick={() => {
                        setViewingMedia({ attachments: meta.attachments || [], row: contextMenu.row!, col: contextMenu.col });
                        setContextMenu(null);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                    >
                      <Paperclip size={16} className="text-accent" />
                      <span className="font-bold">View Attachments ({(meta?.attachments?.length ?? 0)})</span>
                    </button>
                  )}
                  <button
                    onClick={() => { insertMedia(contextMenu.row!, contextMenu.col, 'image'); setContextMenu(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <ImageIcon size={16} className="text-green-500" />
                    <span>Upload & Insert Image</span>
                  </button>
                  <button
                    onClick={() => { insertMedia(contextMenu.row!, contextMenu.col, 'file'); setContextMenu(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <Paperclip size={16} className="text-amber-500" />
                    <span>Attach Document File</span>
                  </button>
                  {hasAttachments && (
                    <button
                      onClick={() => {
                        removeCellMetadata(contextMenu.row!, contextMenu.col);
                        setContextMenu(null);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-500 flex items-center gap-3 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} />
                      <span>Remove Attachments</span>
                    </button>
                  )}
                </div>

                <div className="h-px bg-border/50" />

                {/* Collapsible Format Sections */}
                <div className="flex flex-col gap-2.5">
                  <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1 font-mono">Cell Formatting</span>
                  
                  {/* Date format accordion */}
                  <div className="flex flex-col bg-muted/5 border border-border/30 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setMobileMenuSubSection(mobileMenuSubSection === 'formats' ? null : 'formats')}
                      className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-foreground hover:bg-muted/10 transition-colors"
                    >
                      <span className="flex items-center gap-3"><Calendar size={16} className="text-accent" /> Date Formatting</span>
                      <ChevronDown size={14} className={`text-muted transition-transform ${mobileMenuSubSection === 'formats' ? 'rotate-180' : ''}`} />
                    </button>
                    {mobileMenuSubSection === 'formats' && (
                      <div className="bg-muted/10 border-t border-border/20 p-2 grid grid-cols-2 gap-1.5">
                        <button onClick={() => { setCellType(contextMenu.row!, contextMenu.col, 'text'); setContextMenu(null); }} className="px-3 py-2 bg-card border border-border/40 rounded-lg text-xs font-bold text-foreground text-center">Default Text</button>
                        {DATE_FORMATS.map(f => (
                          <button key={f.id} onClick={() => { setCellType(contextMenu.row!, contextMenu.col, 'date', f.id); setContextMenu(null); }} className="px-3 py-2 bg-card border border-border/40 rounded-lg text-xs font-bold text-foreground text-center truncate">{f.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Number format accordion */}
                  <div className="flex flex-col bg-muted/5 border border-border/30 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setMobileMenuSubSection(mobileMenuSubSection === 'numbers' ? null : 'numbers')}
                      className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-foreground hover:bg-muted/10 transition-colors"
                    >
                      <span className="flex items-center gap-3"><TableIcon size={16} className="text-green-500" /> Number Formatting</span>
                      <ChevronDown size={14} className={`text-muted transition-transform ${mobileMenuSubSection === 'numbers' ? 'rotate-180' : ''}`} />
                    </button>
                    {mobileMenuSubSection === 'numbers' && (
                      <div className="bg-muted/10 border-t border-border/20 p-2 grid grid-cols-2 gap-1.5">
                        {NUMBER_FORMATS.map(f => (
                          <button key={f.id} onClick={() => { setCellType(contextMenu.row!, contextMenu.col, 'number', f.id); setContextMenu(null); }} className="px-3 py-2 bg-card border border-border/40 rounded-lg text-xs font-bold text-foreground text-center truncate">{f.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Formula format accordion */}
                  <div className="flex flex-col bg-muted/5 border border-border/30 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setMobileMenuSubSection(mobileMenuSubSection === 'formulas' ? null : 'formulas')}
                      className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-foreground hover:bg-muted/10 transition-colors"
                    >
                      <span className="flex items-center gap-3"><Sigma size={16} className="text-purple-500" /> Formula Formats</span>
                      <ChevronDown size={14} className={`text-muted transition-transform ${mobileMenuSubSection === 'formulas' ? 'rotate-180' : ''}`} />
                    </button>
                    {mobileMenuSubSection === 'formulas' && (
                      <div className="bg-muted/10 border-t border-border/20 p-2 flex flex-col gap-1.5">
                        <button onClick={() => { setCellType(contextMenu.row!, contextMenu.col, 'formula'); setContextMenu(null); }} className="px-3 py-2 bg-card border border-border/40 rounded-lg text-xs font-bold text-foreground text-left">Standard (Sum/Number)</button>
                        <div className="h-px bg-border/30 my-0.5 mx-1" />
                        <span className="text-[8px] font-black text-muted uppercase tracking-widest px-2">Date Result Format</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {DATE_FORMATS.map(f => (
                            <button key={f.id} onClick={() => { setCellType(contextMenu.row!, contextMenu.col, 'formula', f.id); setContextMenu(null); }} className="px-3 py-2 bg-card border border-border/40 rounded-lg text-xs font-bold text-foreground text-center truncate">{f.label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </MobileBottomSheet>
          );
        })()}

        {/* Column Context Menu (Mobile Bottom Sheet) */}
        {contextMenu && isMobile && contextMenu.type === 'header' && (() => {
          const defaultAlign = (contextMenu.col === "Title / Item" || contextMenu.col === "Amount") ? "right" : "left";
          const currentAlign = cellAlignments[`header:${contextMenu.col}`] || columnAlignments[contextMenu.col] || defaultAlign;

          return (
            <MobileBottomSheet
              isOpen={true}
              onClose={() => setContextMenu(null)}
              title={`Column Options: ${contextMenu.col}`}
            >
              <div className="flex flex-col gap-4 bg-card/50">
                {/* Headers locking and freezing */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1 font-mono">Header Locking</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setIsFreezeHeaders(!isFreezeHeaders); setContextMenu(null); }}
                      className="flex-1 py-2.5 bg-muted/5 border border-border/40 rounded-xl text-xs font-bold text-foreground flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      {isFreezeHeaders ? <Minimize2 size={14} className="text-accent" /> : <Maximize2 size={14} className="text-muted" />}
                      <span>{isFreezeHeaders ? 'Unfreeze Headers' : 'Freeze Headers'}</span>
                    </button>
                    <button
                      onClick={() => { setIsFreezePanes(!isFreezePanes); setContextMenu(null); }}
                      className="flex-1 py-2.5 bg-muted/5 border border-border/40 rounded-xl text-xs font-bold text-foreground flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      {isFreezePanes ? <Minimize2 size={14} className="text-accent" /> : <Maximize2 size={14} className="text-muted" />}
                      <span>{isFreezePanes ? 'Unfreeze Panes' : 'Freeze Panes'}</span>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Alignment segment control */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] font-mono">Alignment</span>
                    <div className="flex bg-muted/20 p-0.5 rounded-xl border border-border/30 w-36">
                      {(['left', 'center', 'right'] as const).map((a) => {
                        const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                        const active = currentAlign === a;
                        return (
                          <button
                            key={a}
                            onClick={() => {
                              setColumnAlignment(contextMenu.col, a);
                            }}
                            title={`${a.charAt(0).toUpperCase() + a.slice(1)} Alignment`}
                            className={`flex-1 py-1.5 flex justify-center items-center rounded-lg transition-all cursor-pointer ${
                              active
                                ? 'bg-card text-accent shadow-sm border border-border/20 font-bold'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <Icon size={14} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Font selector Accordion */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1 font-mono">Styling</span>
                  <div className="flex flex-col bg-muted/5 border border-border/30 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setMobileMenuSubSection(mobileMenuSubSection === 'formats' ? null : 'formats')}
                      className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-foreground hover:bg-muted/10 transition-colors"
                    >
                      <span className="flex items-center gap-3"><Type size={16} className="text-accent" /> Set Column Font</span>
                      <ChevronDown size={14} className={`text-muted transition-transform ${mobileMenuSubSection === 'formats' ? 'rotate-180' : ''}`} />
                    </button>
                    {mobileMenuSubSection === 'formats' && (
                      <div className="bg-muted/10 border-t border-border/20 p-2 grid grid-cols-2 gap-1.5">
                        {FONT_FAMILIES.map(f => (
                          <button
                            key={f.id}
                            onClick={() => {
                              setCellFontFamily(-1, contextMenu.col, f.value);
                              setContextMenu(null);
                            }}
                            className="px-3 py-2 bg-card border border-border/40 rounded-lg text-xs font-bold text-foreground text-center truncate"
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Column Structure operations */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1 font-mono">Grid Actions</span>
                  {selColSpan > 1 && (
                    <button
                      onClick={() => { handleMergeCells(visibleHeaders, true); setContextMenu(null); }}
                      className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                    >
                      <TableIcon size={16} className="text-accent" />
                      <span>Merge Selected Headers</span>
                    </button>
                  )}
                  {cellMetadata[`header:${contextMenu.col}`]?.colSpan > 1 && (
                    <button
                      onClick={() => { handleUnmergeCells(-1, contextMenu.col, visibleHeaders); setContextMenu(null); }}
                      className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                    >
                      <X size={16} className="text-orange-500" />
                      <span>Unmerge Header</span>
                    </button>
                  )}
                  <button
                    onClick={() => { toggleColumnVisibility(contextMenu.col); setContextMenu(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <EyeOff size={16} />
                    <span>Hide Column</span>
                  </button>
                  <button
                    onClick={() => { handleInsertColumn(contextMenu.col, 'before'); setContextMenu(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <Plus size={16} className="text-accent" />
                    <span>Insert Column Before</span>
                  </button>
                  <button
                    onClick={() => { handleInsertColumn(contextMenu.col, 'after'); setContextMenu(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <Plus size={16} className="text-accent" />
                    <span>Insert Column After</span>
                  </button>
                  <button
                    onClick={() => { handleClearColumn(contextMenu.col); setContextMenu(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <X size={16} className="text-orange-500" />
                    <span>Clear Column Content</span>
                  </button>
                </div>

                <div className="h-px bg-border/50" />

                {/* Destructive actions */}
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => { handleDeleteColumn(contextMenu.col); setContextMenu(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-500 flex items-center gap-3 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} />
                    <span>Delete Column</span>
                  </button>
                </div>
              </div>
            </MobileBottomSheet>
          );
        })()}

        {/* Row Context Menu (Mobile Bottom Sheet) */}
        {contextMenu && isMobile && contextMenu.type === 'row' && (() => {
          return (
            <MobileBottomSheet
              isOpen={true}
              onClose={() => setContextMenu(null)}
              title={`Row Options: Row ${contextMenu.row! + 1}`}
            >
              <div className="flex flex-col gap-4 bg-card/50">
                {/* Row insertion actions */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1 font-mono">Row Insertions</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { handleInsertRow(contextMenu.row!, 'above'); setContextMenu(null); }}
                      className="flex-1 py-2.5 bg-muted/5 border border-border/40 rounded-xl text-xs font-bold text-foreground flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus size={14} className="text-accent" />
                      <span>Insert Above</span>
                    </button>
                    <button
                      onClick={() => { handleInsertRow(contextMenu.row!, 'after'); setContextMenu(null); }}
                      className="flex-1 py-2.5 bg-muted/5 border border-border/40 rounded-xl text-xs font-bold text-foreground flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus size={14} className="text-accent" />
                      <span>Insert Below</span>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                {/* Section actions */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1 font-mono">Section Actions</span>
                  <button
                    onClick={() => {
                      const section = gridData.get(`${contextMenu.row}:section`) || "";
                      handleInsertSection(section, 'before', contextMenu.row);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <FolderPlus size={16} className="text-accent" />
                    <span>Insert Section Above</span>
                  </button>
                  <button
                    onClick={() => {
                      const section = gridData.get(`${contextMenu.row}:section`) || "";
                      handleInsertSection(section, 'after', contextMenu.row);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <FolderPlus size={16} className="text-accent" />
                    <span>Insert Section Below</span>
                  </button>
                  <button
                    onClick={() => {
                      const section = gridData.get(`${contextMenu.row}:section`) || "";
                      addRowToSection(section);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <Plus size={16} className="text-accent" />
                    <span>Add Row to Section</span>
                  </button>
                </div>

                <div className="h-px bg-border/50" />

                {/* Content Actions & Destructive actions */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em] px-1 font-mono">Row Maintenance</span>
                  <button
                    onClick={() => { handleClearRow(contextMenu.row!); setContextMenu(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/10 flex items-center gap-3 text-sm font-semibold rounded-xl text-foreground transition-colors cursor-pointer"
                  >
                    <X size={16} className="text-orange-500" />
                    <span>Clear Row Content</span>
                  </button>
                  <button
                    onClick={() => { removeTableRow(contextMenu.row!); setContextMenu(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-500 flex items-center gap-3 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} />
                    <span>Delete Row</span>
                  </button>
                </div>
              </div>
            </MobileBottomSheet>
          );
        })()}

        {/* Hidden File Input for Media Uploads */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept={pendingMedia?.type === 'image' ? "image/*" : "*/*"}
        />

        {/* Formula Bar - Relocated for a cleaner grid view */}
        <div className={`${GRID_THEME.formulaBar} min-h-9.5 flex-nowrap`}>
          <div
            id="address-indicator"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/10 rounded border border-border text-[10px] font-black text-muted tracking-tighter min-w-14 md:min-w-30 justify-center shadow-sm mt-0.5 shrink-0"
          >
            {activeCell ? toA1Key(activeCell.row, visibleHeaders.indexOf(activeCell.col)) : 'Select...'}
          </div>
          <div className="h-4 w-px bg-border mx-1 self-center shrink-0"></div>
          <div className="flex items-center gap-1 px-1 sm:px-2 text-purple-500 mt-1 shrink-0">
            <Sigma size={14} className="shrink-0" />
            <span className="text-[10px] font-bold tracking-widest opacity-50 hidden sm:inline">Formula</span>
          </div>
          <textarea
            ref={formulaBarRef}
            rows={1}
            placeholder="Enter value or formula..."
            value={editingValue}
            onChange={(e) => {
              const val = e.target.value;
              setEditingValue(val);
              if (activeCell) {
                handleUpdateCell(activeCell.row, activeCell.col, val);
              }
            }}
            className={`flex-1 bg-transparent border-0 outline-none text-sm font-mono text-foreground placeholder:text-muted/30 placeholder:italic resize-none py-1 min-w-0 ${
              isFormulaExpanded 
                ? 'overflow-y-auto max-h-14 md:max-h-32' 
                : 'overflow-hidden h-7 max-h-7 whitespace-nowrap'
            }`}
          />
          <button
            onClick={() => setIsFormulaExpanded(!isFormulaExpanded)}
            className="p-1 hover:bg-muted/15 rounded text-muted hover:text-foreground shrink-0 cursor-pointer self-center mt-0.5"
            title={isFormulaExpanded ? "Collapse Formula Bar" : "Expand Formula Bar"}
          >
            {isFormulaExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Deterministic progress bar */}
        {isLoadingFile && (
          <div className="absolute top-0 left-0 right-0 z-50 h-[2px] overflow-hidden bg-border">
            <div
              className="h-full bg-accent transition-all duration-150 ease-out"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
        )}

        <div
          ref={tableContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-x-auto overflow-y-scroll relative custom-scrollbar-zoomed"
          style={{
            scrollbarGutter: 'stable',
            overflowAnchor: 'none',
            willChange: 'scroll-position',
            '--grid-scrollbar-size': `${Math.max(8, 12 * zoom)}px`,
          } as any}
        >
          {/* Real grid — slide-up-fade on mount, keyed per file */}
          {!isLoadingFile && (
            <div key={gridKey} className="slide-up-fade contents">
              {/* Virtual Scroll Spacer */}
              <div style={{ height: totalVirtualHeight * zoom, width: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />

              <table
                className="w-full border-separate border-spacing-0 table-auto min-w-full origin-top-left absolute left-0 top-0"
                style={{
                  zoom: zoom,
                } as any}
              >
                <thead className={GRID_THEME.tableHeader}>
                  <tr className={`${GRID_THEME.tableHeaderRow} relative z-40 bg-card shadow-sm`}>
                    <th
                      onClick={() => {
                        if (rowCount > 0 && visibleHeaders.length > 0) {
                          setSelection({
                            startRow: -1,
                            endRow: rowCount - 1,
                            startCol: visibleHeaders[0],
                            endCol: visibleHeaders[visibleHeaders.length - 1]
                          });
                          setActiveCell({ row: 0, col: visibleHeaders[0] });
                        }
                      }}
                      className={`w-10 min-w-10 h-5 shadow-[inset_-1px_-1px_0_var(--color-border)] cursor-pointer hover:bg-muted/30 ${GRID_THEME.tableIndexCell} sticky left-0 z-50 bg-card shadow-[1px_0_0_0_var(--color-border),0_1px_0_0_var(--color-border)] ${isFreezeHeaders ? 'top-0' : ''
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
                              setSelection((prev: any) => prev ? { ...prev, endCol: header } : null);
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
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
                          className={`relative group/col-index text-[9px] font-black border-r border-b border-border h-5 text-center uppercase tracking-tighter cursor-pointer bg-card ${isFreezeHeaders ? 'sticky top-0 z-40' : ''} ${isColumnActive || isInHeaderLabelSelection ? 'active-header' : 'text-muted hover:bg-muted/30 hover:text-foreground'
                            } ${isInHeaderLabelSelection ? 'bg-accent/30' : ''} ${isFreezePanes && header === "Title / Item" ? `sticky left-10 z-50 shadow-[1px_0_0_0_var(--color-border)] ${isColumnActive ? 'bg-accent/20' : 'bg-muted/10'}` : ""
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
                    <th className={`w-10 min-w-10 ${GRID_THEME.tableIndexCell} bg-card sticky left-0 z-30 shadow-[1px_0_0_0_var(--color-border),0_1px_0_0_var(--color-border)] ${isFreezeHeaders ? 'top-[20px]' : ''
                      }`}></th>
                    {visibleHeaders.map((header, colIdx) => {
                      const headerMeta = cellMetadata[`header:${header}`] || {};
                      const isColumnActive = activeCell?.col === header;

                      if (headerMeta.mergedIn) return null;

                      const defaultAlign = (header === "Title / Item" || header === "Amount") ? "right" : "left";
                      const align = cellAlignments[`header:${header}`] || columnAlignments[header] || defaultAlign;
                      const alignClass = align === 'center' ? 'text-center' :
                        align === 'right' ? 'text-right' : 'text-left';

                      const isInHeaderSelection = isHeaderInSelection(colIdx);

                      return (
                        <th
                          key={header}
                          colSpan={headerMeta.colSpan}
                          onContextMenu={(e) => {
                            e.preventDefault();
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
                              setSelection((prev: any) => prev ? { ...prev, endCol: header } : null);
                            }
                          }}
                          style={{
                            width: columnWidths[header] ? `${columnWidths[header]}px` : undefined,
                            minWidth: columnWidths[header] ? `${columnWidths[header]}px` : '120px'
                          }}
                          className={`group/header px-2 py-1 text-[11px] font-bold tracking-tight border-r border-b border-border relative antialiased ${isFreezeHeaders ? 'sticky top-[20px] z-30 shadow-sm' : ''} ${isColumnActive ? 'text-accent bg-accent/10' : 'text-muted bg-card'
                            } ${isFreezePanes && header === "Title / Item" ? "sticky left-10 z-40 shadow-[1px_0_0_0_var(--color-border)]" : ""
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
                    <th className={`p-2 min-w-35 border-r border-b border-border bg-card ${isFreezeHeaders ? 'sticky top-[20px] z-30' : ''
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
                  <tr style={{ height: `${translateY}px` }} className="border-none">
                    <td colSpan={visibleHeaders.length + 2} className="p-0 border-none" />
                  </tr>
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
                        onLocalEditing={handleLocalEditing}
                      />
                    );
                  })}
                  <tr style={{ height: '20px' }} className="border-none">
                    <td colSpan={visibleHeaders.length + 2} className="p-0 border-none" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

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
