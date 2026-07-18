import { useState, useCallback, useMemo, useRef } from 'react';
import { toA1Key, fromA1Key, rekeySparseMap, rekeyMetadataRecord } from '@/lib/excel-utils';

interface UseColumnOperationsProps {
  columnOrder: string[];
  setColumnOrder: React.Dispatch<React.SetStateAction<string[]>>;
  masterColumnOrder: string[];
  setMasterColumnOrder: React.Dispatch<React.SetStateAction<string[]>>;
  gridData: Map<string, any>;
  setGridData: React.Dispatch<React.SetStateAction<Map<string, any>>>;
  cellMetadata: Record<string, any>;
  setCellMetadata: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  cellAlignments: Record<string, any>;
  setCellAlignments: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  rowCount: number;
  saveStateToHistory: () => void;
  setSpreadsheetDialog: (dialog: any) => void;
  selection: { startRow: number; endRow: number; startCol: string; endCol: string } | null;
  setSelection: React.Dispatch<React.SetStateAction<{ startRow: number; endRow: number; startCol: string; endCol: string } | null>>;
  setContextMenu: React.Dispatch<React.SetStateAction<any>>;
}

export function useColumnOperations({
  columnOrder,
  setColumnOrder,
  masterColumnOrder,
  setMasterColumnOrder,
  gridData,
  setGridData,
  cellMetadata,
  setCellMetadata,
  cellAlignments,
  setCellAlignments,
  rowCount,
  saveStateToHistory,
  setSpreadsheetDialog,
  selection,
  setSelection,
  setContextMenu
}: UseColumnOperationsProps) {
  const [columnAlignments, setColumnAlignments] = useState<Record<string, 'left' | 'center' | 'right' | 'justify'>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ header: string; startX: number; startWidth: number } | null>(null);

  const allHeaders = useMemo(() => {
    if (columnOrder.length > 0) return columnOrder;
    return ["Title / Item", "Amount", "Location", "Allocation", "Notes"];
  }, [columnOrder]);

  const visibleHeaders = useMemo(() => {
    return allHeaders.filter(header => !hiddenColumns.includes(header) && header !== 'section');
  }, [allHeaders, hiddenColumns]);

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
  }, [masterColumnOrder, setCellAlignments, setContextMenu]);

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
  }, [allHeaders, saveStateToHistory, setColumnOrder, setMasterColumnOrder, setCellMetadata, setCellAlignments, setSelection, setSpreadsheetDialog]);

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
  }, [allHeaders, saveStateToHistory, setColumnOrder, setMasterColumnOrder, setSpreadsheetDialog]);

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
  }, [masterColumnOrder, saveStateToHistory, setGridData, setCellMetadata, setCellAlignments, setMasterColumnOrder, setColumnOrder, setSelection, setSpreadsheetDialog]);

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
  }, [allHeaders, saveStateToHistory, setColumnOrder, setMasterColumnOrder, setSpreadsheetDialog]);

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
  }, [masterColumnOrder, rowCount, saveStateToHistory, setGridData, setCellMetadata, setCellAlignments, setContextMenu, setSpreadsheetDialog]);

  const toggleColumnVisibility = useCallback((key: string) => {
    setHiddenColumns(prev =>
      (prev.includes(key) ? prev.filter(col => col !== key) : [...prev, key])
    );
    setSelection(null);
  }, [setSelection]);

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
  }, [setSpreadsheetDialog]);

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

  return {
    columnAlignments,
    setColumnAlignments,
    hiddenColumns,
    setHiddenColumns,
    columnWidths,
    setColumnWidths,
    allHeaders,
    visibleHeaders,
    setColumnAlignment,
    handleRenameColumn,
    handleAddColumn,
    handleDeleteColumn,
    handleInsertColumn,
    handleClearColumn,
    toggleColumnVisibility,
    handleResetWidths,
    startResizing
  };
}
