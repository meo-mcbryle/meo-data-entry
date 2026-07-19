import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { LocalDB, db } from '@/lib/local-db';
import { useGridHistory } from '@/hooks/useGridHistory';
import {
  toA1Key, fromA1Key, hydrateMapToArray,
  dehydrateArrayToMap, rekeySparseMap, rekeyMetadataRecord,
  shiftFormula
} from '@/lib/excel-utils';
import { evaluateFormula as evaluateFormulaLib } from '@/lib/formula-evaluator';
import type { User } from '@supabase/supabase-js';

interface UseSpreadsheetOperationsOptions {
  user: User | null;
  activeNode: any;
  selectedId: string | null;
  logAction: (action: string, nodeId: string | null, details?: Record<string, any>) => Promise<void>;
  fetchFiles: (silent?: boolean) => Promise<void>;
  isLoadingFile: boolean;
  setIsLoadingFile: React.Dispatch<React.SetStateAction<boolean>>;
  loadProgress: number;
  setLoadProgress: React.Dispatch<React.SetStateAction<number>>;
}

export function useSpreadsheetOperations({
  user,
  activeNode,
  selectedId,
  logAction,
  fetchFiles,
  isLoadingFile,
  setIsLoadingFile,
  loadProgress,
  setLoadProgress
}: UseSpreadsheetOperationsOptions) {
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

  const masterHeaderIndices = useMemo(() => new Map(masterColumnOrder.map((h, i) => [h, i])), [masterColumnOrder]);

  const stateRef = useRef({ gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder });
  stateRef.current = { gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder };

  const [columnAlignments, setColumnAlignments] = useState<Record<string, 'left' | 'center' | 'right' | 'justify'>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [activeCell, setActiveCellState] = useState<{ row: number; col: string } | null>(null);
  const [lastSavedPayload, setLastSavedPayload] = useState<string>('');
  const [spreadsheetDialog, setSpreadsheetDialog] = useState<{
    type: 'confirm' | 'alert' | 'prompt';
    title: string;
    message: string;
    defaultValue?: string;
    isDestructive?: boolean;
    confirmText?: string;
    onConfirm: (val?: string) => void;
  } | null>(null);
  const pendingActiveCellRef = useRef<{ row: number; col: string } | null>(null);

  const setActiveCell = useCallback((
    valueOrUpdater:
      | { row: number; col: string }
      | null
      | ((prev: { row: number; col: string } | null) => { row: number; col: string } | null)
  ) => {
    setActiveCellState(prev => {
      const next = typeof valueOrUpdater === 'function'
        ? valueOrUpdater(prev)
        : valueOrUpdater;
      if (next) {
        pendingActiveCellRef.current = next;
      }
      return next;
    });
  }, []);
  const [dropdownMenu, setDropdownMenu] = useState<{ x: number; y: number; width: number; row: number; col: string; options: string[]; highlightIndex: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row?: number; col: string; type: 'cell' | 'header' | 'row' | 'section'; sectionName?: string; showFormats?: boolean; showFormulaFormats?: boolean; showNumberFormats?: boolean; showFonts?: boolean } | null>(null);
  const [selection, setSelection] = useState<{ startRow: number; endRow: number; startCol: string; endCol: string } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [dragFillRange, setDragFillRange] = useState<{ startRow: number; endRow: number; col: string } | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{ row: number; col: string; type: 'image' | 'file' } | null>(null);
  const [viewingMedia, setViewingMedia] = useState<any | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('2020');
  const [isSaving, setIsSaving] = useState(false);

  const editStartValueRef = useRef<any>(null);
  const editingCellRef = useRef<{ row: number; col: string } | null>(null);
  const resizingRowRef = useRef<{ row: number; startY: number; startHeight: number } | null>(null);
  const resizingRef = useRef<{ header: string; startX: number; startWidth: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formulaBarRef = useRef<HTMLTextAreaElement>(null);

  // Internal clipboard: stores grid rows × cols of copied cell values
  const clipboardRef = useRef<{ rows: number[]; cols: string[]; values: Map<string, any> } | null>(null);

  // Auto-expand formula bar height based on content
  useEffect(() => {
    if (formulaBarRef.current) {
      formulaBarRef.current.style.height = 'auto';
      formulaBarRef.current.style.height = `${formulaBarRef.current.scrollHeight}px`;
    }
  }, [activeCell]);

  const allHeaders = useMemo(() => {
    if (columnOrder.length > 0) return columnOrder;
    return ["Title / Item", "Amount", "Location", "Allocation", "Notes"];
  }, [columnOrder]);

  const visibleHeaders = useMemo(() => {
    return allHeaders.filter(header => !hiddenColumns.includes(header) && header !== 'section');
  }, [allHeaders, hiddenColumns]);

  const getCanonicalPayload = useCallback((content: any[], displaySettings: any) => {
    // Normalize content array to eliminate key discrepancies from null or empty string differences
    const normalizeContentArray = (arr: any[]): any[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map(row => {
        const next: Record<string, any> = {};
        Object.keys(row).forEach(key => {
          const val = row[key];
          if (val !== undefined && val !== null && val !== '') {
            next[key] = val;
          }
        });
        return next;
      });
    };

    const normalizedContent = normalizeContentArray(content);

    const colMap = new Map<string, number>(
      ((displaySettings.masterColumnOrder || masterColumnOrder || []) as string[]).map((name: string, i: number) => [name, i])
    );

    const normalizeKeys = (metaRecord: Record<string, any> | undefined) => {
      const next: Record<string, any> = {};
      if (!metaRecord) return next;
      Object.keys(metaRecord).forEach(key => {
        if (key.includes(':') && !key.startsWith('header:') && !key.includes(':section')) {
          const parts = key.split(':');
          if (parts.length === 2) {
            const rowIdx = parseInt(parts[0], 10);
            const mIdx = colMap.get(parts[1]);
            if (typeof mIdx === 'number') {
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

    const sortedDisplaySettings = {
      columnAlignments: displaySettings.columnAlignments || {},
      cellAlignments: normalizeKeys(displaySettings.cellAlignments),
      hiddenColumns: displaySettings.hiddenColumns || [],
      selectedYear: displaySettings.selectedYear || '2020',
      columnOrder: displaySettings.columnOrder || [],
      columnWidths: displaySettings.columnWidths || {},
      cellMetadata: normalizeKeys(displaySettings.cellMetadata),
      rowHeights: displaySettings.rowHeights || {},
      masterColumnOrder: displaySettings.masterColumnOrder || []
    };

    const sortObjectKeys = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(sortObjectKeys);
      const sortedKeys = Object.keys(obj).sort();
      const next: any = {};
      sortedKeys.forEach(key => {
        next[key] = sortObjectKeys(obj[key]);
      });
      return next;
    };

    return JSON.stringify({
      content: normalizedContent,
      display_settings: sortObjectKeys(sortedDisplaySettings)
    });
  }, [masterColumnOrder]);

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
  }, [saveStateToHistory, masterColumnOrder, setGridData]);

  // Keyboard navigation for dropdowns
  useEffect(() => {
    if (!dropdownMenu) return;

    const handleDropdownKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDropdownMenu(prev => (prev ? {
          ...prev,
          highlightIndex: (prev.highlightIndex + 1) % prev.options.length
        } : null));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDropdownMenu(prev => (prev ? {
          ...prev,
          highlightIndex: (prev.highlightIndex - 1 + prev.options.length) % prev.options.length
        } : null));
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

  // Dismiss context menu on click elsewhere
  useEffect(() => {
    const handleGlobalClick = (e: any) => {
      if (e.target instanceof Element) {
        if (
          e.target.closest('.dropdown-container') ||
          e.target.closest('.context-menu-container') ||
          e.target.closest('[data-sheet]')
        ) {
          return;
        }
      }
      setContextMenu(null);
      setDropdownMenu(null);
    };
    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('scroll', handleGlobalClick, true);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('scroll', handleGlobalClick, true);
    };
  }, []);

  // End selection on global mouse up
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsSelecting(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Load file content effect
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
        setLastSavedPayload('');
        return;
      }

      setIsLoadingFile(true);
      setLoadProgress(0);

      try {
        // 1. Fetch from local Dexie database first
        try {
          const local = await LocalDB.getNode(selectedId);
          if (local) {
            resetHistory();
            const content = Array.isArray(local.content) ? local.content : [];
            const ds = local.display_settings || {};

            const currentHeaders = ds.columnOrder?.length ? ds.columnOrder : ["Title / Item", "Amount", "Location", "Allocation", "Notes"];
            const master = ds.masterColumnOrder || currentHeaders;

            setMasterColumnOrder(master);
            const initialGridMap = dehydrateArrayToMap(content, currentHeaders, master);
            setGridData(initialGridMap);
            setRowCount(content.length);

            setColumnAlignments(ds.columnAlignments || {});
            setCellAlignments(ds.cellAlignments || {});
            setColumnOrder(ds.columnOrder || []);
            setHiddenColumns(ds.hiddenColumns || []);
            setColumnWidths(ds.columnWidths || {});
            setCellMetadata(ds.cellMetadata || {});
            setRowHeights(ds.rowHeights || {});
            setSelectedYear(ds.selectedYear || '2020');

            const initialContentArray = hydrateMapToArray(initialGridMap, content.length, currentHeaders, master);
            const resolvedDisplaySettings = {
              columnAlignments: ds.columnAlignments || {},
              cellAlignments: ds.cellAlignments || {},
              hiddenColumns: ds.hiddenColumns || [],
              selectedYear: ds.selectedYear || '2020',
              columnOrder: ds.columnOrder || [],
              columnWidths: ds.columnWidths || {},
              cellMetadata: ds.cellMetadata || {},
              rowHeights: ds.rowHeights || {},
              masterColumnOrder: master
            };
            setLastSavedPayload(getCanonicalPayload(initialContentArray, resolvedDisplaySettings));
            if (pendingActiveCellRef.current) {
              setActiveCellState(pendingActiveCellRef.current);
              pendingActiveCellRef.current = null;
            } else {
              setActiveCellState(null);
            }
          }
        } catch (err) {
          console.error("Local load error:", err);
        }

        // 2. Fetch remote update if online
        try {
          const { data, error } = await supabase
            .from('nodes')
            .select('content, display_settings')
            .eq('id', selectedId)
            .single();

          if (!error && data) {
            const queue = await LocalDB.getSyncQueue();
            const isUnsynced = queue.some(item => item.record_id === selectedId);

            if (!isUnsynced) {
              const currentLocal = await LocalDB.getNode(selectedId);
              const remoteHash = `${JSON.stringify(data.content || [])}|${JSON.stringify(data.display_settings || {})}`;

              const isLocalContentMissing = !currentLocal || !currentLocal.content;

              if (!currentLocal || currentLocal.last_synced_hash !== remoteHash || isLocalContentMissing) {
                if (currentLocal) {
                  currentLocal.content = data.content;
                  currentLocal.display_settings = data.display_settings;
                  currentLocal.updated_at = new Date().toISOString();
                  currentLocal.last_synced_hash = remoteHash;
                  await LocalDB.saveNode(currentLocal, true); // bypass queue
                }

                resetHistory();
                const content = Array.isArray(data.content) ? data.content : [];
                const ds = data.display_settings || {};
                const currentHeaders = ds.columnOrder?.length ? ds.columnOrder : ["Title / Item", "Amount", "Location", "Allocation", "Notes"];
                const master = ds.masterColumnOrder || currentHeaders;

                setMasterColumnOrder(master);
                const initialGridMap = dehydrateArrayToMap(content, currentHeaders, master);
                setGridData(initialGridMap);
                setRowCount(content.length);
                setColumnAlignments(ds.columnAlignments || {});
                setCellAlignments(ds.cellAlignments || {});
                setColumnOrder(ds.columnOrder || []);
                setHiddenColumns(ds.hiddenColumns || []);
                setColumnWidths(ds.columnWidths || {});
                setCellMetadata(ds.cellMetadata || {});
                setRowHeights(ds.rowHeights || {});
                setSelectedYear(ds.selectedYear || '2020');

                const initialContentArray = hydrateMapToArray(initialGridMap, content.length, currentHeaders, master);
                const resolvedDisplaySettings = {
                  columnAlignments: ds.columnAlignments || {},
                  cellAlignments: ds.cellAlignments || {},
                  hiddenColumns: ds.hiddenColumns || [],
                  selectedYear: ds.selectedYear || '2020',
                  columnOrder: ds.columnOrder || [],
                  columnWidths: ds.columnWidths || {},
                  cellMetadata: ds.cellMetadata || {},
                  rowHeights: ds.rowHeights || {},
                  masterColumnOrder: master
                };
                setLastSavedPayload(getCanonicalPayload(initialContentArray, resolvedDisplaySettings));
              }
            }
          }
        } catch (err) {
          console.error("Remote file fetch failed, working offline:", err);
        }
      } finally {
        setLoadProgress(100);
        setTimeout(() => {
          setIsLoadingFile(false);
          setTimeout(() => setLoadProgress(0), 400);
        }, 400);
      }
    };

    loadFileContent();
  }, [selectedId, setGridData, setRowCount, resetHistory, setMasterColumnOrder, setCellAlignments, setColumnOrder, setCellMetadata, setRowHeights, setIsLoadingFile, setLoadProgress]);

  const handleSave = async () => {
    if (!activeNode || activeNode.type !== 'file') return;

    setIsSaving(true);
    try {
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
      const display_settings = {
        columnAlignments,
        cellAlignments: normalizeKeys(cellAlignments),
        hiddenColumns,
        selectedYear,
        columnOrder,
        columnWidths,
        cellMetadata: normalizeKeys(cellMetadata),
        rowHeights,
        masterColumnOrder
      };

      const payloadString = JSON.stringify({ content: contentArray, display_settings });
      const size_bytes = typeof TextEncoder !== 'undefined'
        ? new TextEncoder().encode(payloadString).byteLength
        : payloadString.length;

      // 1. Save locally to Dexie nodes database
      const local = await LocalDB.getNode(activeNode.id);
      if (local) {
        local.content = contentArray;
        local.display_settings = display_settings;
        local.size_bytes = size_bytes;
        local.updated_at = new Date().toISOString();
        local.version += 1;
        await LocalDB.saveNode(local); // this queues a sync action
      }

      // 2. Try online sync
      try {
        const { error } = await supabase
          .from('nodes')
          .update({ content: contentArray, display_settings, size_bytes })
          .eq('id', activeNode.id);

        if (!error) {
          // Successfully synced online, remove the update from sync queue
          await db.sync_queue.where({ record_id: activeNode.id }).delete();
        }
      } catch (err) {
        console.log('Saved locally, queued for sync');
      }

      await logAction('CONTENT_UPDATED', activeNode.id);
      await fetchFiles(true);
      setLastSavedPayload(getCanonicalPayload(contentArray, display_settings));
    } finally {
      setIsSaving(false);
    }
  };

  const currentPayload = useMemo(() => {
    if (!activeNode || activeNode.type !== 'file') return '';
    return getCanonicalPayload(
      hydrateMapToArray(gridData, rowCount, allHeaders, masterColumnOrder),
      {
        columnAlignments,
        cellAlignments,
        hiddenColumns,
        selectedYear,
        columnOrder,
        columnWidths,
        cellMetadata,
        rowHeights,
        masterColumnOrder
      }
    );
  }, [
    activeNode?.id,
    gridData,
    rowCount,
    allHeaders,
    masterColumnOrder,
    columnAlignments,
    cellAlignments,
    hiddenColumns,
    selectedYear,
    columnOrder,
    columnWidths,
    cellMetadata,
    rowHeights,
    getCanonicalPayload
  ]);

  const hasUnsavedChanges = useMemo(() => {
    if (!activeNode || activeNode.type !== 'file') return false;
    return currentPayload !== lastSavedPayload;
  }, [currentPayload, lastSavedPayload, activeNode]);

  // Prevent accidental reload or close in web browser
  useEffect(() => {
    if (window.electronAPI) return; // Electron handles this via main process close event

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keep Electron main process informed about unsaved changes
  useEffect(() => {
    if (window.electronAPI?.updateUnsavedStatus) {
      window.electronAPI.updateUnsavedStatus(hasUnsavedChanges);
    }
  }, [hasUnsavedChanges]);

  // Ctrl+S keyboard shortcut to save
  useEffect(() => {
    const handleKeyDownShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activeNode && activeNode.type === 'file' && !isSaving && hasUnsavedChanges) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDownShortcut);
    return () => window.removeEventListener('keydown', handleKeyDownShortcut);
  }, [activeNode, isSaving, hasUnsavedChanges, handleSave]);

  // Debug log to inspect payload mismatches
  useEffect(() => {
    if (activeNode && activeNode.type === 'file' && currentPayload !== lastSavedPayload) {
      console.log("hasUnsavedChanges MISMATCH DETECTED:", activeNode.name);
      console.log("Current:", currentPayload);
      console.log("Saved:", lastSavedPayload);
    }
  }, [currentPayload, lastSavedPayload, activeNode]);

  const setColumnAlignment = useCallback((header: string, align: 'left' | 'center' | 'right' | 'justify') => {
    setColumnAlignments(prev => ({ ...prev, [header]: align }));

    const colIdx = masterColumnOrder.indexOf(header);
    setCellAlignments(prev => {
      const next = { ...prev };
      delete next[`header:${header}`];
      Object.keys(next).forEach(key => {
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

  const handleRenameColumn = useCallback((oldKey: string, newKey: string) => {
    const trimmedNewKey = newKey?.trim();

    if (oldKey === trimmedNewKey || (oldKey.startsWith('_UNTITLED_') && !trimmedNewKey)) return;

    let finalNewKey = trimmedNewKey;
    if (!finalNewKey) {
      let i = 1;
      const otherHeaders = allHeaders.filter(h => h !== oldKey);
      while (otherHeaders.includes(`_UNTITLED_${i}`)) i++;
      finalNewKey = `_UNTITLED_${i}`;
    }

    if (finalNewKey.toLowerCase() === 'section') {
      setSpreadsheetDialog({
        type: 'alert',
        title: 'Reserved Name',
        message: "'section' is a reserved column name used for categorization.",
        onConfirm: () => { }
      });
      return;
    }

    if (allHeaders.includes(finalNewKey)) {
      setSpreadsheetDialog({
        type: 'alert',
        title: 'Duplicate Column',
        message: `A column named "${finalNewKey}" already exists.`,
        onConfirm: () => { }
      });
      return;
    }

    saveStateToHistory();

    setColumnOrder(prev => {
      const currentOrder = prev.length > 0 ? prev : allHeaders;
      return currentOrder.map(col => (col === oldKey ? finalNewKey : col));
    });
    setMasterColumnOrder(prev => prev.map(col => (col === oldKey ? finalNewKey : col)));

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
          next[key] = prev[key];
        }
      });
      return next;
    };
    setCellMetadata(migrateKeys);
    setCellAlignments(migrateKeys);

    setSelection(prev => {
      if (!prev) return null;
      const next = { ...prev };
      if (next.startCol === oldKey) next.startCol = finalNewKey;
      if (next.endCol === oldKey) next.endCol = finalNewKey;
      return next;
    });
    setActiveCell(prev => (prev && prev.col === oldKey ? { ...prev, col: finalNewKey } : prev));
  }, [allHeaders, saveStateToHistory, setColumnOrder, setMasterColumnOrder, setCellMetadata, setCellAlignments]);

  const handleAddColumn = useCallback((name?: string) => {
    saveStateToHistory();
    let colName = typeof name === 'string' ? name.trim() : '';

    if (!colName) {
      let i = 1;
      while (allHeaders.includes(`_UNTITLED_${i}`)) i++;
      colName = `_UNTITLED_${i}`;
    }

    if (colName.toLowerCase() === 'section') {
      setSpreadsheetDialog({
        type: 'alert',
        title: 'Reserved Name',
        message: "'section' is a reserved column name used for categorization.",
        onConfirm: () => { }
      });
      return;
    }

    if (allHeaders.includes(colName)) {
      setSpreadsheetDialog({
        type: 'alert',
        title: 'Duplicate Column',
        message: `A column named "${colName}" already exists.`,
        onConfirm: () => { }
      });
      return;
    }

    setColumnOrder(prev => {
      const currentOrder = prev.length > 0 ? prev : [...allHeaders];
      return [...currentOrder, colName];
    });

    setMasterColumnOrder(prev => [...prev, colName]);
  }, [allHeaders, saveStateToHistory, setColumnOrder, setMasterColumnOrder]);

  const handleDeleteColumn = useCallback((keyToDelete: string) => {
    setSpreadsheetDialog({
      type: 'confirm',
      title: 'Delete Column',
      message: `Are you sure you want to delete the column "${keyToDelete}"?`,
      isDestructive: true,
      confirmText: 'Delete',
      onConfirm: () => {
        saveStateToHistory();

        const colIdx = masterColumnOrder.indexOf(keyToDelete);
        if (colIdx === -1) return;

        const oldOrder = [...masterColumnOrder];
        const newOrder = masterColumnOrder.filter(col => col !== keyToDelete);

        setGridData(prev => rekeySparseMap(prev, oldOrder, newOrder));
        setCellMetadata(prev => rekeyMetadataRecord(prev, oldOrder, newOrder));
        setCellAlignments(prev => rekeyMetadataRecord(prev, oldOrder, newOrder));

        setMasterColumnOrder(newOrder);
        setColumnOrder(prev => prev.filter(col => col !== keyToDelete));
        setSelection(null);

        setColumnAlignments(prev => { const n = { ...prev }; delete n[keyToDelete]; return n; });
        setColumnWidths(prev => { const n = { ...prev }; delete n[keyToDelete]; return n; });
      }
    });
  }, [masterColumnOrder, saveStateToHistory, setGridData, setCellMetadata, setCellAlignments, setMasterColumnOrder, setColumnOrder]);

  const handleInsertColumn = useCallback((relativeCol: string, position: 'before' | 'after') => {
    saveStateToHistory();

    let i = 1;
    while (allHeaders.includes(`_UNTITLED_${i}`)) i++;
    const colName = `_UNTITLED_${i}`;

    if (colName.toLowerCase() === 'section') {
      setSpreadsheetDialog({
        type: 'alert',
        title: 'Reserved Name',
        message: "'section' is a reserved column name used for categorization.",
        onConfirm: () => { }
      });
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
    setMasterColumnOrder(prev => [...prev, colName]);
  }, [allHeaders, saveStateToHistory, setColumnOrder, setMasterColumnOrder]);

  const addTableRow = useCallback(() => {
    saveStateToHistory();
    setRowCount(prev => prev + 1);
  }, [saveStateToHistory, setRowCount]);

  const addRowToSection = useCallback((sectionName: string) => {
    saveStateToHistory();
    const newIdx = rowCount;
    setGridData(prev => {
      const next = new Map(prev);
      next.set(`${newIdx}:section`, sectionName);
      return next;
    });
    setRowCount(prev => prev + 1);
  }, [rowCount, saveStateToHistory, setGridData, setRowCount]);

  const handleInsertRow = useCallback((index: number, position: 'above' | 'after') => {
    saveStateToHistory();
    const section = gridData.get(`${index}:section`) || "";
    const insertIndex = position === 'above' ? index : index + 1;

    const shiftMetadata = (prev: Record<string, any>) => {
      const next: Record<string, any> = {};
      const transform = (k: string) => {
        const c = fromA1Key(k);
        if (!c) return k.includes(':section') ? { r: parseInt(k.split(':')[0], 10), ci: -1, isS: true } : null;
        return { r: c.row, ci: c.colIndex, isS: false };
      };

      Object.keys(prev).forEach(key => {
        if (key.startsWith('header:')) { next[key] = prev[key]; return; }
        const info = transform(key) as { r: number; ci: number; isS: boolean } | null;
        if (!info) { next[key] = prev[key]; return; }

        const { r, ci, isS } = info;
        const nk = r < insertIndex ? key : isS ? `${r + 1}:section` : toA1Key(r + 1, ci);

        const val = { ...prev[key] };
        if (val.mergedIn) {
          const h = transform(val.mergedIn) as { r: number; ci: number; isS: boolean } | null;
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
        const r = parseInt(k, 10);
        if (r < insertIndex) next[k] = prev[k];
        else next[String(r + 1)] = prev[k];
      });
      return next;
    });

    setGridData(prev => {
      const next = new Map();
      prev.forEach((val, key) => {
        const coords = fromA1Key(key) || (key.includes(':section') ? { row: parseInt(key.split(':')[0], 10), colIndex: -1 } : null) as { row: number; colIndex: number } | null;
        if (!coords) { next.set(key, val); return; }

        const { row, colIndex } = coords;
        const isSection = key.includes(':section');

        if (row < insertIndex) next.set(key, val);
        else {
          const newVal = (typeof val === 'string' && val.startsWith('='))
            ? shiftFormula(val, 1, insertIndex)
            : val;
          next.set(isSection ? `${row + 1}:section` : toA1Key(row + 1, colIndex), newVal);
        }
      });
      next.set(`${insertIndex}:section`, section);
      return next;
    });
    setRowCount(prev => prev + 1);
    setContextMenu(null);
  }, [gridData, saveStateToHistory, setCellMetadata, setCellAlignments, setRowHeights, setGridData, setRowCount]);

  const handleClearRow = useCallback((index: number) => {
    setSpreadsheetDialog({
      type: 'confirm',
      title: 'Clear Row',
      message: 'Clear all data in this row?',
      isDestructive: true,
      confirmText: 'Clear',
      onConfirm: () => {
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
      }
    });
  }, [allHeaders, masterColumnOrder, saveStateToHistory, setGridData, setCellMetadata, setCellAlignments]);

  const handleClearColumn = useCallback((colName: string) => {
    setSpreadsheetDialog({
      type: 'confirm',
      title: 'Clear Column',
      message: `Clear all data and formatting in column "${colName}"?`,
      isDestructive: true,
      confirmText: 'Clear',
      onConfirm: () => {
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
            if (coords && coords.colIndex === targetColIdx) return;
            next[key] = prev[key];
          });
          return next;
        };

        setCellMetadata(clearColMeta);
        setCellAlignments(clearColMeta);
        setContextMenu(null);
      }
    });
  }, [masterColumnOrder, rowCount, saveStateToHistory, setGridData, setCellMetadata, setCellAlignments]);

  const setCellType = useCallback((row: number, col: string, type: string, format: string = 'long') => {
    saveStateToHistory();
    setCellMetadata(prev => ({
      ...prev,
      ...(() => {
        const next: Record<string, any> = {};
        const localVisibleHeaders = allHeaders.filter(h => !hiddenColumns.includes(h) && h !== 'section');

        const isPartofSelection = selection &&
          row >= Math.min(selection.startRow, selection.endRow) &&
          row <= Math.max(selection.startRow, selection.endRow) &&
          (() => {
            const startColIdx = localVisibleHeaders.indexOf(selection.startCol);
            const endColIdx = localVisibleHeaders.indexOf(selection.endCol);
            const currentColIdx = localVisibleHeaders.indexOf(col);
            return currentColIdx >= Math.min(startColIdx, endColIdx) && currentColIdx <= Math.max(startColIdx, endColIdx);
          })();

        if (isPartofSelection && selection) {
          const minR = Math.min(selection.startRow, selection.endRow);
          const maxR = Math.max(selection.startRow, selection.endRow);
          const startColIdx = localVisibleHeaders.indexOf(selection.startCol);
          const endColIdx = localVisibleHeaders.indexOf(selection.endCol);
          const minColIdx = Math.min(startColIdx, endColIdx);
          const maxColIdx = Math.max(startColIdx, endColIdx);

          for (let r = minR; r <= maxR; r++) {
            for (let c = minColIdx; c <= maxColIdx; c++) {
              const colIdxInMaster = masterColumnOrder.indexOf(localVisibleHeaders[c]);
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
  }, [allHeaders, hiddenColumns, selection, masterColumnOrder, saveStateToHistory, setCellMetadata]);

  const insertMedia = useCallback((row: number, col: string, mediaType: 'image' | 'file') => {
    setPendingMedia({ row, col, type: mediaType });
    setContextMenu(null);
    setTimeout(() => {
      const inputEl = document.querySelector('input[type="file"]') as HTMLInputElement;
      inputEl?.click();
    }, 0);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingMedia || !activeNode) return;

    // Security Check: File Size Limit (50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setSpreadsheetDialog({
        type: 'alert',
        title: 'Upload Failed',
        message: "File size exceeds the 50MB limit.",
        onConfirm: () => { }
      });
      if (e.target) e.target.value = '';
      setPendingMedia(null);
      return;
    }

    // Security Check: File Type Whitelist
    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
      'application/pdf', 'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4'
    ];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setSpreadsheetDialog({
        type: 'alert',
        title: 'Upload Failed',
        message: `File type "${file.type}" is not allowed.`,
        onConfirm: () => { }
      });
      if (e.target) e.target.value = '';
      setPendingMedia(null);
      return;
    }

    const { row: r, col, type } = pendingMedia;
    const key = toA1Key(r, masterColumnOrder.indexOf(col));

    setIsSaving(true);
    try {
      const existing = cellMetadata[key] || {};
      const currentAttachments = existing.attachments || [];

      if (currentAttachments.length >= 10) {
        setSpreadsheetDialog({
          type: 'alert',
          title: 'Attachment Limit',
          message: "Maximum limit of 10 attachments reached for this cell.",
          onConfirm: () => { }
        });
        return;
      }

      // Security Sanitization: Prevent path injection by sanitizing the file name
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${activeNode.id}/${Date.now()}_${safeFileName}`;

      // Save local attachment cache to Dexie immediately
      await LocalDB.saveAttachment({
        path: filePath,
        blob: file,
        synced: 0,
        name: file.name,
        type,
        size: file.size,
        contentType: file.type
      });

      let publicUrl = '';
      let isOffline = true;

      // If online, attempt to upload to Supabase Storage
      if (typeof window !== 'undefined' && navigator.onLine) {
        try {
          const { error: uploadError } = await supabase.storage
            .from('attachments')
            .upload(filePath, file);

          if (!uploadError) {
            const { data } = supabase.storage
              .from('attachments')
              .getPublicUrl(filePath);

            publicUrl = data.publicUrl;
            isOffline = false;

            // Mark as synced in Dexie
            await LocalDB.saveAttachment({
              path: filePath,
              blob: file,
              synced: 1,
              name: file.name,
              type,
              size: file.size,
              contentType: file.type
            });
          }
        } catch (uploadErr) {
          console.warn("Failed to upload attachment online, keeping offline stage:", uploadErr);
        }
      }

      const newAttachments = [
        ...currentAttachments,
        {
          type,
          name: file.name,
          url: isOffline ? filePath : publicUrl,
          path: filePath,
          size: file.size,
          contentType: file.type,
          isOffline
        }
      ];

      setCellMetadata(prev => ({
        ...prev,
        [key]: {
          ...existing,
          type: 'media',
          attachments: newAttachments
        }
      }));

      setViewingMedia({ attachments: newAttachments, row: r, col });
    } catch (err: any) {
      if (err.message?.includes('violates row-level security policy')) {
        setSpreadsheetDialog({
          type: 'alert',
          title: 'Upload Failed',
          message: 'Security Policy Error. Please ensure Storage RLS policies are configured in Supabase.',
          onConfirm: () => { }
        });
      } else {
        setSpreadsheetDialog({
          type: 'alert',
          title: 'Upload Failed',
          message: err.message,
          onConfirm: () => { }
        });
      }
    } finally {
      setIsSaving(false);
      setPendingMedia(null);
      if (e.target) e.target.value = '';
    }
  };

  const removeCellMetadata = useCallback((row: number, col: string) => {
    setSpreadsheetDialog({
      type: 'confirm',
      title: 'Clear Cell Formatting',
      message: "Are you sure you want to remove all attachments and formatting from this cell?",
      isDestructive: true,
      confirmText: 'Clear',
      onConfirm: () => {
        const key = toA1Key(row, masterColumnOrder.indexOf(col));
        setCellMetadata(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setContextMenu(null);
      }
    });
  }, [masterColumnOrder, setCellMetadata]);

  const deleteAttachment = useCallback((row: number, col: string, index: number) => {
    setSpreadsheetDialog({
      type: 'confirm',
      title: 'Delete Attachment',
      message: "Are you sure you want to remove this attachment?",
      isDestructive: true,
      confirmText: 'Delete',
      onConfirm: () => {
        const key = toA1Key(row, masterColumnOrder.indexOf(col));
        const existing = cellMetadata[key];
        if (!existing || !existing.attachments) return;

        setCellMetadata(prev => {
          const innerExisting = prev[key];
          const newAttachments = innerExisting.attachments.filter((_: any, i: number) => i !== index);

          if (newAttachments.length === 0) {
            const next = { ...prev };
            delete next[key];
            setViewingMedia(null);
            return next;
          }

          const updated = {
            ...prev,
            [key]: { ...innerExisting, attachments: newAttachments }
          };
          setViewingMedia({ attachments: newAttachments, row, col });
          return updated;
        });
      }
    });
  }, [cellMetadata, masterColumnOrder, setCellMetadata]);

  const handleMergeCells = useCallback((localVisibleHeaders: string[], isHeaderMerge: boolean = false) => {
    if (!selection) return;
    saveStateToHistory();
    const { startRow, endRow, startCol, endCol } = selection;

    const isHeaderSelection = startRow === -1 || isHeaderMerge;

    const startColIdx = localVisibleHeaders.indexOf(startCol);
    const endColIdx = localVisibleHeaders.indexOf(endCol);
    if (startColIdx === -1 || endColIdx === -1) return;

    const minColIdx = Math.min(startColIdx, endColIdx);
    const maxColIdx = Math.max(startColIdx, endColIdx);
    const minRow = isHeaderSelection ? -1 : Math.min(startRow, endRow);
    const maxRow = isHeaderSelection ? -1 : Math.max(startRow, endRow);

    const rowSpan = isHeaderSelection ? 1 : maxRow - minRow + 1;
    const colSpan = maxColIdx - minColIdx + 1;

    if (rowSpan === 1 && colSpan === 1) return;

    setSpreadsheetDialog({
      type: 'confirm',
      title: 'Merge Cells',
      message: `Merge ${isHeaderSelection ? colSpan : rowSpan * colSpan} ${isHeaderSelection ? 'headers' : 'cells'}?`,
      confirmText: 'Merge',
      onConfirm: () => {
        const hostCol = localVisibleHeaders[minColIdx];
        const hostMasterIdx = masterColumnOrder.indexOf(hostCol);
        const hostKey = isHeaderSelection ? `header:${hostCol}` : toA1Key(minRow, hostMasterIdx);
        const newMetadata = { ...cellMetadata };

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minColIdx; c <= maxColIdx; c++) {
            const mIdx = masterColumnOrder.indexOf(localVisibleHeaders[c]);
            const key = isHeaderSelection ? `header:${localVisibleHeaders[c]}` : toA1Key(r, mIdx);
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
            const mIdx = masterColumnOrder.indexOf(localVisibleHeaders[c]);
            const currentKey = isHeaderSelection ? `header:${localVisibleHeaders[c]}` : toA1Key(r, mIdx);
            if (currentKey !== hostKey) {
              newMetadata[currentKey] = { ...newMetadata[currentKey], mergedIn: hostKey };
            }
          }
        }
        setCellMetadata(newMetadata);
        setSelection(null);
      }
    });
  }, [selection, cellMetadata, masterColumnOrder, saveStateToHistory, setCellMetadata]);

  const handleUnmergeCells = useCallback((row: number, col: string, localVisibleHeaders: string[]) => {
    const isHeader = row === -1;
    const key = isHeader ? `header:${col}` : toA1Key(row, masterColumnOrder.indexOf(col));
    const meta = cellMetadata[key];
    if (!meta || (!meta.rowSpan && !meta.colSpan)) return;

    const newMetadata = { ...cellMetadata };
    const { rowSpan = 1, colSpan = 1 } = meta;
    const colIdx = localVisibleHeaders.indexOf(col);

    const startR = isHeader ? -1 : row;
    const endR = isHeader ? -1 : row + rowSpan - 1;

    for (let r = startR; r <= endR; r++) {
      for (let c = colIdx; c < colIdx + colSpan; c++) {
        const mIdx = masterColumnOrder.indexOf(localVisibleHeaders[c]);
        const currentKey = isHeader ? `header:${localVisibleHeaders[c]}` : toA1Key(r, mIdx);
        const m = { ...newMetadata[currentKey] };
        delete m.rowSpan; delete m.colSpan; delete m.mergedIn;
        if (Object.keys(m).length === 0) delete newMetadata[currentKey];
        else newMetadata[currentKey] = m;
      }
    }
    setCellMetadata(newMetadata);
  }, [cellMetadata, masterColumnOrder, setCellMetadata]);

  const applyDragFill = useCallback((range: { startRow: number; endRow: number; col: string }) => {
    const { startRow, endRow, col } = range;
    const { gridData: currentGrid, cellMetadata: currentMeta, masterColumnOrder: currentMaster } = stateRef.current;

    saveStateToHistory();
    if (startRow === endRow) return;

    const colIdx = currentMaster.indexOf(col);
    if (colIdx === -1) return;

    const sourceValue = currentGrid.get(toA1Key(startRow, colIdx));
    const sourceMeta = currentMeta[toA1Key(startRow, colIdx)];

    const newMetadata = { ...currentMeta };
    const nextMap = new Map<string, any>(currentGrid);

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
  }, [saveStateToHistory, setGridData, setCellMetadata]);

  const handleDragFillStart = useCallback((e: React.MouseEvent, row: number, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-drag-fill-active', 'true');
    }
    setDragFillRange({ startRow: row, endRow: row, col });

    const handleMouseUp = () => {
      window.removeEventListener('mouseup', handleMouseUp);
      if (typeof document !== 'undefined') {
        document.body.removeAttribute('data-drag-fill-active');
      }
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
    setSpreadsheetDialog({
      type: 'confirm',
      title: 'Delete Row',
      message: "Are you sure you want to delete this row?",
      isDestructive: true,
      confirmText: 'Delete',
      onConfirm: () => {
        saveStateToHistory();

        try {
          setGridData(prev => {
            const next = new Map();
            prev.forEach((val, key) => {
              const coords = fromA1Key(key) || (key.includes(':section') ? { row: parseInt(key.split(':')[0], 10), colIndex: -1 } : null);
              if (!coords) { next.set(key, val); return; }

              const { row, colIndex } = coords;
              const isSection = key.includes(':section');

              if (row < index) next.set(key, val);
              else if (row > index) next.set(isSection ? `${row - 1}:section` : toA1Key(row - 1, colIndex), val);
            });
            return next;
          });
          setRowCount(prev => prev - 1);

          const shiftMetadata = (prev: Record<string, any>) => {
            const next: Record<string, any> = {};
            const transform = (k: string) => {
              const c = fromA1Key(k);
              if (!c) return k.includes(':section') ? { r: parseInt(k.split(':')[0], 10), ci: -1, isS: true } : null;
              return { r: c.row, ci: c.colIndex, isS: false };
            };

            Object.keys(prev).forEach(key => {
              if (key.startsWith('header:')) { next[key] = prev[key]; return; }
              const info = transform(key) as { r: number; ci: number; isS: boolean } | null;
              if (!info) { next[key] = prev[key]; return; }

              const { r, ci, isS } = info;
              if (r < index) next[key] = prev[key];
              else if (r > index) {
                const nk = isS ? `${r - 1}:section` : toA1Key(r - 1, ci);
                const val = { ...prev[key] };
                if (val.mergedIn) {
                  const h = transform(val.mergedIn) as { r: number; ci: number; isS: boolean } | null;
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
              const r = parseInt(k, 10);
              if (r < index) next[k] = prev[k];
              else if (r > index) next[String(r - 1)] = prev[k];
            });
            return next;
          });
        } catch (e) {
          console.error("Failed to remove row");
        }
      }
    });
  }, [saveStateToHistory, setGridData, setRowCount, setCellMetadata, setCellAlignments, setRowHeights]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIndex: number, colIndex: number, headers: string[]) => {
    const navKeys = ['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (navKeys.includes(e.key)) {
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
      const localVisibleHeaders = allHeaders.filter(h => !hiddenColumns.includes(h) && h !== 'section');

      const isPartofSelection = selection &&
        row >= Math.min(selection.startRow, selection.endRow) &&
        row <= Math.max(selection.startRow, selection.endRow) &&
        (() => {
          const startColIdx = localVisibleHeaders.indexOf(selection.startCol);
          const endColIdx = localVisibleHeaders.indexOf(selection.endCol);
          const currentColIdx = localVisibleHeaders.indexOf(col);
          return currentColIdx >= Math.min(startColIdx, endColIdx) && currentColIdx <= Math.max(startColIdx, endColIdx);
        })();

      if (isPartofSelection && selection) {
        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        const startColIdx = localVisibleHeaders.indexOf(selection.startCol);
        const endColIdx = localVisibleHeaders.indexOf(selection.endCol);
        const minColIdx = Math.min(startColIdx, endColIdx);
        const maxColIdx = Math.max(startColIdx, endColIdx);

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minColIdx; c <= maxColIdx; c++) {
            const mIdx = masterColumnOrder.indexOf(localVisibleHeaders[c]);
            const key = r === -1 ? `header:${localVisibleHeaders[c]}` : toA1Key(r, mIdx);
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
  }, [allHeaders, hiddenColumns, selection, masterColumnOrder, setCellMetadata]);

  const toggleCellAlignment = useCallback((rowIndex: number, header: string) => {
    setCellAlignments(prev => {
      const next = { ...prev };
      const targetKey = toA1Key(rowIndex, masterColumnOrder.indexOf(header));
      const defaultAlign = (header === "Title / Item" || header === "Amount") ? "right" : "left";
      const currentAlign = prev[targetKey] || columnAlignments[header] || defaultAlign;

      const nextMap: Record<string, 'left' | 'center' | 'right' | 'justify'> = { left: 'center', center: 'right', right: 'justify', justify: 'left' };
      const nextAlign = nextMap[currentAlign] || 'left';

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

  const setSelectionAlignment = useCallback((align: 'left' | 'center' | 'right' | 'justify') => {
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
  }, [selection, visibleHeaders, masterColumnOrder, saveStateToHistory, setCellAlignments]);

  const toggleColumnVisibility = useCallback((key: string) => {
    setHiddenColumns(prev =>
      (prev.includes(key) ? prev.filter(col => col !== key) : [...prev, key])
    );
    setSelection(null);
  }, []);

  const handleRenameSectionBlock = useCallback((startIndex: number, oldName: string, newName: string) => {
    if (!newName || oldName === newName) return;

    saveStateToHistory();
    setGridData(prev => {
      const next = new Map(prev);
      let r = startIndex;
      while (r < rowCount && next.get(`${r}:section`) === oldName) {
        next.set(`${r}:section`, newName);
        r++;
      }
      r = startIndex - 1;
      while (r >= 0 && next.get(`${r}:section`) === oldName) {
        next.set(`${r}:section`, newName);
        r--;
      }
      return next;
    });
  }, [rowCount, saveStateToHistory, setGridData]);

  const handleAddSection = useCallback(() => {
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
  }, [rowCount, saveStateToHistory, setGridData, setRowCount]);

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
        if (!c) return k.includes(':section') ? { r: parseInt(k.split(':')[0], 10), ci: -1, isS: true } : null;
        return { r: c.row, ci: c.colIndex, isS: false };
      };

      Object.keys(prev).forEach(key => {
        if (key.startsWith('header:')) { next[key] = prev[key]; return; }
        const info = transform(key) as { r: number; ci: number; isS: boolean } | null;
        if (!info) { next[key] = prev[key]; return; }

        const { r, ci, isS } = info;
        const nk = r < insertionIndex ? key : isS ? `${r + 1}:section` : toA1Key(r + 1, ci);

        const val = { ...prev[key] };
        if (val.mergedIn) {
          const h = transform(val.mergedIn) as { r: number; ci: number; isS: boolean } | null;
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
        const r = parseInt(k, 10);
        if (r < insertionIndex) next[k] = prev[k];
        else next[String(r + 1)] = prev[k];
      });
      return next;
    });

    setGridData(prev => {
      const next = new Map();
      prev.forEach((val, key) => {
        const coords = fromA1Key(key) || (key.includes(':section') ? { row: parseInt(key.split(':')[0], 10), colIndex: -1 } : null);
        if (!coords) { next.set(key, val); return; }

        const { row: r, colIndex } = coords;
        const isSectionKey = key.includes(':section');

        if (r < insertionIndex) {
          next.set(key, val);
        } else {
          const newVal = (typeof val === 'string' && val.startsWith('='))
            ? shiftFormula(val, 1, insertionIndex)
            : val;
          const newIdx = r + 1;
          next.set(isSectionKey ? `${newIdx}:section` : toA1Key(newIdx, colIndex), newVal);
        }
      });

      next.set(`${insertionIndex}:section`, sectionName);
      return next;
    });
    setRowCount(prev => prev + 1);
  }, [rowCount, gridData, saveStateToHistory, setCellMetadata, setCellAlignments, setRowHeights, setGridData, setRowCount]);

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
  }, [saveStateToHistory, setGridData]);

  const initializeExcelTemplate = useCallback(() => {
    const master = ["Title / Item", "Amount", "Location", "Allocation", "Notes"];
    setMasterColumnOrder(master);
    setColumnOrder(master);

    const next = new Map();
    [0, 1, 2].forEach(r => {
      next.set(toA1Key(r, 0), String.fromCharCode(97 + r) + ".");
      next.set(toA1Key(r, 1), 0);
      next.set(`${r}:section`, "Work A");
    });
    next.set(toA1Key(3, 0), "a.");
    next.set(toA1Key(3, 1), 0);
    next.set("3:section", "Work B");

    setGridData(next);
    setRowCount(4);
  }, [setMasterColumnOrder, setColumnOrder, setGridData, setRowCount]);

  const exportToCSV = useCallback(() => {
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
  }, [rowCount, allHeaders, masterColumnOrder, gridData, activeNode]);

  const handleResetWidths = useCallback(() => {
    setSpreadsheetDialog({
      type: 'confirm',
      title: 'Reset Column Widths',
      message: 'Reset all column widths? This will allow columns to auto-fit based on their content.',
      confirmText: 'Reset',
      onConfirm: () => {
        setColumnWidths({});
      }
    });
  }, []);

  const evaluateFormula = useCallback((value: any, rowData: any, formatId?: string) => {
    return evaluateFormulaLib(value, rowData, gridData, masterHeaderIndices, columnOrder, formatId);
  }, [gridData, masterHeaderIndices, columnOrder]);

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
  }, [setRowHeights]);

  const handleOpenDropdown = useCallback((e: React.MouseEvent, row: number, col: string, options: string[]) => {
    e.preventDefault();
    e.stopPropagation();
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
  }, [selection, visibleHeaders, rowCount, setColumnWidths]);

  const handleOpenContextMenu = useCallback((e: React.MouseEvent, type: 'cell' | 'header' | 'row' | 'section', col: string = "", row?: number, sectionName?: string) => {
    e.preventDefault();
    const menuWidth = 192;
    const menuHeight = type === 'row' ? 310 : (type === 'header' ? 350 : (type === 'section' ? 180 : 480));

    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let x = e.clientX;
    let y = e.clientY;

    if (type === 'row') {
      if (x + menuWidth > winW) {
        x = e.clientX - menuWidth;
      }
      if (y + menuHeight > winH) {
        y = e.clientY - menuHeight;
      }
      x = Math.max(12, Math.min(x, winW - menuWidth - 12));
      y = Math.max(12, Math.min(y, winH - menuHeight - 12));
    } else {
      if (x + menuWidth > winW) x = winW - menuWidth - 12;
      if (y + menuHeight > winH) y = winH - menuHeight - 12;
      x = Math.max(12, x);
      y = Math.max(12, y);
    }

    setContextMenu({ x, y, row, col, type, sectionName });
  }, []);

  // ─── Copy / Paste ────────────────────────────────────────────────────────
  const handleCopyCells = useCallback(async (
    sel: { startRow: number; endRow: number; startCol: string; endCol: string } | null,
    cell: { row: number; col: string } | null,
    headers: string[]
  ) => {
    const current = stateRef.current;

    // Determine the range to copy
    let rowMin: number, rowMax: number, colMin: number, colMax: number;
    if (sel) {
      rowMin = Math.min(sel.startRow, sel.endRow);
      rowMax = Math.max(sel.startRow, sel.endRow);
      colMin = Math.min(headers.indexOf(sel.startCol), headers.indexOf(sel.endCol));
      colMax = Math.max(headers.indexOf(sel.startCol), headers.indexOf(sel.endCol));
    } else if (cell) {
      rowMin = rowMax = cell.row;
      colMin = colMax = headers.indexOf(cell.col);
    } else {
      return;
    }

    const rows: number[] = [];
    for (let r = rowMin; r <= rowMax; r++) rows.push(r);
    const cols: string[] = [];
    for (let c = colMin; c <= colMax; c++) cols.push(headers[c]);

    // Snapshot values into internal clipboard
    const values = new Map<string, any>();
    rows.forEach(r => {
      cols.forEach(col => {
        const colIdx = current.masterColumnOrder.indexOf(col);
        if (colIdx === -1) return;
        const key = toA1Key(r, colIdx);
        const val = current.gridData.get(key);
        if (val !== undefined && val !== '') values.set(`${r}:${col}`, val);
      });
    });
    clipboardRef.current = { rows, cols, values };

    // Also write TSV to system clipboard for interop
    try {
      const tsv = rows.map(r =>
        cols.map(col => {
          const colIdx = current.masterColumnOrder.indexOf(col);
          const key = colIdx !== -1 ? toA1Key(r, colIdx) : '';
          return String(current.gridData.get(key) ?? '');
        }).join('\t')
      ).join('\n');
      await navigator.clipboard.writeText(tsv);
    } catch {
      // Clipboard API not available — internal clipboard still works
    }
  }, []);

  const handlePasteCells = useCallback(async (
    targetCell: { row: number; col: string } | null,
    headers: string[]
  ) => {
    if (!targetCell) return;
    const current = stateRef.current;

    const applyPaste = (rows: string[][], targetRow: number, targetColIdx: number) => {
      saveStateToHistory();
      setGridData(prev => {
        const next = new Map(prev);
        rows.forEach((rowVals, ri) => {
          rowVals.forEach((val, ci) => {
            const rIdx = targetRow + ri;
            const cIdx = targetColIdx + ci;
            const col = headers[cIdx];
            if (!col) return;
            const masterIdx = current.masterColumnOrder.indexOf(col);
            if (masterIdx === -1) return;
            const key = toA1Key(rIdx, masterIdx);
            next.set(key, val);
          });
        });
        return next;
      });
    };

    const targetColIdx = headers.indexOf(targetCell.col);
    if (targetColIdx === -1) return;

    // Prefer internal clipboard (preserves types & structure)
    if (clipboardRef.current) {
      const { rows, cols, values } = clipboardRef.current;
      const matrix = rows.map(r => cols.map(col => String(values.get(`${r}:${col}`) ?? '')));
      applyPaste(matrix, targetCell.row, targetColIdx);
      return;
    }

    // Fallback: read TSV from system clipboard
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const matrix = text.split('\n').map(row => row.split('\t'));
      applyPaste(matrix, targetCell.row, targetColIdx);
    } catch {
      // Clipboard read permission denied — nothing to do
    }
  }, [saveStateToHistory, setGridData]);

  return {
    // Grid states
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
    resetHistory,

    // Spreadsheet extra states
    columnAlignments,
    setColumnAlignments,
    hiddenColumns,
    setHiddenColumns,
    columnWidths,
    setColumnWidths,
    activeCell,
    setActiveCell,
    dropdownMenu,
    setDropdownMenu,
    contextMenu,
    setContextMenu,
    selection,
    setSelection,
    isSelecting,
    setIsSelecting,
    dragFillRange,
    setDragFillRange,
    pendingMedia,
    setPendingMedia,
    viewingMedia,
    setViewingMedia,
    selectedYear,
    setSelectedYear,
    isSaving,
    hasUnsavedChanges,
    spreadsheetDialog,
    setSpreadsheetDialog,

    // Memoized headers
    allHeaders,
    visibleHeaders,

    // Handlers
    handleUpdateCell,
    handleRenameColumn,
    handleAddColumn,
    handleDeleteColumn,
    handleInsertColumn,
    addTableRow,
    addRowToSection,
    handleInsertRow,
    handleClearRow,
    handleClearColumn,
    setCellType,
    insertMedia,
    handleFileSelect,
    removeCellMetadata,
    deleteAttachment,
    handleMergeCells,
    handleUnmergeCells,
    applyDragFill,
    handleDragFillStart,
    removeTableRow,
    handleKeyDown,
    setCellFontFamily,
    toggleCellAlignment,
    setSelectionAlignment,
    toggleColumnVisibility,
    handleRenameSectionBlock,
    handleAddSection,
    handleInsertSection,
    handleDeleteSection,
    initializeExcelTemplate,
    exportToCSV,
    setColumnAlignment,
    evaluateFormula,
    startRowResizing,
    handleOpenDropdown,
    startResizing,
    handleOpenContextMenu,
    handleSave,
    handleResetWidths,
    fileInputRef,
    formulaBarRef,
    handleCopyCells,
    handlePasteCells
  };
}
