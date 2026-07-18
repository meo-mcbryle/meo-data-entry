import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Save, Loader2, History, Copy, Clipboard, Type, Bold, Italic, Underline,
  X, AlignLeft, AlignCenter, AlignRight, AlignJustify, Plus, RefreshCcw,
  FolderPlus, Image as ImageIcon, Paperclip, Calendar, Sigma, Search,
  HardDrive, ZoomOut, ZoomIn, ChevronDown, ChevronRight as ChevronRightIcon,
  Minimize2, Maximize2, Table as TableIcon, Code, Sliders, Share2, Printer
} from 'lucide-react';
import { useSpreadsheetOperations } from '@/hooks/useSpreadsheetOperations';
import { GRID_THEME, FONT_FAMILIES, NUMBER_FORMATS } from '@/lib/constants';
import { toA1Key } from '@/lib/excel-utils';

interface RibbonMenuProps {
  spreadsheet: ReturnType<typeof useSpreadsheetOperations>;
  activeRibbonTab: 'home' | 'insert' | 'formulas' | 'data' | 'view' | 'tools';
  setActiveRibbonTab: React.Dispatch<React.SetStateAction<'home' | 'insert' | 'formulas' | 'data' | 'view' | 'tools'>>;
  rowFilter: string;
  setRowFilter: (val: string) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  isFreezeHeaders: boolean;
  setIsFreezeHeaders: React.Dispatch<React.SetStateAction<boolean>>;
  isFreezePanes: boolean;
  setIsFreezePanes: React.Dispatch<React.SetStateAction<boolean>>;
  isFullScreen: boolean;
  setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  handleCopyLink: () => void;
  setViewMode: (mode: 'code' | 'table' | 'compare' | 'logs' | 'trash') => void;
  selectedId: string | null;
  handleAutoFitColumnWidths: () => void;
  setRowHeights: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  toggleCellFormat: (field: 'bold' | 'italic' | 'underline') => void;
  isActiveCellFormat: (field: 'bold' | 'italic' | 'underline') => boolean;
}

export const RibbonMenu = ({
  spreadsheet,
  activeRibbonTab,
  setActiveRibbonTab,
  rowFilter,
  setRowFilter,
  zoom,
  setZoom,
  isFreezeHeaders,
  setIsFreezeHeaders,
  isFreezePanes,
  setIsFreezePanes,
  isFullScreen,
  setIsFullScreen,
  handleCopyLink,
  setViewMode,
  selectedId,
  handleAutoFitColumnWidths,
  setRowHeights,
  toggleCellFormat,
  isActiveCellFormat
}: RibbonMenuProps) => {
  const {
    undoStack,
    redoStack,
    undo,
    redo,
    handleAddSection,
    exportToCSV,
    handleMergeCells,
    setColumnAlignment,
    handleInsertRow,
    setCellType,
    setSelectionAlignment,
    insertMedia,
    handleCopyCells,
    handlePasteCells,
    handleSave,
    isSaving,
    hasUnsavedChanges,
    activeCell,
    selection,
    visibleHeaders,
    masterColumnOrder,
    cellMetadata,
    setCellFontFamily,
    cellAlignments,
    columnAlignments,
    selectedYear,
    setSelectedYear,
    allHeaders,
    hiddenColumns,
    toggleColumnVisibility
  } = spreadsheet;

  const [columnsMenu, setColumnsMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (e.target instanceof Element) {
        if (e.target.closest('.columns-menu-container') || e.target.closest('.columns-menu-trigger')) {
          return;
        }
      }
      setColumnsMenu(null);
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
    };
  }, []);

  const handleToggleColumnsMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (columnsMenu) {
      setColumnsMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setColumnsMenu({
        x: rect.left,
        y: rect.bottom + window.scrollY + 4
      });
    }
  };

  console.log("RibbonMenu Render: allHeaders =", allHeaders, "hiddenColumns =", hiddenColumns);

  return (
    <div className="hidden md:flex flex-col bg-card/45 border-b border-border/40 shrink-0 z-20">
      {/* Ribbon Content Panel */}
      <div className="flex items-stretch bg-card/10 h-20 py-1.5 px-3 overflow-x-auto no-scrollbar gap-4 text-xs select-none">
        {activeRibbonTab === 'home' && (
          <>
            {/* Undo/Redo & Clipboard Group */}
            <div className="flex flex-col justify-between border-r border-border/40 pr-3 mr-1">
              <div className="flex items-center gap-1.5 h-full">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !hasUnsavedChanges}
                  className={`p-1.5 rounded-md transition-all flex flex-col items-center justify-center gap-0.5 w-10 shrink-0 active:scale-95 cursor-pointer ${
                    hasUnsavedChanges
                      ? 'bg-amber-600/10 text-amber-500 hover:bg-amber-600/20 border border-amber-500/20 animate-pulse-subtle'
                      : 'text-muted hover:text-accent disabled:opacity-30'
                  }`}
                  title={hasUnsavedChanges ? "Save Changes" : "All changes saved"}
                >
                  {isSaving ? (
                    <Loader2 size={15} className="animate-spin text-accent" />
                  ) : (
                    <Save size={15} />
                  )}
                  <span className="text-[9px] scale-90 font-medium">Save</span>
                </button>
                <div className="w-px bg-border/40 h-6 self-center mx-1"></div>
                <button
                  disabled={undoStack.length === 0}
                  onClick={undo}
                  className="p-1.5 hover:bg-muted/20 rounded-md text-muted hover:text-accent transition-all disabled:opacity-30 cursor-pointer flex flex-col items-center justify-center gap-0.5 w-10 shrink-0 active:scale-95"
                  title="Undo (Ctrl+Z)"
                >
                  <History size={15} className="rotate-180 flip-y" />
                  <span className="text-[9px] scale-90 font-medium">Undo</span>
                </button>
                <button
                  disabled={redoStack.length === 0}
                  onClick={redo}
                  className="p-1.5 hover:bg-muted/20 rounded-md text-muted hover:text-accent transition-all disabled:opacity-30 cursor-pointer flex flex-col items-center justify-center gap-0.5 w-10 shrink-0 active:scale-95"
                  title="Redo (Ctrl+Y)"
                >
                  <History size={15} />
                  <span className="text-[9px] scale-90 font-medium">Redo</span>
                </button>
                <div className="w-px bg-border/40 h-6 self-center mx-1"></div>
                <button
                  onClick={() => {
                    if (activeCell) {
                      handleCopyCells(selection, { row: activeCell.row, col: activeCell.col }, visibleHeaders);
                    }
                  }}
                  disabled={!activeCell}
                  className="p-1.5 hover:bg-muted/20 rounded-md text-muted hover:text-accent transition-all disabled:opacity-30 cursor-pointer flex flex-col items-center justify-center gap-0.5 w-10 shrink-0 active:scale-95"
                  title="Copy selected cells"
                >
                  <Copy size={15} />
                  <span className="text-[9px] scale-90 font-medium">Copy</span>
                </button>
                <button
                  onClick={() => {
                    if (activeCell) {
                      handlePasteCells({ row: activeCell.row, col: activeCell.col }, visibleHeaders);
                    }
                  }}
                  disabled={!activeCell}
                  className="p-1.5 hover:bg-muted/20 rounded-md text-muted hover:text-accent transition-all disabled:opacity-30 cursor-pointer flex flex-col items-center justify-center gap-0.5 w-10 shrink-0 active:scale-95"
                  title="Paste clipboard content"
                >
                  <Clipboard size={15} />
                  <span className="text-[9px] scale-90 font-medium">Paste</span>
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">File & Clipboard</span>
            </div>

            {/* Font Formatting Group */}
            <div className="flex flex-col justify-between border-r border-border/40 pr-3 mr-1">
              <div className="flex items-center gap-2 h-full">
                {/* Font Family selector */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border/60 rounded text-xs font-semibold h-8">
                  <Type size={13} className="text-muted" />
                  <select
                    value={(() => {
                      if (!activeCell) return "";
                      const mIdx = masterColumnOrder.indexOf(activeCell.col);
                      const key = toA1Key(activeCell.row, mIdx);
                      return cellMetadata[key]?.fontFamily || "";
                    })()}
                    onChange={(e) => activeCell && setCellFontFamily(activeCell.row, activeCell.col, e.target.value)}
                    className="bg-transparent border-0 font-bold text-accent focus:ring-0 cursor-pointer max-w-28 dark:bg-card text-xs focus:outline-none"
                  >
                    <option value="">Font Family...</option>
                    {FONT_FAMILIES.map(f => (
                      <option key={f.id} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>

                {/* Bold/Italic/Underline triggers */}
                <div className="flex bg-muted/20 p-0.5 rounded-md border border-border/40 h-8 items-center">
                  <button
                    disabled={!activeCell}
                    onClick={() => toggleCellFormat('bold')}
                    className={`p-1 w-6 h-6 flex items-center justify-center rounded text-xs font-bold transition-all ${
                      isActiveCellFormat('bold')
                        ? 'bg-accent/20 text-accent font-black border border-accent/20'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Bold (Ctrl+B)"
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    disabled={!activeCell}
                    onClick={() => toggleCellFormat('italic')}
                    className={`p-1 w-6 h-6 flex items-center justify-center rounded text-xs font-bold transition-all ${
                      isActiveCellFormat('italic')
                        ? 'bg-accent/20 text-accent font-black border border-accent/20'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Italic (Ctrl+I)"
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    disabled={!activeCell}
                    onClick={() => toggleCellFormat('underline')}
                    className={`p-1 w-6 h-6 flex items-center justify-center rounded text-xs font-bold transition-all ${
                      isActiveCellFormat('underline')
                        ? 'bg-accent/20 text-accent font-black border border-accent/20'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Underline (Ctrl+U)"
                  >
                    <Underline size={13} />
                  </button>
                </div>

                {/* Clear Cell metadata */}
                <button
                  disabled={!activeCell}
                  onClick={() => {
                    if (activeCell) {
                      spreadsheet.removeCellMetadata(activeCell.row, activeCell.col);
                    }
                  }}
                  className="p-1.5 hover:bg-muted/20 rounded-md text-muted hover:text-red-500 transition-all disabled:opacity-30 cursor-pointer flex flex-col items-center justify-center gap-0.5 w-10 shrink-0 active:scale-95"
                  title="Clear formatting"
                >
                  <X size={14} className="text-red-500" />
                  <span className="text-[9px] scale-90 font-medium">Clear</span>
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">Font</span>
            </div>

            {/* Alignment Group */}
            <div className="flex flex-col justify-between border-r border-border/40 pr-3 mr-1">
              <div className="flex items-center gap-1.5 h-full">
                <div className="flex bg-muted/20 p-0.5 rounded-md border border-border/40 h-8 items-center w-32">
                  {(['left', 'center', 'right', 'justify'] as const).map((a) => {
                    const Icon =
                      a === 'left'
                        ? AlignLeft
                        : a === 'center'
                        ? AlignCenter
                        : a === 'right'
                        ? AlignRight
                        : AlignJustify;
                    const defaultAlign =
                      activeCell?.col === "Title / Item" || activeCell?.col === "Amount"
                        ? "right"
                        : "left";
                    const key = activeCell
                      ? toA1Key(activeCell.row, masterColumnOrder.indexOf(activeCell.col))
                      : '';
                    const active = activeCell && (cellAlignments[key] || defaultAlign) === a;
                    return (
                      <button
                        key={a}
                        disabled={!activeCell}
                        onClick={() => setSelectionAlignment(a)}
                        title={`${a.charAt(0).toUpperCase() + a.slice(1)} Alignment`}
                        className={`flex-1 h-6 flex justify-center items-center rounded transition-colors disabled:opacity-30 ${
                          active
                            ? 'bg-accent/20 text-accent font-bold border border-accent/20'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon size={13} />
                      </button>
                    );
                  })}
                </div>

                {/* Merge Cells triggers if selection exists */}
                {selection &&
                  (Math.abs(selection.startRow - selection.endRow) > 0 ||
                    Math.abs(
                      visibleHeaders.indexOf(selection.startCol) - visibleHeaders.indexOf(selection.endCol)
                    ) > 0) && (
                    <button
                      onClick={() => handleMergeCells(visibleHeaders)}
                      className="p-1 hover:bg-accent/10 rounded-md text-accent hover:text-accent border border-accent/20 font-bold px-2 py-1 text-[10px] shrink-0 active:scale-95"
                    >
                      Merge
                    </button>
                  )}
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">Alignment</span>
            </div>

            {/* Cells / Structure Group */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5 h-full">
                <button
                  onClick={handleAddSection}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer active:scale-95"
                >
                  <Plus size={13} className="text-accent" />
                  <span>Add Section</span>
                </button>
                <button
                  onClick={handleAutoFitColumnWidths}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer active:scale-95"
                  title="Auto-fit all column widths"
                >
                  <RefreshCcw size={13} className="text-muted" />
                  <span>AutoFit Cols</span>
                </button>
                <button
                  onClick={() => setRowHeights({})}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer active:scale-95"
                  title="Reset all row heights"
                >
                  <RefreshCcw size={13} className="text-muted" />
                  <span>AutoFit Rows</span>
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">Cells</span>
            </div>
          </>
        )}

        {activeRibbonTab === 'insert' && (
          <>
            {/* Sections & Rows Group */}
            <div className="flex flex-col justify-between border-r border-border/40 pr-3 mr-1">
              <div className="flex items-center gap-1.5 h-full">
                <button
                  onClick={handleAddSection}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer active:scale-95"
                >
                  <FolderPlus size={14} className="text-accent" />
                  <span>Add Section</span>
                </button>
                {activeCell && (
                  <button
                    onClick={() => handleInsertRow(activeCell.row, 'above')}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer active:scale-95"
                  >
                    <Plus size={13} className="text-muted" />
                    <span>Insert Row</span>
                  </button>
                )}
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">Tables</span>
            </div>

            {/* Media & Attachments Group */}
            <div className="flex flex-col justify-between border-r border-border/40 pr-3 mr-1">
              <div className="flex items-center gap-1.5 h-full">
                <button
                  disabled={!activeCell}
                  onClick={() => {
                    if (activeCell) {
                      insertMedia(activeCell.row, activeCell.col, 'image');
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer disabled:opacity-30 active:scale-95"
                  title="Add image attachment to active cell"
                >
                  <ImageIcon size={14} className="text-blue-500" />
                  <span>Image</span>
                </button>
                <button
                  disabled={!activeCell}
                  onClick={() => {
                    if (activeCell) {
                      insertMedia(activeCell.row, activeCell.col, 'file');
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer disabled:opacity-30 active:scale-95"
                  title="Add file attachment to active cell"
                >
                  <Paperclip size={14} className="text-amber-500" />
                  <span>File Document</span>
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">Media</span>
            </div>

            {/* Controls & Pickers Group */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5 h-full">
                <button
                  disabled={!activeCell}
                  onClick={() => {
                    if (activeCell) {
                      setCellType(activeCell.row, activeCell.col, 'date');
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer disabled:opacity-30 active:scale-95"
                  title="Insert a Date picker calendar in the cell"
                >
                  <Calendar size={14} className="text-rose-500" />
                  <span>Date Calendar</span>
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">Controls</span>
            </div>
          </>
        )}

        {activeRibbonTab === 'formulas' && (
          <>
            {/* Function Info Group */}
            <div className="flex flex-col justify-between border-r border-border/40 pr-3 mr-1">
              <div className="flex items-center gap-2.5 h-full">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/10 rounded border border-border/60 text-[10px] font-black text-muted tracking-tighter min-w-16 h-8 justify-center shadow-sm">
                  <span className="text-muted-foreground">Active:</span>
                  <span className="text-accent font-bold">
                    {activeCell ? toA1Key(activeCell.row, visibleHeaders.indexOf(activeCell.col)) : 'Select...'}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-1 sm:px-2 text-purple-500 shrink-0">
                  <Sigma size={14} />
                  <span className="text-[10px] font-bold tracking-widest opacity-70">fx</span>
                </div>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">
                Function Info
              </span>
            </div>

            {/* Output formats group */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5 h-full">
                {/* Number Formats selection */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border/60 rounded text-xs font-semibold h-8">
                  <span className="text-muted">Type:</span>
                  <select
                    value=""
                    onChange={(e) => {
                      if (activeCell && e.target.value) {
                        setCellType(activeCell.row, activeCell.col, 'number', e.target.value);
                      }
                      e.target.value = '';
                    }}
                    disabled={!activeCell}
                    className="bg-transparent border-0 font-bold text-accent focus:ring-0 cursor-pointer max-w-28 dark:bg-card text-xs focus:outline-none"
                  >
                    <option value="">Select Formatting...</option>
                    {NUMBER_FORMATS.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Formula standard formats trigger */}
                <button
                  disabled={!activeCell}
                  onClick={() => {
                    if (activeCell) {
                      setCellType(activeCell.row, activeCell.col, 'formula');
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer disabled:opacity-30 active:scale-95"
                >
                  <Sigma size={13} className="text-purple-500" />
                  <span>Sum Standard Formula</span>
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">
                Formulas Formatting
              </span>
            </div>
          </>
        )}

        {activeRibbonTab === 'data' && (
          <>
            {/* Sort & Filter Group */}
            <div className="flex flex-col justify-between border-r border-border/40 pr-3 mr-1">
              <div className="flex items-center gap-1.5 h-full">
                <div className="relative flex-1 max-w-sm shrink-0">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={rowFilter}
                    onChange={(e) => setRowFilter(e.target.value)}
                    className="w-48 pl-8 pr-3 py-1 text-xs border border-border/60 rounded focus:ring-1 focus:ring-accent outline-none bg-background text-foreground placeholder:text-muted/50 h-8"
                  />
                </div>

                <div className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border/60 rounded text-xs font-semibold h-8 shrink-0">
                  <span className="text-muted">Year:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-transparent border-0 font-bold text-accent focus:ring-0 cursor-pointer dark:bg-card text-xs focus:outline-none"
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
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">
                Sort & Filter
              </span>
            </div>

            {/* Connections / Transfer Group */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5 h-full">
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer active:scale-95"
                >
                  <HardDrive size={14} className="text-accent" />
                  <span>Export CSV</span>
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">
                Data Tools
              </span>
            </div>
          </>
        )}

        {activeRibbonTab === 'view' && (
          <>
            {/* Zoom group */}
            <div className="flex flex-col justify-between border-r border-border/40 pr-3 mr-1">
              <div className="flex items-center gap-1 px-1.5 py-1 bg-card border border-border/60 rounded text-xs font-semibold h-8 shrink-0 animate-in fade-in duration-300">
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  className="p-0.5 hover:bg-muted/20 rounded text-muted hover:text-accent transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="w-10 text-center font-bold text-accent select-none hover:bg-muted/10 rounded transition-colors cursor-pointer text-xs"
                  title="Reset Zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                  className="p-0.5 hover:bg-muted/20 rounded text-muted hover:text-accent transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">Zoom</span>
            </div>

            {/* Window freeze options */}
            <div className="flex flex-col justify-between border-r border-border/40 pr-3 mr-1">
              <div className="flex items-center gap-1.5 h-full">
                <button
                  onClick={() => setIsFreezeHeaders(!isFreezeHeaders)}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-all text-xs font-semibold h-8 border cursor-pointer active:scale-95 ${
                    isFreezeHeaders
                      ? 'bg-accent/10 border-accent/30 text-accent font-bold'
                      : 'text-muted border-border/60 hover:bg-muted/10'
                  }`}
                  title="Toggle Freeze Headers (Vertical scroll stay)"
                >
                  <ChevronDown size={14} className={isFreezeHeaders ? "" : "rotate-180"} />
                  <span>Freeze Headers</span>
                </button>
                <button
                  onClick={() => setIsFreezePanes(!isFreezePanes)}
                  className={`flex items-center gap-1 px-2 py-1 rounded transition-all text-xs font-semibold h-8 border cursor-pointer active:scale-95 ${
                    isFreezePanes
                      ? 'bg-accent/10 border-accent/30 text-accent font-bold'
                      : 'text-muted border-border/60 hover:bg-muted/10'
                  }`}
                  title="Toggle Freeze Panes (Horizontal scroll stay)"
                >
                  <ChevronRightIcon size={14} />
                  <span>Freeze Panes</span>
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">
                Window Pane
              </span>
            </div>

            {/* Columns Visibility Group */}
            <div className="flex flex-col justify-between border-r border-border/40 pr-3 mr-1">
              <div className="flex items-center gap-1.5 h-full">
                <button
                  onClick={handleToggleColumnsMenu}
                  className="columns-menu-trigger flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer active:scale-95"
                >
                  <TableIcon size={14} className="text-accent" />
                  <span>Show/Hide Columns</span>
                  <ChevronDown size={12} className="text-muted" />
                </button>
                {columnsMenu && typeof window !== 'undefined' && createPortal(
                  <div
                    className="columns-menu-container fixed z-[100] bg-card border border-border/60 shadow-2xl rounded-xl py-1 w-48 flex flex-col gap-0.5 p-1 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
                    style={{ left: columnsMenu.x, top: columnsMenu.y }}
                  >
                    {allHeaders.filter(h => h !== 'section').map(header => {
                      const isVisible = !hiddenColumns.includes(header);
                      return (
                        <button
                          key={`ribbon-toggle-col-${header}`}
                          onClick={() => toggleColumnVisibility(header)}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent/15 flex items-center justify-between text-foreground rounded-md transition-colors cursor-pointer font-medium"
                        >
                          <span className="truncate">{header}</span>
                          <span className={isVisible ? "text-accent font-bold" : "text-muted opacity-50"}>
                            {isVisible ? "✓" : "✗"}
                          </span>
                        </button>
                      );
                    })}
                  </div>,
                  document.body
                )}
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">Columns</span>
            </div>

            {/* Screen size group */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5 h-full">
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer active:scale-95"
                >
                  {isFullScreen ? (
                    <>
                      <Minimize2 size={14} className="text-accent" />
                      <span>Exit Fullscreen</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 size={14} className="text-accent" />
                      <span>Fullscreen</span>
                    </>
                  )}
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">
                Screen View
              </span>
            </div>
          </>
        )}

        {activeRibbonTab === 'tools' && (
          <>
            {/* Share & Print Group */}
            <div className="flex flex-col justify-between border-r border-border/40 pr-3 mr-1">
              <div className="flex items-center gap-1.5 h-full">
                <button
                  disabled={!selectedId}
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer disabled:opacity-30 active:scale-95"
                  title="Copy Shareable Link"
                >
                  <Share2 size={14} className="text-blue-500" />
                  <span>Copy Link</span>
                </button>
                <button
                  disabled={!selectedId}
                  onClick={() => {
                    if (selectedId) {
                      window.open(`/print?id=${selectedId}`, '_blank');
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer disabled:opacity-30 active:scale-95"
                  title="Open Printable Report"
                >
                  <Printer size={14} className="text-accent" />
                  <span>Printable Report</span>
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">
                Share & Export
              </span>
            </div>

            {/* View Mode Group */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5 h-full">
                <button
                  onClick={() => setViewMode('table')}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer active:scale-95"
                >
                  <TableIcon size={14} className="text-accent" />
                  <span>Grid View</span>
                </button>
                <button
                  onClick={() => setViewMode('code')}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer active:scale-95"
                >
                  <Code size={14} className="text-indigo-500" />
                  <span>JSON View</span>
                </button>
                <button
                  onClick={() => setViewMode('compare')}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/60 hover:border-accent/30 rounded text-xs font-semibold hover:bg-muted/10 shadow-sm text-foreground h-8 cursor-pointer active:scale-95"
                >
                  <Sliders size={14} className="text-purple-500" />
                  <span>Compare View</span>
                </button>
              </div>
              <span className="text-[8px] text-muted-foreground/60 tracking-wider font-bold text-center uppercase block">
                View Mode
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
