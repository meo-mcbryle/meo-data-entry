import React, { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { toA1Key, fromA1Key } from '@/lib/excel-utils';

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
  const [customValue, setCustomValue] = useState('');

  if (!dropdownMenu) return null;

  const colIdx = masterColumnOrder.indexOf(dropdownMenu.col);
  const cellKey = colIdx !== -1 ? toA1Key(dropdownMenu.row, colIdx) : '';
  const meta = cellMetadata[cellKey] || {};
  const dropdownFont = meta.fontFamily || 'inherit';
  const dropdownSize = meta.fontSize ? (typeof meta.fontSize === 'number' ? `${meta.fontSize}px` : meta.fontSize) : '0.875rem';

  // 1. Gather all default options
  const defaultOptions = dropdownMenu.options;

  // 2. Scan gridData for any custom options already entered in this column
  const customOptionsSet = new Set<string>();
  if (colIdx !== -1) {
    gridData.forEach((value, key) => {
      const coords = fromA1Key(key);
      if (coords && coords.colIndex === colIdx && value !== undefined && value !== null) {
        const valStr = String(value).trim();
        if (valStr && !defaultOptions.includes(valStr)) {
          customOptionsSet.add(valStr);
        }
      }
    });
  }
  const customOptions = Array.from(customOptionsSet);
  const allOptions = [...defaultOptions, ...customOptions];

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = customValue.trim();
    if (val) {
      handleUpdateCell(dropdownMenu.row, dropdownMenu.col, val);
      setDropdownMenu(null);
    }
  };

  return (
    <div 
      className="fixed z-120 bg-card border border-border shadow-2xl rounded-xl py-1.5 max-h-80 flex flex-col animate-in fade-in slide-in-from-top-1 duration-200 dropdown-container"
      style={{ 
        left: Math.min(dropdownMenu.x, window.innerWidth - dropdownMenu.width - 20), 
        top: Math.min(dropdownMenu.y, window.innerHeight - 340),
        width: Math.max(dropdownMenu.width, 220), // Ensure minimum width for custom input input fields
        fontFamily: dropdownFont,
        fontSize: dropdownSize
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="overflow-y-auto flex-1 custom-scrollbar max-h-60">
        {allOptions.map((opt, idx) => {
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

      <div className="h-px bg-border my-1" />
      <form onSubmit={handleAddCustom} className="px-3 py-2 flex gap-1.5 bg-card">
        <input
          type="text"
          value={customValue}
          onChange={e => setCustomValue(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          placeholder="Custom option..."
          className="flex-1 min-w-0 bg-muted/40 border border-border rounded px-2 py-1 text-xs outline-none focus:border-accent text-foreground"
        />
        <button
          type="submit"
          className="bg-accent text-accent-foreground rounded p-1 hover:opacity-90 flex items-center justify-center shrink-0"
          title="Add custom option"
        >
          <Plus size={14} />
        </button>
      </form>
    </div>
  );
};

