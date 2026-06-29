import React from 'react';
import { Check } from 'lucide-react';
import { toA1Key } from '@/lib/excel-utils';

interface DropdownMenuProps {
  dropdownMenu: {
    x: number;
    y: number;
    width: number;
    row: number;
    col: string;
    options: string[];
    highlightIndex: number;
  } | null;
  setDropdownMenu: (value: any) => void;
  masterColumnOrder: string[];
  cellMetadata: Record<string, any>;
  gridData: Map<string, any>;
  handleUpdateCell: (row: number, col: string, value: any) => void;
}

export const DropdownMenu = ({
  dropdownMenu,
  setDropdownMenu,
  masterColumnOrder,
  cellMetadata,
  gridData,
  handleUpdateCell
}: DropdownMenuProps) => {
  if (!dropdownMenu) return null;

  const colIdx = masterColumnOrder.indexOf(dropdownMenu.col);
  const cellKey = colIdx !== -1 ? toA1Key(dropdownMenu.row, colIdx) : '';
  const meta = cellMetadata[cellKey] || {};
  const dropdownFont = meta.fontFamily || 'inherit';
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
};
