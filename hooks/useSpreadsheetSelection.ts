import { useState, useCallback } from 'react';
import { toA1Key, shiftFormula } from '@/lib/excel-utils';

interface UseSpreadsheetSelectionProps {
  gridData: Map<string, any>;
  setGridData: React.Dispatch<React.SetStateAction<Map<string, any>>>;
  cellMetadata: Record<string, any>;
  setCellMetadata: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  masterColumnOrder: string[];
  saveStateToHistory: () => void;
}

export function useSpreadsheetSelection({
  gridData,
  setGridData,
  cellMetadata,
  setCellMetadata,
  masterColumnOrder,
  saveStateToHistory,
}: UseSpreadsheetSelectionProps) {
  const [selection, setSelection] = useState<{ startRow: number; endRow: number; startCol: string; endCol: string } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [dragFillRange, setDragFillRange] = useState<{ startRow: number; endRow: number; col: string } | null>(null);

  const applyDragFill = useCallback((range: { startRow: number; endRow: number; col: string }) => {
    const { startRow, endRow, col } = range;
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
  }, [gridData, cellMetadata, masterColumnOrder, saveStateToHistory, setGridData, setCellMetadata]);

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

  return {
    selection,
    setSelection,
    isSelecting,
    setIsSelecting,
    dragFillRange,
    setDragFillRange,
    applyDragFill,
    handleDragFillStart
  };
}
