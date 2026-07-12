import { useState, useRef, useCallback, useEffect } from 'react';

export interface GridStateSnapshot {
  gridData: Map<string, any>;
  rowCount: number;
  cellMetadata: Record<string, any>;
  cellAlignments: Record<string, 'left' | 'center' | 'right' | 'justify'>;
  rowHeights: Record<string, number>;
  masterColumnOrder: string[];
  columnOrder: string[];
}

export function useGridHistory() {
  const [gridData, setGridData] = useState<Map<string, any>>(new Map());
  const [rowCount, setRowCount] = useState(0);
  const [cellMetadata, setCellMetadata] = useState<Record<string, any>>({});
  const [cellAlignments, setCellAlignments] = useState<Record<string, 'left' | 'center' | 'right' | 'justify'>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [masterColumnOrder, setMasterColumnOrder] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  // History stacks
  const [undoStack, setUndoStack] = useState<GridStateSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<GridStateSnapshot[]>([]);

  // Optimization: Use a ref to track current state for history snapshots.
  const stateRef = useRef({ 
    gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder,
    undoStack, redoStack
  });
  stateRef.current = { 
    gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder,
    undoStack, redoStack
  };

  const saveStateToHistory = useCallback(() => {
    const { gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder } = stateRef.current;
    const snapshot: GridStateSnapshot = {
      gridData: new Map(gridData),
      rowCount,
      cellMetadata: { ...cellMetadata },
      cellAlignments: { ...cellAlignments },
      rowHeights: { ...rowHeights },
      masterColumnOrder: [...masterColumnOrder],
      columnOrder: [...columnOrder]
    };
    setUndoStack(prev => [...prev, snapshot].slice(-50)); // Limit to 50 steps
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    const { 
      gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder,
      undoStack
    } = stateRef.current;

    if (undoStack.length === 0) return;
    const prevState = undoStack[undoStack.length - 1];
    const currentState: GridStateSnapshot = {
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
  }, []);

  const redo = useCallback(() => {
    const { 
      gridData, rowCount, cellMetadata, cellAlignments, rowHeights, masterColumnOrder, columnOrder,
      redoStack
    } = stateRef.current;

    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    const currentState: GridStateSnapshot = {
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
  }, []);

  // Keyboard Shortcuts (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [undo, redo]);

  const resetHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
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
  };
}
