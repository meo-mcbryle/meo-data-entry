'use client';
import React, { useEffect, useState, useMemo, useCallback, Suspense, useRef } from 'react';
import { flushSync } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import { buildTree, FileNode, findNodeById } from '@/lib/tree-utils';
import { 
  toA1Key, fromA1Key, hydrateMapToArray, 
  dehydrateArrayToMap, rekeySparseMap, rekeyMetadataRecord,
  shiftFormula
} from '@/lib/excel-utils';
import { ProjectExplorer } from '@/components/ProjectExplorer';
import { TrashNode } from '@/lib/types';
import { ComparisonTable } from '@/components/ComparisonTable';
import { TrashBin } from '@/components/TrashBin';
import { AuditLogs } from '@/components/AuditLogs';
import { TableEditor } from '@/components/TableEditor';
import { ThemeContext } from '@/components/ThemeToggle';
import { LoginPage } from '@/components/LoginPage';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import { ProfileModal } from '@/components/ProfileModal';
import { NavigationSidebar } from '@/components/NavigationSidebar';
import { useGridHistory } from '@/hooks/useGridHistory';
import { evaluateFormula as evaluateFormulaLib } from '@/lib/formula-evaluator';
import { GRID_THEME } from '@/lib/constants';
import { 
  Clock, User, HardDrive, Folder, Save, Code, Table as TableIcon, Trash2, 
  Printer, Share2, PanelLeftOpen, Loader2, RefreshCcw, FileIcon, 
  Maximize2, Minimize2, History, X, Check, Paperclip, Image as ImageIcon
} from 'lucide-react';





const DashboardContent = React.memo(({ user }: { user: any }) => {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deletedNodes, setDeletedNodes] = useState<TrashNode[]>([]);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [selectedYear, setSelectedYear] = useState<string>('2020');
  const [columnAlignments, setColumnAlignments] = useState<Record<string, 'left' | 'center' | 'right'>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  const {
    gridData,
    setGridData,
    rowCount,
    setRowCount,
    cellMetadata,
    setCellMetadata,
    cellAlignments,
    setCellAlignments,
    rowHeights,
    setRowHeights,
    masterColumnOrder,
    setMasterColumnOrder,
    columnOrder,
    setColumnOrder,
    saveStateToHistory,
    undo,
    redo,
    undoStack,
    redoStack,
    resetHistory
  } = useGridHistory();

  const stateRef = useRef({ gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder });
  stateRef.current = { gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder };

  // Audit Logs State and Fetching
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const LOGS_PAGE_SIZE = 50;

  const fetchAuditLogs = useCallback(async (offset = 0) => {
    setIsLoadingLogs(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, nodes(name)')
      .order('created_at', { ascending: false })
      .range(offset, offset + LOGS_PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching logs:', error.message);
    } else {
      setAuditLogs(prev => offset === 0 ? (data || []) : [...prev, ...(data || [])]);
      setHasMoreLogs((data || []).length === LOGS_PAGE_SIZE);
    }
    setIsLoadingLogs(false);
  }, []);



  // Global Entry Search State
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

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

  const searchParams = useSearchParams();
  const [isExplorerVisible, setIsExplorerVisible] = useState(false);
  const [isSidebarMoving, setIsSidebarMoving] = useState(false);

  /**
   * Performance Optimized Sidebar Toggle:
   * Sets a flag to silence heavy grid measurement observers during the 300ms 
   * CSS transition, preventing layout thrashing and "Measurement Storms".
   */
  const toggleSidebar = useCallback((forceState?: boolean) => {
    const nextState = forceState !== undefined ? forceState : !isExplorerVisible;
    setIsSidebarMoving(true);
    setIsExplorerVisible(nextState);
    setTimeout(() => setIsSidebarMoving(false), 350); // Matches 300ms duration + buffer
  }, [isExplorerVisible]);

  const [isFreezeHeaders, setIsFreezeHeaders] = useState(true);

  const [activeCell, setActiveCell] = useState<{ row: number, col: string } | null>(null);
  const formulaBarRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingMedia, setPendingMedia] = useState<{ row: number, col: string, type: 'image' | 'file' } | null>(null);
  const [viewingMedia, setViewingMedia] = useState<any | null>(null);
  const [dropdownMenu, setDropdownMenu] = useState<{ x: number, y: number, width: number, row: number, col: string, options: string[], highlightIndex: number } | null>(null);
  
  // Profile State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState(user?.user_metadata?.avatar_url || '');

  // Virtualization State
  const [containerHeight, setContainerHeight] = useState(800); // Sane initial height to prevent partial render
  const DEFAULT_ROW_HEIGHT = 40; // Matches min-h-7 (28px) + py-1.5 (12px) = 40px

  // Throttled Height Updates: Prevents layout thrashing during sidebar resize
  const heightUpdateQueue = useRef<Record<string, number>>({});
  const heightRafId = useRef<number | null>(null);

  const onMeasuredHeight = useCallback((index: number, height: number) => {
    // Silently ignore measurements while sidebar is animating to keep FPS high
    if (isSidebarMoving) return;
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

  useEffect(() => {
    return () => { 
      if (heightRafId.current !== null) cancelAnimationFrame(heightRafId.current);
    };
  }, []);



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
    const menuWidth = 192; // Updated for w-48
    // Refined height estimates based on current item counts + new padding
    const menuHeight = type === 'row' ? 250 : (type === 'header' ? 350 : (type === 'section' ? 180 : 380)); 
    
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Nudge logic: If the menu would overflow, align its edge with the screen edge
    // Add 12px padding from the edges
    if (x + menuWidth > winW) x = winW - menuWidth - 12;
    if (y + menuHeight > winH) y = winH - menuHeight - 12;
    
    // Ensure it doesn't go off the top/left after adjustment
    x = Math.max(12, x);
    y = Math.max(12, y);
    
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



  const setColumnAlignment = useCallback((header: string, align: 'left' | 'center' | 'right') => {
    setColumnAlignments(prev => ({ ...prev, [header]: align }));
    
    // PERFORMANCE FIX: Clear cell-specific overrides using A1 keys
    const colIdx = masterColumnOrder.indexOf(header);
    setCellAlignments(prev => {
      const next = { ...prev };
      // Clear header-specific override
      delete next[`header:${header}`];
      Object.keys(next).forEach(key => {
        // Clear legacy alignments ending in :header
        if (key.endsWith(`:${header}`)) {
          delete next[key];
        }
        const coords = fromA1Key(key);
        if (coords && coords.colIndex === colIdx) delete next[key];
      });
      return next;
    });
    setContextMenu(null);
  }, [masterColumnOrder, setCellAlignments]);


  // Auto-expand formula bar height based on content
  useEffect(() => {
    if (formulaBarRef.current) {
      formulaBarRef.current.style.height = 'auto';
      formulaBarRef.current.style.height = `${formulaBarRef.current.scrollHeight}px`;
    }
  }, [activeCell, gridData]);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, row?: number, col: string, type: 'cell' | 'header' | 'row' | 'section', sectionName?: string, showFormats?: boolean, showFormulaFormats?: boolean, showNumberFormats?: boolean, showFonts?: boolean } | null>(null);
  const evaluateFormula = useCallback((value: any, rowData: any, formatId?: string) => {
    return evaluateFormulaLib(value, rowData, gridData, masterColumnOrder, columnOrder, formatId);
  }, [gridData, masterColumnOrder, columnOrder]);

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

  const addItem = useCallback(async (type: 'file' | 'folder', parentId: string | null = null) => {
    const name = window.prompt(`Enter ${type} name:`);
    if (!name) return;

    const { data, error } = await supabase.from('nodes').insert([{ name, type, parent_id: parentId }]).select().single();
    if (error) {
      alert(`Failed to create ${type}: ${error.message}`);
      return;
    }
    
    if (data) await logAction(type === 'file' ? 'FILE_CREATED' : 'FOLDER_CREATED', data.id, { name });
    fetchFiles();
  }, [user, logAction, fetchFiles]);

  const handleRename = useCallback(async (id: string) => {
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
  }, [tree, logAction, fetchFiles]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('Move this item to Trash?')) return;
    const { error } = await supabase.from('nodes').update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user.email }).eq('id', id);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }
    await logAction('MOVED_TO_TRASH', id, { name: findNodeById(tree, id)?.name });
    if (selectedId === id) setSelectedId(null);
    fetchFiles();
  }, [user.email, tree, logAction, selectedId, setSelectedId, fetchFiles]);

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

  const toggleComparisonId = useCallback((id: string) => {
    setComparisonIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);



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
    const nextMap = new Map<string, any>(gridData);

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
        resetHistory();
        setMasterColumnOrder([]);
        setColumnAlignments({});
        setCellAlignments({});
        setColumnOrder([]);
        setHiddenColumns([]);
        setCellMetadata({});
        setRowHeights({});
        setActiveCell(null);
        setSelectedYear('2020');
        return;
      }

      setIsLoadingFile(true);
      setLoadProgress(0);
      // Simulate deterministic progress: tick to 85 while fetch is in-flight
      const progressInterval = setInterval(() => {
        setLoadProgress(prev => prev < 85 ? prev + Math.ceil((85 - prev) * 0.18) : prev);
      }, 80);
      // Lazy Load: Fetch content and settings only for the selected file
      const { data, error } = await supabase
        .from('nodes')
        .select('content, display_settings')
        .eq('id', selectedId)
        .single();

      if (!error && data) {
        resetHistory();
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
      }
      clearInterval(progressInterval as any);
      setLoadProgress(100);
      // Brief hold at 100 so the bar completes visually before unmounting
      setTimeout(() => {
        setIsLoadingFile(false);
        setTimeout(() => setLoadProgress(0), 400);
      }, 120);
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



  const handleLogout = async () => {
    await supabase.auth.signOut();
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
          {/* Vertical Icon Rail */}
          <NavigationSidebar
            isExplorerVisible={isExplorerVisible}
            toggleSidebar={toggleSidebar}
            viewMode={viewMode}
            setViewMode={setViewMode}
            setShowGlobalSearch={setShowGlobalSearch}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            setShowProfileModal={setShowProfileModal}
            profileAvatar={profileAvatar}
            handleLogout={handleLogout}
            activeNode={activeNode}
          />

          {/* Explorer Drawer Panel */}
          <ProjectExplorer
            tree={tree}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            addItem={addItem}
            handleRename={handleRename}
            handleDelete={handleDelete}
            isExplorerVisible={isExplorerVisible}
            setIsExplorerVisible={setIsExplorerVisible}
            isLoading={isLoading}
            setIsLoadingFile={setIsLoadingFile}
            viewMode={viewMode}
            setViewMode={setViewMode}
            comparisonIds={comparisonIds}
            toggleComparisonId={toggleComparisonId}
          />
        </div>
      )}

      <div className={`flex-1 flex flex-col overflow-hidden ${isFullScreen ? 'p-0' : 'p-1 md:p-1.5'}`}>

        {/* Floating Mobile Toggle Button - Restored for better access while keeping the spreadsheet view maximized */}
        {!isFullScreen && !isExplorerVisible && (
          <button
            onClick={() => toggleSidebar(true)}
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
                <AuditLogs 
                  isLoadingLogs={isLoadingLogs}
                  auditLogs={auditLogs}
                  fetchAuditLogs={fetchAuditLogs}
                  hasMoreLogs={hasMoreLogs}
                />
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
                    <TrashBin 
                      deletedNodes={deletedNodes}
                      handleRestore={handleRestore}
                      handlePermanentDelete={handlePermanentDelete}
                    />
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
                  <TableEditor
                    isLoadingFile={isLoadingFile}
                    loadProgress={loadProgress}
                    rowCount={rowCount}
                    setRowCount={setRowCount}
                    initializeExcelTemplate={initializeExcelTemplate}
                    visibleHeaders={visibleHeaders}
                    selection={selection}
                    setSelection={setSelection}
                    zoom={zoom}
                    setZoom={setZoom}
                    containerHeight={containerHeight}
                    setContainerHeight={setContainerHeight}
                    isFullScreen={isFullScreen}
                    setIsFullScreen={setIsFullScreen}
                    activeCell={activeCell}
                    setActiveCell={setActiveCell}
                    masterColumnOrder={masterColumnOrder}
                    cellMetadata={cellMetadata}
                    setCellMetadata={setCellMetadata}
                    setCellFontFamily={setCellFontFamily}
                    selectedYear={selectedYear}
                    setSelectedYear={setSelectedYear}
                    hiddenColumns={hiddenColumns}
                    toggleColumnVisibility={toggleColumnVisibility}
                    allHeaders={allHeaders}
                    undoStack={undoStack}
                    redoStack={redoStack}
                    undo={undo}
                    redo={redo}
                    isFreezeHeaders={isFreezeHeaders}
                    setIsFreezeHeaders={setIsFreezeHeaders}
                    isFreezePanes={isFreezePanes}
                    setIsFreezePanes={setIsFreezePanes}
                    handleAddSection={handleAddSection}
                    handleResetWidths={handleResetWidths}
                    exportToCSV={exportToCSV}
                    contextMenu={contextMenu}
                    setContextMenu={setContextMenu}
                    handleMergeCells={handleMergeCells}
                    handleUnmergeCells={handleUnmergeCells}
                    setColumnAlignment={setColumnAlignment}
                    columnAlignments={columnAlignments}
                    handleRenameColumn={handleRenameColumn}
                    handleAddColumn={handleAddColumn}
                    handleDeleteColumn={handleDeleteColumn}
                    handleInsertColumn={handleInsertColumn}
                    handleInsertRow={handleInsertRow}
                    handleClearRow={handleClearRow}
                    handleInsertSection={handleInsertSection}
                    addRowToSection={addRowToSection}
                    handleDeleteSection={handleDeleteSection}
                    removeTableRow={removeTableRow}
                    handleClearColumn={handleClearColumn}
                    gridData={gridData}
                    cellAlignments={cellAlignments}
                    rowHeights={rowHeights}
                    dragFillRange={dragFillRange}
                    setDragFillRange={setDragFillRange}
                    isSelecting={isSelecting}
                    setIsSelecting={setIsSelecting}
                    handleUpdateCell={handleUpdateCell}
                    handleKeyDown={handleKeyDown}
                    handleOpenContextMenu={handleOpenContextMenu}
                    toggleCellAlignment={toggleCellAlignment}
                    handleDragFillStart={handleDragFillStart}
                    setViewingMedia={setViewingMedia}
                    removeCellMetadata={removeCellMetadata}
                    evaluateFormula={evaluateFormula}
                    startRowResizing={startRowResizing}
                    handleOpenDropdown={handleOpenDropdown}
                    onMeasuredHeight={onMeasuredHeight}
                    columnWidths={columnWidths}
                    startResizing={startResizing}
                    handleRenameSectionBlock={handleRenameSectionBlock}
                    handleFileSelect={handleFileSelect}
                    pendingMedia={pendingMedia}
                    fileInputRef={fileInputRef}
                    formulaBarRef={formulaBarRef}
                    setCellType={setCellType}
                    setSelectionAlignment={setSelectionAlignment}
                    insertMedia={insertMedia}
                    setViewMode={setViewMode}
                    selectedId={selectedId}
                    isSidebarMoving={isSidebarMoving}
                  />
                ) : viewMode === 'compare' ? (
                  <ComparisonTable
                    comparisonIds={comparisonIds}
                    tree={tree}
                    toggleComparisonId={toggleComparisonId}
                    setComparisonIds={setComparisonIds}
                  />
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
                onClick={() => toggleSidebar(true)}
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
        <ProfileModal
          user={user}
          showProfileModal={showProfileModal}
          setShowProfileModal={setShowProfileModal}
          profileAvatar={profileAvatar}
          setProfileAvatar={setProfileAvatar}
        />

        {/* Global Entry Search Modal */}
        <GlobalSearchModal
          showGlobalSearch={showGlobalSearch}
          setShowGlobalSearch={setShowGlobalSearch}
          setSelectedId={setSelectedId}
          setViewMode={setViewMode}
        />
      </div>
    </main>
  );
});

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'unauthorized' | 'ready'>('loading');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('meo-theme') as 'light' | 'dark';
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
    }
    return 'dark';
  });
  const isTransitioning = useRef(false);

  // Theme Management Logic
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
