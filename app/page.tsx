'use client';
import React, { useEffect, useState, useMemo, useCallback, Fragment, Suspense, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import { buildTree, FileNode, findNodeById } from '@/lib/tree-utils';
import FileNodeItem from '@/components/FileNodeItem';
import { Clock, User, HardDrive, Folder, Save, Code, Table as TableIcon, Plus, Trash2, X, AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Search, Printer, FileText, Share2, FolderPlus, FilePlus, PanelLeftClose, PanelLeftOpen, ChevronUp, ChevronDown, ArrowUp, Loader2, RefreshCcw, Calendar, Sigma, Image as ImageIcon, Paperclip, FileIcon, ChevronRight as ChevronRightIcon, Maximize2, Minimize2 } from 'lucide-react';

function DashboardContent() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'table' | 'compare'>('table');
  const [columnAlignments, setColumnAlignments] = useState<Record<string, 'left' | 'center' | 'right'>>({});
  const [cellAlignments, setCellAlignments] = useState<Record<string, 'left' | 'center' | 'right'>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [cellMetadata, setCellMetadata] = useState<Record<string, any>>({});
  const [rowFilter, setRowFilter] = useState<string>('');
  const [newColName, setNewColName] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('2020');
  const searchParams = useSearchParams();
  const [isExplorerVisible, setIsExplorerVisible] = useState(true);
  const [explorerSearch, setExplorerSearch] = useState('');
  const [isMetadataVisible, setIsMetadataVisible] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [activeCell, setActiveCell] = useState<{ row: number, col: string } | null>(null);
  const formulaBarRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingMedia, setPendingMedia] = useState<{ row: number, col: string, type: 'image' | 'file' } | null>(null);
  const [viewingMedia, setViewingMedia] = useState<any | null>(null);
  const [codeViewContent, setCodeViewContent] = useState<string>('');
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [dragFillRange, setDragFillRange] = useState<{ startRow: number; endRow: number; col: string } | null>(null);
  const [selection, setSelection] = useState<{ startRow: number; endRow: number; startCol: string; endCol: string } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const activeNode = useMemo(() => 
    selectedId ? findNodeById(tree, selectedId) : null
  , [tree, selectedId]);

  // End selection on global mouse up
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsSelecting(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Synchronize code view content when switching to code mode or selecting a node
  useEffect(() => {
    // If we are currently editing the code, don't overwrite the user's input
    // unless the view mode or active node has actually changed.
    if (viewMode !== 'code') return;

    if (viewMode === 'code' && activeNode) {
      try {
        const fullData = {
          content: JSON.parse(editedContent || '[]'),
          display_settings: {
            columnAlignments,
            cellAlignments,
            hiddenColumns,
            selectedYear,
            columnOrder,
            columnWidths,
            cellMetadata
          }
        };
        const newCode = JSON.stringify(fullData, null, 2);
        // Only update if it's actually different to avoid cursor jumps
        if (newCode !== codeViewContent) {
          setCodeViewContent(newCode);
        }
      } catch (e) {
        // Do not overwrite codeViewContent with editedContent here, 
        // as it would strip the display_settings wrapper during syntax errors.
      }
    }
  }, [viewMode, activeNode?.id, editedContent, columnAlignments, cellAlignments, hiddenColumns, selectedYear, columnOrder, columnWidths, cellMetadata]);

  const handleCodeChange = (val: string) => {
    setCodeViewContent(val);
    try {
      const parsed = JSON.parse(val);
      
      // If user pasted/typed the full document structure
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.content) {
        setEditedContent(JSON.stringify(parsed.content, null, 2));
        if (parsed.display_settings) {
          const ds = parsed.display_settings;
          setColumnAlignments(ds.columnAlignments || {});
          setCellAlignments(ds.cellAlignments || {});
          setHiddenColumns(ds.hiddenColumns || []);
          setSelectedYear(ds.selectedYear || '2020');
          setColumnOrder(ds.columnOrder || []);
          setColumnWidths(ds.columnWidths || {});
          setCellMetadata(ds.cellMetadata || {});
        }
      } 
      // If user pasted/typed just the data array (backward compatibility)
      else if (Array.isArray(parsed)) {
        setEditedContent(val);
      }
    } catch (e) {
      // While typing, the JSON might be invalid. 
      // We update editedContent directly so switching back to Table View 
      // triggers the JSON Syntax Error boundary if the input is broken.
      setEditedContent(val);
    }
  };

  const toggleAlignment = useCallback((header: string) => {
    setColumnAlignments(prev => {
      const current = prev[header] || 'left';
      const nextMap: Record<string, 'left' | 'center' | 'right'> = {
        left: 'center',
        center: 'right',
        right: 'left'
      };
      return { ...prev, [header]: nextMap[current] };
    });
  }, []);

  // Auto-expand formula bar height based on content
  useEffect(() => {
    if (formulaBarRef.current) {
      formulaBarRef.current.style.height = 'auto';
      formulaBarRef.current.style.height = `${formulaBarRef.current.scrollHeight}px`;
    }
  }, [activeCell, editedContent]);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, row?: number, col: string, type: 'cell' | 'header', showFormats?: boolean, showFormulaFormats?: boolean, showNumberFormats?: boolean } | null>(null);

  const getExcelColumnLabel = (index: number): string => {
    let label = '';
    let i = index;
    while (i >= 0) {
      label = String.fromCharCode((i % 26) + 65) + label;
      i = Math.floor(i / 26) - 1;
    }
    return label;
  };

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

  const formatNumberDisplay = (value: any, formatId: string = 'decimal') => {
    if (value === "" || value === undefined || value === null) return "0.00";
    const num = Number(value);
    if (isNaN(num)) return value;

    switch (formatId) {
      case 'currency': 
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num);
      case 'percent':
        return (num * 100).toFixed(2) + '%';
      case 'integer':
        return Math.round(num).toLocaleString();
      default: // decimal
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  };

  const formatDateDisplay = (value: string, formatId: string = 'long') => {
    if (!value) return '';
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return value;

    switch (formatId) {
      case 'medium': return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      case 'short': return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
      case 'iso': return value;
      default: return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  };

  const evaluateFormula = useCallback((value: any, rowData: any, formatId?: string) => {
    if (typeof value !== 'string' || !value.startsWith('=')) return value;

    try {
      // Helper to find column value regardless of case
      const getColumnValue = (colName: string) => {
        const actualKey = Object.keys(rowData).find(
          key => key.toLowerCase() === colName.toLowerCase()
        );
        return actualKey ? rowData[actualKey] : null;
      };

      // Basic SUM implementation: =SUM(Col1, Col2)
      if (value.toUpperCase().startsWith('=SUM(')) {
        const match = value.match(/\=SUM\((.*)\)/i);
        if (!match) return '#ERROR!';
        const args = match[1].split(',').map(s => s.trim());
        return args.reduce((acc, colName) => acc + (Number(getColumnValue(colName)) || 0), 0);
      }

      // Add Days to Date: =ADD_DAYS(DateColumn, DaysColumn)
      if (value.toUpperCase().startsWith('=ADD_DAYS(')) {
        const match = value.match(/\=ADD_DAYS\((.*)\)/i);
        if (!match) return '#ERROR!';
        const args = match[1].split(',').map(s => s.trim());
        if (args.length !== 2) return '#ARGS!';

        const startDateRaw = getColumnValue(args[0]);
        // Support both column names and direct numbers for the second argument
        const daysToAdd = Number(getColumnValue(args[1]) ?? args[1]) || 0;

        if (!startDateRaw) return '';

        // Robust Date Parsing
        let date: Date;
        if (typeof startDateRaw === 'string' && startDateRaw.includes('-')) {
          const [y, m, d] = startDateRaw.split('-').map(Number);
          date = new Date(y, m - 1, d);
        } else {
          date = new Date(startDateRaw);
        }

        if (isNaN(date.getTime())) return '#DATE!';

        date.setDate(date.getDate() + daysToAdd);
        const iso = date.toISOString().split('T')[0];
        return formatDateDisplay(iso, formatId);
      }
    } catch (e) {
      return '#ERR!';
    }
    return value;
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
      if (!resizingRef.current) return;
      const delta = moveEvent.pageX - resizingRef.current.startX;
      const newWidth = Math.max(80, resizingRef.current.startWidth + delta);
      setColumnWidths(prev => ({
        ...prev,
        [resizingRef.current!.header]: newWidth
      }));
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
  }, []);

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
    const handleGlobalClick = () => setContextMenu(null);
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

  const LOCATIONS = [
    "Antonino, Labason, Zamboanga del Norte",
    "Balas, Labason, Zamboanga del Norte",
    "Bobongan, Labason, Zamboanga del Norte",
    "Dansalan, Labason, Zamboanga del Norte",
    "Gabu, Labason, Zamboanga del Norte",
    "Gil Sanchez, Labason, Zamboanga del Norte",
    "Imelda, Labason, Zamboanga del Norte",
    "Immaculada, Labason, Zamboanga del Norte",
    "Kipit, Labason, Zamboanga del Norte",
    "La Union, Labason, Zamboanga del Norte",
    "Lapatan, Labason, Zamboanga del Norte",
    "Lawagan, Labason, Zamboanga del Norte",
    "Lawigan, Labason, Zamboanga del Norte",
    "Lopoc, Labason, Zamboanga del Norte",
    "Malintuboan, Labason, Zamboanga del Norte",
    "New Salvacion, Labason, Zamboanga del Norte",
    "Osukan, Labason, Zamboanga del Norte",
    "Poblacion, Labason, Zamboanga del Norte",
    "Patawag, Labason, Zamboanga del Norte",
    "San Isidro, Labason, Zamboanga del Norte",
    "Ubay, Labason, Zamboanga del Norte"
  ];
  const ALLOCATIONS = ["20%", "DepEd", "DA"];

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('nodes').select('*').order('name');
    
    if (error) {
      console.error('Error fetching files:', error.message);
    } else if (data) {
      setTree(buildTree(data as FileNode[]));
    }
    setIsLoading(false);
  }, []);

  const addItem = async (type: 'file' | 'folder', parentId: string | null = null) => {
    const name = window.prompt(`Enter ${type} name:`);
    if (!name) return;

    const { error } = await supabase.from('nodes').insert([{ name, type, parent_id: parentId }]);
    if (error) {
      alert(`Failed to create ${type}: ${error.message}`);
      return;
    }
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
    fetchFiles();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    const { error } = await supabase.from('nodes').delete().eq('id', id);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }
    if (selectedId === id) setSelectedId(null);
    fetchFiles();
  };

  const handleUpdateCell = (index: number, key: string, value: any) => {
    try {
      const data = JSON.parse(editedContent || '[]');
      if (!Array.isArray(data)) return;
      const newData = [...data];
      newData[index] = { ...newData[index], [key]: value };
      setEditedContent(JSON.stringify(newData, null, 2));
    } catch (e) {
      console.error("Invalid JSON while updating cell");
    }
  };

  const handleRenameSection = (oldName: string, newName: string) => {
    if (!newName || oldName === newName) return;
    try {
      const data = JSON.parse(editedContent || '[]');
      const newData = data.map((row: any) => 
        row.section === oldName ? { ...row, section: newName } : row
      );
      setEditedContent(JSON.stringify(newData, null, 2));
    } catch (e) {
      console.error("Failed to rename section");
    }
  };

  const handleAddSection = () => {
    const sectionName = window.prompt("Enter new section name:");
    if (!sectionName) return;
    try {
      const data = JSON.parse(editedContent || '[]');
      const newRow = { "Title / Item": "a.", "Amount": 0, "Location": "", "Allocation": "", "section": sectionName };
      setEditedContent(JSON.stringify([...data, newRow], null, 2));
    } catch (e) {
      setEditedContent(JSON.stringify([{ "Title / Item": "a.", "Amount": 0, "section": sectionName }], null, 2));
    }
  };

  const handleDeleteSection = (sectionName: string) => {
    if (!window.confirm(`Are you sure you want to delete the entire section "${sectionName}" and all its rows?`)) return;
    try {
      const data = JSON.parse(editedContent || '[]');
      const newData = data.filter((row: any) => row.section !== sectionName);
      setEditedContent(JSON.stringify(newData, null, 2));
      if (newData.length === 0) {
        setSelectedId(null);
      }
    } catch (e) {
      console.error("Failed to delete section");
    }
  };

  const handleShare = () => {
    if (!selectedId) return;
    const url = `${window.location.origin}/?id=${selectedId}`;
    navigator.clipboard.writeText(url);
    alert("Shareable link copied to clipboard!");
  };

  const exportToCSV = () => {
    try {
      const data = JSON.parse(editedContent || '[]');
      if (!Array.isArray(data) || data.length === 0) return;
      
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(','))
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
    } catch (e) {
      alert("Failed to export CSV: " + e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number, headers: string[]) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
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
      }

      try {
        const data = JSON.parse(editedContent || '[]');
        if (nextRow >= 0 && nextRow < data.length) {
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
      } catch (err) {}
    }
  };

  const toggleCellAlignment = (rowIndex: number, header: string) => {
    setCellAlignments(prev => {
      const next = { ...prev };
      const cellKey = `${rowIndex}:${header}`;
      const current = prev[cellKey] || columnAlignments[header] || 'left';
      const nextMap: Record<string, 'left' | 'center' | 'right'> = {
        left: 'center',
        center: 'right',
        right: 'left'
      };
      const nextAlign = nextMap[current];

      try {
        const data = JSON.parse(editedContent || '[]');
        const allHeaders = data.length > 0 ? Object.keys(data[0]) : [];
        const baseOrder = columnOrder.length > 0 ? columnOrder : allHeaders;
        const uniqueObjectKeys = allHeaders.filter(k => !baseOrder.includes(k));
        const finalOrder = [...baseOrder, ...uniqueObjectKeys];
        const visibleHeaders = finalOrder.filter(h => !hiddenColumns.includes(h) && h !== 'section' && allHeaders.includes(h));

        if (selection && selection.startRow !== -1) {
          const minRow = Math.min(selection.startRow, selection.endRow);
          const maxRow = Math.max(selection.startRow, selection.endRow);
          const startColIdx = visibleHeaders.indexOf(selection.startCol);
          const endColIdx = visibleHeaders.indexOf(selection.endCol);
          const minColIdx = Math.min(startColIdx, endColIdx);
          const maxColIdx = Math.max(startColIdx, endColIdx);

          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minColIdx; c <= maxColIdx; c++) {
              next[`${r}:${visibleHeaders[c]}`] = nextAlign;
            }
          }
        } else {
          next[cellKey] = nextAlign;
        }
      } catch (e) {
        next[cellKey] = nextAlign;
      }
      return next;
    });
  };

  const toggleColumnVisibility = (key: string) => {
    setHiddenColumns(prev => 
      prev.includes(key) ? prev.filter(col => col !== key) : [...prev, key]
    );
  };

  const handleRenameColumn = (oldKey: string, newKey: string) => {
    const trimmedNewKey = newKey?.trim();
    if (!trimmedNewKey || oldKey === trimmedNewKey) return;

    if (trimmedNewKey.toLowerCase() === 'section') {
      alert("'section' is a reserved column name used for categorization.");
      return;
    }

    try {
      const data = JSON.parse(editedContent || '[]');
      if (!Array.isArray(data)) return;

      const allHeaders = data.length > 0 ? Object.keys(data[0]) : [];
      if (allHeaders.includes(trimmedNewKey)) {
        alert(`A column named "${trimmedNewKey}" already exists.`);
        return;
      }

      const newData = data.map((row: any) => {
        const { [oldKey]: value, ...rest } = row;
        return { ...rest, [trimmedNewKey]: value };
      });

      // Migrate alignments and metadata to the new column name
      setColumnAlignments(prev => {
        const next = { ...prev };
        if (next[oldKey]) {
          next[trimmedNewKey] = next[oldKey];
          delete next[oldKey];
        }
        return next;
      });
      setColumnWidths(prev => {
        const next = { ...prev };
        if (next[oldKey]) {
          next[trimmedNewKey] = next[oldKey];
          delete next[oldKey];
        }
        return next;
      });
      const migrateKeys = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        Object.keys(prev).forEach(key => {
          if (key.endsWith(`:${oldKey}`)) {
            const [r] = key.split(':');
            next[`${r}:${trimmedNewKey}`] = prev[key];
          } else { next[key] = prev[key]; }
        });
        return next;
      };
      setCellMetadata(migrateKeys);
      setCellAlignments(migrateKeys);

      setColumnOrder(prev => {
        const currentOrder = prev.length > 0 ? prev : allHeaders;
        return currentOrder.map(col => col === oldKey ? trimmedNewKey : col);
      });
      setEditedContent(JSON.stringify(newData, null, 2));
    } catch (e) {
      alert("Cannot rename column: The data is currently invalid JSON. Please fix it in the Code View first.");
    }
  };

  const handleAddColumn = (name?: string) => {
    const rawInput = typeof name === 'string' ? name : window.prompt("Enter new column name (leave blank for auto-name):");
    if (rawInput === null) return;
    
    let colName = rawInput.trim();

    try {
      const data = JSON.parse(editedContent || '[]');
      if (!Array.isArray(data)) return;

      const allHeaders = data.length > 0 ? Object.keys(data[0]) : [];

      if (!colName) {
        let i = 1;
        while (allHeaders.includes(`Column ${i}`)) i++;
        colName = `Column ${i}`;
      }

      if (colName.toLowerCase() === 'section') {
        alert("'section' is a reserved column name used for categorization.");
        return;
      }

      if (allHeaders.includes(colName)) {
        alert(`A column named "${colName}" already exists.`);
        return;
      }

      const newData = data.map((row: any) => ({ ...row, [colName]: "" }));
      if (newData.length === 0) newData.push({ [colName]: "" });
      
      setColumnOrder(prev => {
        const currentOrder = prev.length > 0 ? prev : allHeaders;
        return [...currentOrder, colName];
      });
      setEditedContent(JSON.stringify(newData, null, 2));
    } catch (e) {
      alert("Cannot add column: The data is currently invalid JSON. Please fix it in the Code View first.");
    }
  };

  const handleDeleteColumn = (keyToDelete: string) => {
    if (!window.confirm(`Are you sure you want to delete the column "${keyToDelete}"?`)) return;
    try {
      const data = JSON.parse(editedContent || '[]');
      const newData = data.map((row: any) => {
        const { [keyToDelete]: _, ...rest } = row;
        return rest;
      });

      // Cleanup metadata and alignments for the deleted column
      setColumnAlignments(prev => { const n = { ...prev }; delete n[keyToDelete]; return n; });
      setColumnWidths(prev => { const n = { ...prev }; delete n[keyToDelete]; return n; });
      const filterKeys = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        Object.keys(prev).forEach(key => {
          if (!key.endsWith(`:${keyToDelete}`)) next[key] = prev[key];
        });
        return next;
      };
      setCellMetadata(filterKeys);
      setCellAlignments(filterKeys);

      setColumnOrder(prev => prev.filter(col => col !== keyToDelete));
      setEditedContent(JSON.stringify(newData, null, 2));
    } catch (e) {
      console.error("Failed to delete column");
    }
  };

  const handleInsertColumn = (relativeCol: string, position: 'before' | 'after') => {
    const rawInput = window.prompt(`Enter new column name (leave blank for auto-name):`);
    if (rawInput === null) return;
    
    let colName = rawInput.trim();

    try {
      const data = JSON.parse(editedContent || '[]');
      if (!Array.isArray(data)) return;
      
      const allHeaders = data.length > 0 ? Object.keys(data[0]) : [];

      if (!colName) {
        let i = 1;
        while (allHeaders.includes(`Column ${i}`)) i++;
        colName = `Column ${i}`;
      }

      if (colName.toLowerCase() === 'section') {
        alert("'section' is a reserved column name used for categorization.");
        return;
      }

      if (allHeaders.includes(colName)) {
        alert("A column with this name already exists.");
        return;
      }

      const baseOrder = columnOrder.length > 0 ? columnOrder : allHeaders;
      const index = baseOrder.indexOf(relativeCol);
      const newOrder = [...baseOrder];
      if (index !== -1) {
        newOrder.splice(position === 'before' ? index : index + 1, 0, colName);
      } else {
        newOrder.push(colName);
      }

      const newData = data.map((row: any) => ({ ...row, [colName]: "" }));
      if (newData.length === 0) newData.push({ [colName]: "" });
      
      setColumnOrder(newOrder);
      setEditedContent(JSON.stringify(newData, null, 2));
    } catch (e) {
      console.error("Failed to insert column", e);
    }
  };

  const addTableRow = () => {
    try {
      const data = JSON.parse(editedContent || '[]');
      let template: Record<string, any>;
      if (Array.isArray(data) && data.length > 0) {
        template = Object.keys(data[0]).reduce((acc, key) => ({ ...acc, [key]: "" }), {});
      } else {
        template = { "Title / Item": "a.", "Amount": 0, "Location": "", "Allocation": "", "section": "Work A" };
      }
      
      const newData = Array.isArray(data) ? [...data, template] : [template];
      setEditedContent(JSON.stringify(newData, null, 2));
    } catch (e) {
      setEditedContent(JSON.stringify([{ "Title / Item": "a.", "Amount": 0, "section": "Work A" }], null, 2));
    }
  };

  const addRowToSection = (sectionName: string) => {
    try {
      const data = JSON.parse(editedContent || '[]');
      const sectionRows = data.filter((r: any) => r.section === sectionName);
      // Determine next letter (a, b, c...)
      const nextLetter = sectionRows.length > 0 
        ? String.fromCharCode(sectionRows[sectionRows.length - 1]["Title / Item"].charCodeAt(0) + 1)
        : "a";
      
      const newRow = { "Title / Item": `${nextLetter}.`, "Amount": 0, "Location": "", "Allocation": "", "section": sectionName };
      setEditedContent(JSON.stringify([...data, newRow], null, 2));
    } catch (e) {
      console.error("Failed to insert row into section");
    }
  };

  const handleResetWidths = () => {
    if (window.confirm('Reset all column widths? This will allow columns to auto-fit based on their content.')) {
      setColumnWidths({});
    }
  };

  const setCellType = (row: number, col: string, type: string, format: string = 'long') => {
    setCellMetadata(prev => ({
      ...prev,
      ...(() => {
        const next: Record<string, any> = {};
        try {
          const data = JSON.parse(editedContent || '[]');
          const allHeaders = data.length > 0 ? Object.keys(data[0]) : [];
          const baseOrder = columnOrder.length > 0 ? columnOrder : allHeaders;
          const uniqueObjectKeys = allHeaders.filter(k => !baseOrder.includes(k));
          const finalOrder = [...baseOrder, ...uniqueObjectKeys];
          const visibleHeaders = finalOrder.filter(h => !hiddenColumns.includes(h) && h !== 'section' && allHeaders.includes(h));

          if (selection && selection.startRow !== -1) {
            const minRow = Math.min(selection.startRow, selection.endRow);
            const maxRow = Math.max(selection.startRow, selection.endRow);
            const startColIdx = visibleHeaders.indexOf(selection.startCol);
            const endColIdx = visibleHeaders.indexOf(selection.endCol);
            const minColIdx = Math.min(startColIdx, endColIdx);
            const maxColIdx = Math.max(startColIdx, endColIdx);

            for (let r = minRow; r <= maxRow; r++) {
              for (let c = minColIdx; c <= maxColIdx; c++) {
                const k = `${r}:${visibleHeaders[c]}`;
                next[k] = { ...prev[k], type, format };
              }
            }
          } else {
            next[`${row}:${col}`] = { ...prev[`${row}:${col}`], type, format };
          }
        } catch (e) {
          next[`${row}:${col}`] = { ...prev[`${row}:${col}`], type, format };
        }
        return next;
      })()
    }));
    setContextMenu(null);
  };

  const insertMedia = (row: number, col: string, mediaType: 'image' | 'file') => {
    setPendingMedia({ row, col, type: mediaType });
    setContextMenu(null);
    // Use timeout to ensure state update doesn't interfere with the click event
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingMedia || !activeNode) return;

    const { row, col, type } = pendingMedia;
    const key = `${row}:${col}`;
    
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

  const removeCellMetadata = async (row: number, col: string) => {
    if (!window.confirm("Are you sure you want to remove all attachments and formatting from this cell?")) return;

    const key = `${row}:${col}`;
    const meta = cellMetadata[key];

    // Cleanup all files in this cell from storage
    if (meta?.attachments) {
      const paths = meta.attachments.map((a: any) => a.path).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('attachments').remove(paths);
      }
    }

    setCellMetadata(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setContextMenu(null);
  };

  const deleteAttachment = async (row: number, col: string, index: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this attachment?")) return;

    const key = `${row}:${col}`;
    const existing = cellMetadata[key];
    if (!existing || !existing.attachments) return;

    const attachmentToDelete = existing.attachments[index];

    try {
      // Remove from Supabase storage if path exists
      if (attachmentToDelete.path) {
        await supabase.storage.from('attachments').remove([attachmentToDelete.path]);
      }

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
    } catch (err: any) {
      alert('Failed to delete file from storage: ' + err.message);
    }
  };

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
        <div className="p-8 bg-white border border-slate-200 rounded-lg shadow-sm h-full flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Share2 className="text-blue-500" size={20} />
              Project Comparison Setup
            </h3>
            <p className="text-sm text-slate-500">Select at least two files from the list below to compare their project data side-by-side.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2">
            {allFiles.map(file => (
              <label 
                key={file.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:border-blue-300 ${
                  comparisonIds.includes(file.id) ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400' : 'bg-white border-slate-200'
                }`}
              >
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={comparisonIds.includes(file.id)}
                  onChange={() => toggleComparisonId(file.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-tighter">
                    {file.display_settings?.selectedYear || 'No Year Set'}
                  </p>
                </div>
                <FileText size={16} className={comparisonIds.includes(file.id) ? 'text-blue-500' : 'text-slate-300'} />
              </label>
            ))}
          </div>
          
          {comparisonIds.length === 1 && (
            <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-xs">
              <div className="p-1 bg-amber-200 rounded-full"><Plus size={12} /></div>
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
      <div className="flex flex-col h-full border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Side-by-Side Comparison</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setComparisonIds([])}
              className="px-2 py-1 bg-white border border-slate-300 text-slate-600 text-[10px] font-bold rounded hover:bg-red-50 hover:text-red-600 transition-colors mr-2"
            >
              Clear Selection
            </button>
            {nodesToCompare.map(n => (
              <span key={n!.id} className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded capitalize">{n!.name}</span>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
              <tr>
                <th className="p-3 text-[11px] font-bold border-r border-b text-slate-600 w-72 sticky left-0 bg-slate-100 z-20 shadow-[1px_0_0_0_#e2e8f0]">Title / Item</th>
                {nodesToCompare.map(n => (
                  <Fragment key={n!.id}>
                    <th className="p-3 text-[11px] font-bold border-r border-b text-blue-600 text-right">Amount ({n!.name})</th>
                    <th className="p-3 text-[11px] font-bold border-r border-b text-slate-400">Status/Loc</th>
                  </Fragment>
                ))}
                <th className="p-3 text-[11px] font-bold border-b bg-green-50 text-green-700 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {sortedSections.map(sectionName => {
                const projectsInSection = Array.from(sectionMap.get(sectionName)!).sort();
                
                return (
                  <Fragment key={sectionName}>
                    <tr className="bg-slate-100/80">
                      <td colSpan={2 + nodesToCompare.length * 2} className="px-3 py-1 border-b border-slate-200 font-black text-slate-800 tracking-widest text-[11px] uppercase sticky left-0 z-10 bg-slate-100 shadow-[1px_0_0_0_#e2e8f0]">
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
                        <tr key={`${sectionName}-${title}`} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                          <td className="p-3 text-sm font-medium text-slate-800 border-r bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">{title}</td>
                          {values.map((v, idx) => (
                            <Fragment key={idx}>
                              <td className="p-3 text-sm font-mono text-right border-r">
                          {v ? Number(v.Amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="p-3 text-[10px] text-slate-500 italic border-r truncate max-w-[120px]">
                                {v?.Location || v?.Allocation || ""}
                              </td>
                            </Fragment>
                          ))}
                          <td className={`p-3 text-sm font-bold text-right ${variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-slate-400'}`}>
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

  const handleMergeCells = useCallback((visibleHeaders: string[], isHeaderMerge: boolean = false) => {
    if (!selection) return;
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
    const hostKey = isHeaderSelection ? `header:${hostCol}` : `${minRow}:${hostCol}`;
    const newMetadata = { ...cellMetadata };

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minColIdx; c <= maxColIdx; c++) {
        const key = isHeaderSelection ? `header:${visibleHeaders[c]}` : `${r}:${visibleHeaders[c]}`;
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
        const currentKey = isHeaderSelection ? `header:${visibleHeaders[c]}` : `${r}:${visibleHeaders[c]}`;
        if (currentKey !== hostKey) {
          newMetadata[currentKey] = { ...newMetadata[currentKey], mergedIn: hostKey };
        }
      }
    }
    setCellMetadata(newMetadata);
    setSelection(null);
  }, [selection, cellMetadata]);

  const handleUnmergeCells = useCallback((row: number, col: string, visibleHeaders: string[]) => {
    const isHeader = row === -1;
    const key = isHeader ? `header:${col}` : `${row}:${col}`;
    const meta = cellMetadata[key];
    if (!meta || (!meta.rowSpan && !meta.colSpan)) return;

    const newMetadata = { ...cellMetadata };
    const { rowSpan = 1, colSpan = 1 } = meta;
    const colIdx = visibleHeaders.indexOf(col);
    
    const startR = isHeader ? -1 : row;
    const endR = isHeader ? -1 : row + rowSpan - 1;

    for (let r = startR; r <= endR; r++) {
      for (let c = colIdx; c < colIdx + colSpan; c++) {
        const currentKey = isHeader ? `header:${visibleHeaders[c]}` : `${r}:${visibleHeaders[c]}`;
        const m = { ...newMetadata[currentKey] };
        delete m.rowSpan; delete m.colSpan; delete m.mergedIn;
        if (Object.keys(m).length === 0) delete newMetadata[currentKey];
        else newMetadata[currentKey] = m;
      }
    }
    setCellMetadata(newMetadata);
  }, [cellMetadata]);

  const handleDragFillStart = (e: React.MouseEvent, row: number, col: string) => {
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
  };

  const applyDragFill = (range: { startRow: number; endRow: number; col: string }) => {
    const { startRow, endRow, col } = range;
    if (startRow === endRow) return;

    try {
      const data = JSON.parse(editedContent || '[]');
      const sourceValue = data[startRow][col];
      const sourceMeta = cellMetadata[`${startRow}:${col}`];
      
      const newData = [...data];
      const newMetadata = { ...cellMetadata };

      const min = Math.min(startRow, endRow);
      const max = Math.max(startRow, endRow);

      for (let i = min; i <= max; i++) {
        if (i === startRow) continue;
        
        newData[i] = { ...newData[i], [col]: sourceValue };
        const targetKey = `${i}:${col}`;
        if (sourceMeta) {
          newMetadata[targetKey] = { ...sourceMeta };
        } else {
          delete newMetadata[targetKey];
        }
      }

      setEditedContent(JSON.stringify(newData, null, 2));
      setCellMetadata(newMetadata);
    } catch (e) {
      console.error("Failed to apply drag fill", e);
    }
  };

  const removeTableRow = async (index: number) => {
    if (!window.confirm("Are you sure you want to delete this row? Any associated attachments will be permanently removed.")) return;

    // Identify all attachments in this row to cleanup storage
    const rowPrefix = `${index}:`;
    const pathsToDelete: string[] = [];
    Object.keys(cellMetadata).forEach(key => {
      if (key.startsWith(rowPrefix)) {
        const meta = cellMetadata[key];
        if (meta?.attachments) {
          meta.attachments.forEach((a: any) => { if (a.path) pathsToDelete.push(a.path); });
        }
      }
    });

    if (pathsToDelete.length > 0) {
      try {
        await supabase.storage.from('attachments').remove(pathsToDelete);
      } catch (err) { console.error("Storage cleanup failed:", err); }
    }

    try {
      const data = JSON.parse(editedContent || '[]');
      if (!Array.isArray(data)) return;
      const newData = data.filter((_, i) => i !== index);

      // Shift metadata and alignments for all rows following the deleted one
      const shiftKeys = (prev: Record<string, any>) => {
        const next: Record<string, any> = {};
        Object.keys(prev).forEach(key => {
          const [rStr, ...cParts] = key.split(':');
          const r = parseInt(rStr);
          const col = cParts.join(':');
          if (r < index) next[key] = prev[key];
          else if (r > index) next[`${r - 1}:${col}`] = prev[key];
        });
        return next;
      };
      setCellMetadata(shiftKeys);
      setCellAlignments(shiftKeys);

      setEditedContent(JSON.stringify(newData, null, 2));
    } catch (e) {
      console.error("Failed to remove row");
    }
  };

  // Sync editor content with the selected file
  useEffect(() => {
    if (activeNode?.type === 'file') {
      setEditedContent(JSON.stringify(activeNode.content || {}, null, 2));
      setColumnAlignments(activeNode.display_settings?.columnAlignments || {});
      setCellAlignments(activeNode.display_settings?.cellAlignments || {});
      setColumnOrder(activeNode.display_settings?.columnOrder || []);
      setHiddenColumns(activeNode.display_settings?.hiddenColumns || []);
      setColumnWidths(activeNode.display_settings?.columnWidths || {});
      setCellMetadata(activeNode.display_settings?.cellMetadata || {});
      setSelectedYear(activeNode.display_settings?.selectedYear || '2020');
      setActiveCell(null);
      setRowFilter('');
      setShowBackToTop(false);
      tableContainerRef.current?.scrollTo({ top: 0 });
    } else {
      setEditedContent('');
      setColumnAlignments({});
      setCellAlignments({});
      setColumnOrder([]);
      setHiddenColumns([]);
      setCellMetadata({});
      setActiveCell(null);
      setSelectedYear('2020');
      setRowFilter('');
      setShowBackToTop(false);
    }
  }, [activeNode?.id, activeNode?.type, activeNode?.content, activeNode?.display_settings]);

  const handleSave = async () => {
    if (!activeNode || activeNode.type !== 'file') return;
    
    setIsSaving(true);
    try {
      const content = JSON.parse(editedContent);
      const display_settings = { columnAlignments, cellAlignments, hiddenColumns, selectedYear, columnOrder, columnWidths, cellMetadata };
      const { error } = await supabase.from('nodes').update({ content, display_settings }).eq('id', activeNode.id);
      if (error) throw error;
      await fetchFiles();
    } catch (err: any) {
      alert(err.message || 'Invalid JSON format');
    } finally {
      setIsSaving(false);
    }
  };

  const initializeExcelTemplate = () => {
    const template = [
      { "Title / Item": "a.", "Amount": 0, "Location": "Manila", "Allocation": "Capital", "Notes": "Initial entry", "section": "Work A" },
      { "Title / Item": "b.", "Amount": 0, "Location": "", "Allocation": "", "Notes": "", "section": "Work A" },
      { "Title / Item": "c.", "Amount": 0, "Location": "", "Allocation": "", "Notes": "", "section": "Work A" },
      { "Title / Item": "a.", "Amount": 0, "Location": "", "Allocation": "", "Notes": "", "section": "Work B" },
    ];
    setColumnOrder(["Title / Item", "Amount", "Location", "Allocation", "Notes"]);
    setEditedContent(JSON.stringify(template, null, 2));
  };

  const renderTableEditor = () => {
    try {
      let data = JSON.parse(editedContent || '[]');
      // If empty or not array, show pre-format option
      if (!Array.isArray(data) || data.length === 0) {
        return (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 shadow-sm flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="font-semibold mb-1 text-sm">Pre-formatted Table Required</p>
              <p className="text-xs text-amber-700">Initialize the Work A / Work B structure for this file.</p>
            </div>
            <button 
              onClick={initializeExcelTemplate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors uppercase tracking-wider"
            >
              Initialize Excel Template
            </button>
          </div>
        );
      }

      if (rowFilter) {
        const lowerCaseFilter = rowFilter.toLowerCase();
        data = data.filter((row: any) => 
          Object.values(row).some(value => 
            String(value).toLowerCase().includes(lowerCaseFilter)
          )
        );
      }

      const allHeaders = data.length > 0 ? Object.keys(data[0]) : [];
      
      // Determine header order: Preferred order first, then any new keys found in the object
      const baseOrder = columnOrder.length > 0 ? columnOrder : allHeaders;
      const uniqueObjectKeys = allHeaders.filter(k => !baseOrder.includes(k));
      const finalOrder = [...baseOrder, ...uniqueObjectKeys];

      // Filter and finalize visible headers (excluding 'section')
      const visibleHeaders = finalOrder.filter(header => !hiddenColumns.includes(header) && header !== 'section' && allHeaders.includes(header));

      const sections = Array.from(new Set(data.map((r: any) => r.section || "Uncategorized")));

      return (
        <div className={`flex flex-col h-full overflow-hidden bg-white ${isFullScreen ? '' : 'border border-slate-200 rounded-lg shadow-sm'}`}>
          {/* Excel Toolbar */}
          <div className="flex items-center justify-between p-2 bg-slate-50 border-b border-slate-200 gap-2">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search records..." value={rowFilter} onChange={(e) => setRowFilter(e.target.value)} className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium">
                <span className="text-slate-400">Year:</span>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent border-0 font-bold text-blue-600 focus:ring-0 cursor-pointer">
                  <option value="2020">2020</option>
                  <option value="2021">2021</option>
                  <option value="2022">2022</option>
                  <option value="2023">2023</option>
                </select>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium">
                <span className="text-slate-400">Columns:</span>
                <select 
                  value="" 
                  onChange={(e) => { if(e.target.value) toggleColumnVisibility(e.target.value); e.target.value = ""; }}
                  className="bg-transparent border-0 font-bold text-blue-600 focus:ring-0 cursor-pointer max-w-[110px]"
                >
                  <option value="">{hiddenColumns.length > 0 ? `(${hiddenColumns.length} Hidden)` : "All Visible"}</option>
                  {allHeaders.filter(h => h !== 'section').map(h => (
                    <option key={h} value={h}>{hiddenColumns.includes(h) ? "Show" : "Hide"} {h}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleAddSection} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm">
                <Plus size={14} className="text-green-600" /> Add Section
              </button>
              <button onClick={handleResetWidths} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm text-slate-700" title="Reset all columns to auto-width">
                <RefreshCcw size={14} /> Reset Widths
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportToCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm text-slate-700">
                <HardDrive size={14} /> Export CSV
              </button>
            </div>
          </div>
          
          {/* Cell Context Menu */}
          {contextMenu && (
            <div 
              className="fixed z-[100] bg-white border border-slate-200 shadow-xl rounded-lg py-1 w-48 animate-in fade-in zoom-in duration-100"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.type === 'header' ? (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 tracking-widest border-b border-slate-100 uppercase">Column Options</div>
                  <button 
                    onClick={() => { toggleAlignment(contextMenu.col); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"
                  >
                    {columnAlignments[contextMenu.col] === 'center' ? <AlignCenter size={14} /> :
                     columnAlignments[contextMenu.col] === 'right' ? <AlignRight size={14} /> : <AlignLeft size={14} />}
                    Toggle Alignment
                  </button>
                  <button 
                    onClick={() => { handleMergeCells(visibleHeaders, true); setContextMenu(null); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"
                  >
                    <TableIcon size={14} className="text-blue-500" /> Merge Selected Headers
                  </button>
                  {cellMetadata[`header:${contextMenu.col}`]?.colSpan > 1 && (
                    <button 
                      onClick={() => { handleUnmergeCells(-1, contextMenu.col, visibleHeaders); setContextMenu(null); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"
                    >
                      <X size={14} className="text-orange-500" /> Unmerge Header
                    </button>
                  )}
                  <button 
                    onClick={() => { toggleColumnVisibility(contextMenu.col); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-slate-600"
                  >
                    <EyeOff size={14} /> Hide Column
                  </button>
                  <button 
                    onClick={() => { handleInsertColumn(contextMenu.col, 'before'); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-slate-600"
                  >
                    <Plus size={14} className="text-blue-500" /> Insert Column Before
                  </button>
                  <button 
                    onClick={() => { handleInsertColumn(contextMenu.col, 'after'); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-slate-600"
                  >
                    <Plus size={14} className="text-blue-500" /> Insert Column After
                  </button>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <button 
                    onClick={() => { handleDeleteColumn(contextMenu.col); setContextMenu(null); }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Delete Column
                  </button>
                </>
              ) : (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 tracking-widest border-b border-slate-100 uppercase">Selection Actions</div>
                  <button 
                    onClick={() => { handleMergeCells(visibleHeaders); setContextMenu(null); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"
                  >
                    <TableIcon size={14} className="text-blue-500" /> Merge Selected Cells
                  </button>
                  
                  {/* Unmerge only shows if the specific cell clicked is a merge host */}
                  {(cellMetadata[`${contextMenu.row}:${contextMenu.col}`]?.rowSpan > 1 || cellMetadata[`${contextMenu.row}:${contextMenu.col}`]?.colSpan > 1) && (
                    <button 
                      onClick={() => { handleUnmergeCells(contextMenu.row!, contextMenu.col, visibleHeaders); setContextMenu(null); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"
                    >
                      <X size={14} className="text-orange-500" /> Unmerge Cells
                    </button>
                  )}

                  <div className="h-px bg-slate-100 my-1"></div>

                  {cellMetadata[`${contextMenu.row}:${contextMenu.col}`]?.type === 'media' && (
                    <button onClick={() => removeCellMetadata(contextMenu.row!, contextMenu.col)} className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2 border-b border-slate-100 font-bold"><Trash2 size={14} /> Remove Attachment</button>
                  )}

                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 tracking-widest border-b border-slate-100">Format Cell</div>
                  <button 
                    onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showFormats: false, showFormulaFormats: false, showNumberFormats: false } : null)}
                    onClick={() => setCellType(contextMenu.row!, contextMenu.col, 'text')} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"><FileText size={14} className="text-slate-400" /> Default Text</button>
                  
                  <div className="relative group/sub">
                    <button 
                      onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showFormats: true, showFormulaFormats: false, showNumberFormats: false } : null)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2"><Calendar size={14} className="text-blue-500" /> Format as Calendar</span>
                      <ChevronRightIcon size={12} className="text-slate-300" />
                    </button>
                    
                    {contextMenu.showFormats && (
                      <div className={`absolute ${contextMenu.x + 384 > window.innerWidth ? 'right-full mr-px' : 'left-full ml-px'} top-0 bg-white border border-slate-200 shadow-xl rounded-lg py-1 w-48`}>
                        {DATE_FORMATS.map(f => (
                          <button key={f.id} onClick={() => setCellType(contextMenu.row!, contextMenu.col, 'date', f.id)} className="w-full text-left px-3 py-2 text-[11px] hover:bg-blue-50 hover:text-blue-700">{f.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative group/sub">
                    <button 
                      onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showNumberFormats: true, showFormats: false, showFormulaFormats: false } : null)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2"><TableIcon size={14} className="text-green-600" /> Format as Number</span>
                      <ChevronRightIcon size={12} className="text-slate-300" />
                    </button>
                    
                    {contextMenu.showNumberFormats && (
                      <div className={`absolute ${contextMenu.x + 384 > window.innerWidth ? 'right-full mr-px' : 'left-full ml-px'} top-0 bg-white border border-slate-200 shadow-xl rounded-lg py-1 w-48`}>
                        {NUMBER_FORMATS.map(f => (
                          <button key={f.id} onClick={() => setCellType(contextMenu.row!, contextMenu.col, 'number', f.id)} className="w-full text-left px-3 py-2 text-[11px] hover:bg-green-50 hover:text-green-700">{f.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative group/sub">
                    <button 
                      onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showFormulaFormats: true, showFormats: false, showNumberFormats: false } : null)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2"><Sigma size={14} className="text-purple-500" /> Formula Support</span>
                      <ChevronRightIcon size={12} className="text-slate-300" />
                    </button>
                    
                    {contextMenu.showFormulaFormats && (
                      <div className={`absolute ${contextMenu.x + 384 > window.innerWidth ? 'right-full mr-px' : 'left-full ml-px'} top-0 bg-white border border-slate-200 shadow-xl rounded-lg py-1 w-48`}>
                        <button 
                          onClick={() => setCellType(contextMenu.row!, contextMenu.col, 'formula')} 
                          className="w-full text-left px-3 py-2 text-[11px] hover:bg-purple-50 hover:text-purple-700 font-bold"
                        >
                          Standard (Sum/Number)
                        </button>
                        <div className="h-px bg-slate-100 my-1"></div>
                        <div className="px-3 py-1 text-[9px] font-bold text-slate-400 tracking-widest">Date Result Format</div>
                        {DATE_FORMATS.map(f => (
                          <button key={f.id} onClick={() => setCellType(contextMenu.row!, contextMenu.col, 'formula', f.id)} className="w-full text-left px-3 py-2 text-[11px] hover:bg-purple-50 hover:text-purple-700">{f.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 tracking-widest">Media</div>
                  <button onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showFormats: false, showFormulaFormats: false, showNumberFormats: false } : null)} onClick={() => insertMedia(contextMenu.row!, contextMenu.col, 'image')} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"><ImageIcon size={14} className="text-green-500" /> Insert Image</button>
                  <button onMouseEnter={() => setContextMenu(prev => prev ? { ...prev, showFormats: false, showFormulaFormats: false, showNumberFormats: false } : null)} onClick={() => insertMedia(contextMenu.row!, contextMenu.col, 'file')} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"><Paperclip size={14} className="text-amber-500" /> Attach File</button>
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
          <div className="flex items-start gap-2 p-1.5 bg-white border-b border-slate-200 shadow-inner z-20">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded border border-slate-200 text-[10px] font-black text-slate-500 tracking-tighter min-w-[120px] justify-center shadow-sm mt-0.5">
              {activeCell ? `${activeCell.col} : Row ${activeCell.row + 1}` : 'Select a cell'}
            </div>
            <div className="h-4 w-px bg-slate-300 mx-1 self-center"></div>
            <div className="flex items-center gap-1.5 px-2 text-purple-500 mt-1">
              <Sigma size={14} className="shrink-0" />
              <span className="text-[10px] font-bold tracking-widest opacity-50">Formula</span>
            </div>
            <textarea
              ref={formulaBarRef}
              rows={1}
              placeholder="Enter formula (e.g., =SUM(A,B)) or value..."
              value={activeCell ? (data[activeCell.row][activeCell.col] || '') : ''}
              onChange={(e) => {
                if (activeCell) {
                  handleUpdateCell(activeCell.row, activeCell.col, e.target.value);
                }
              }}
              className="flex-1 bg-transparent border-0 outline-none text-sm font-mono text-slate-700 placeholder:text-slate-300 placeholder:italic resize-none py-1 overflow-y-auto max-h-32"
            />
          </div>

          <div
            ref={tableContainerRef}
            onScroll={(e) => setShowBackToTop(e.currentTarget.scrollTop > 300)}
            className="flex-1 overflow-auto relative"
          >
            <table className="w-full border-separate border-spacing-0 table-auto min-w-full">
              <thead className="bg-slate-100 shadow-[0_1px_0_rgba(0,0,0,0.1)]">
                <tr className="bg-slate-200/60 select-none h-5">
                  {/* The Corner Cell - Standardized border and background */}
                  <th className="w-10 min-w-[40px] h-5 border-r border-b border-slate-300 bg-slate-100 shadow-[inset_-1px_-1px_0_rgba(0,0,0,0.05)]">
                    <div className="w-full h-full flex items-center justify-center opacity-20 text-[8px] font-black text-slate-500">◢</div>
                  </th>
                  {visibleHeaders.map((header, idx) => (
                    <th 
                      key={`col-label-${idx}`} 
                      onClick={() => {
                        try {
                          const data = JSON.parse(editedContent || '[]');
                          if (data.length > 0) {
                            setSelection({
                              startRow: 0,
                              endRow: data.length - 1,
                              startCol: header,
                              endCol: header
                            });
                            setActiveCell({ row: 0, col: header });
                          }
                        } catch(e) {}
                      }}
                      style={{ 
                        width: columnWidths[header] ? `${columnWidths[header]}px` : undefined,
                        minWidth: columnWidths[header] ? `${columnWidths[header]}px` : '120px' 
                      }}
                      className="text-[9px] font-black text-slate-400 border-r border-b border-slate-300 h-5 text-center uppercase tracking-tighter cursor-pointer hover:bg-slate-300 hover:text-slate-600 transition-colors"
                    >
                      {getExcelColumnLabel(idx)}
                    </th>
                  ))}
                  <th className="border-r border-b border-slate-300"></th>
                  <th className="sticky right-0 border-l border-b border-slate-300 z-40 bg-slate-200/50"></th>
                </tr>
                <tr>
                  <th className="w-10 min-w-[40px] border-r border-b border-slate-300 bg-slate-100"></th>
                  {visibleHeaders.map((header, colIdx) => {
                    const headerMeta = cellMetadata[`header:${header}`] || {};
                    if (headerMeta.mergedIn) return null;

                    const defaultAlign = (header === "Title / Item" || header === "Amount") ? "right" : "left";
                    const align = columnAlignments[header] || defaultAlign;
                    const alignClass = align === 'center' ? 'text-center' : 
                                     align === 'right' ? 'text-right' : 'text-left';

                    const startColIdx = visibleHeaders.indexOf(selection?.startCol || "");
                    const endColIdx = visibleHeaders.indexOf(selection?.endCol || "");
                    
                    const isInHeaderSelection = selection && selection.startRow === -1 && 
                      colIdx >= Math.min(startColIdx, endColIdx) &&
                      colIdx <= Math.max(startColIdx, endColIdx);

                    return (
                      <th 
                      key={header} 
                      colSpan={headerMeta.colSpan}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const menuWidth = 192;
                      const menuHeight = 280; // Estimated height for header menu
                      const winW = window.innerWidth;
                      const winH = window.innerHeight;
                      
                      let x = e.clientX;
                      let y = e.clientY;
                      if (x + menuWidth > winW) x -= menuWidth;
                      if (y + menuHeight > winH) y -= menuHeight;
                      
                      setContextMenu({ x, y, col: header, type: 'header' });
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
                    className={`group/header px-2 py-1 text-[11px] font-bold text-slate-500 tracking-tight border-r border-b border-slate-300 relative bg-slate-100 ${isInHeaderSelection ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-200 z-10' : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        <input
                          defaultValue={header}
                          onBlur={(e) => handleRenameColumn(header, e.target.value)}
                          className={`w-full bg-transparent border-0 focus:ring-1 focus:ring-blue-400 rounded px-1 outline-none truncate hover:bg-slate-100 transition-colors ${alignClass}`}
                        />
                      </div>
                      <div 
                        onMouseDown={(e) => startResizing(header, e)}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 z-50 transition-colors group-hover/header:bg-slate-300"
                        title="Drag to resize"
                      />
                      </th>
                    );
                  })}
                  <th className="p-2 min-w-[140px] border-r border-b border-slate-200 bg-slate-50/50">
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
                        className="w-full bg-transparent border-0 focus:ring-1 focus:ring-blue-400 rounded px-1 outline-none text-sm font-bold text-blue-600 placeholder:text-blue-300"
                      />
                      <Plus size={14} className="text-blue-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3 w-12 bg-slate-100 sticky right-0 border-l border-b border-slate-200 z-40"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sections.map((sectionName: any) => {
                  const sectionRows = data.filter((r: any) => r.section === sectionName);
                  return (
                    <Fragment key={sectionName}>
                      {/* Section Header */}
                      <tr className="bg-slate-100/80 group/section">
                        <td colSpan={visibleHeaders.length + 3} className="px-3 py-1 border-b border-slate-300">
                          <div className="flex items-center justify-between">
                            <input
                              defaultValue={sectionName}
                              onBlur={(e) => handleRenameSection(sectionName, e.target.value)}
                              className="bg-transparent border-0 font-black text-slate-800 tracking-widest text-[11px] outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 flex-1"
                            />
                            <button 
                              onClick={() => handleDeleteSection(sectionName)}
                              className="opacity-0 group-hover/section:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                              title="Delete Section"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Data Rows */}
                      {sectionRows.map((row: any, localIndex: number) => {
                        const globalIndex = data.indexOf(row);
                        return (
                          <tr key={globalIndex} className="hover:bg-slate-50 transition-colors group relative">
                            <td
                              className="w-10 min-w-[40px] text-[10px] font-bold text-slate-400 text-center border-r border-b border-slate-300 bg-slate-50 select-none cursor-pointer hover:bg-slate-200 hover:text-slate-600 transition-colors"
                              onClick={() => {
                                setSelection({
                                  startRow: globalIndex,
                                  endRow: globalIndex,
                                  startCol: visibleHeaders[0],
                                  endCol: visibleHeaders[visibleHeaders.length - 1]
                                });
                                setActiveCell({ row: globalIndex, col: visibleHeaders[0] });
                              }}
                            >
                              {globalIndex + 1}
                            </td>
                    {visibleHeaders.map((header, colIndex) => {
                      const cellKey = `${globalIndex}:${header}`;
                      const defaultAlign = (header === "Title / Item" || header === "Amount") ? "right" : "left";
                      const cellAlign = cellAlignments[cellKey] || columnAlignments[header] || defaultAlign;
                      const alignClass = cellAlign === 'center' ? 'text-center' : 
                                       cellAlign === 'right' ? 'text-right' : 'text-left';
                      
                      const meta = cellMetadata[cellKey] || {};
                      const isFormula = meta.type === 'formula';
                      const isDate = meta.type === 'date';
                      const isMedia = meta.type === 'media';

                      if (meta.mergedIn) return null;

                      const isInSelection = selection && 
                        selection.startRow !== -1 &&
                        globalIndex >= Math.min(selection.startRow, selection.endRow) &&
                        globalIndex <= Math.max(selection.startRow, selection.endRow) &&
                        visibleHeaders.indexOf(header) >= Math.min(visibleHeaders.indexOf(selection.startCol), visibleHeaders.indexOf(selection.endCol)) &&
                        visibleHeaders.indexOf(header) <= Math.max(visibleHeaders.indexOf(selection.startCol), visibleHeaders.indexOf(selection.endCol));

                      return (
                        <td 
                          key={header} 
                          rowSpan={meta.rowSpan}
                          colSpan={meta.colSpan}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            const menuWidth = 192;
                            const menuHeight = 420; // Estimated height for cell menu
                            const winW = window.innerWidth;
                            const winH = window.innerHeight;

                            let x = e.clientX;
                            let y = e.clientY;
                            if (x + menuWidth > winW) x -= menuWidth;
                            if (y + menuHeight > winH) y -= menuHeight;

                            setContextMenu({ x, y, row: globalIndex, col: header, type: 'cell' });
                          }}
                          onMouseDown={(e) => {
                            if (e.button === 0) { // Left click only for selecting
                              setSelection({ startRow: globalIndex, endRow: globalIndex, startCol: header, endCol: header });
                              setIsSelecting(true);
                            } else if (e.button === 2) { // Right click
                              // Only reset selection if right-clicking outside current selection
                              const startColIdx = visibleHeaders.indexOf(selection?.startCol || "");
                              const endColIdx = visibleHeaders.indexOf(selection?.endCol || "");
                              const currentColIdx = visibleHeaders.indexOf(header);
                              
                              const isInsideSelection = selection && 
                                globalIndex >= Math.min(selection.startRow, selection.endRow) &&
                                globalIndex <= Math.max(selection.startRow, selection.endRow) &&
                                currentColIdx >= Math.min(startColIdx, endColIdx) &&
                                currentColIdx <= Math.max(startColIdx, endColIdx);

                              if (!isInsideSelection) {
                                setSelection({ startRow: globalIndex, endRow: globalIndex, startCol: header, endCol: header });
                              }
                            }
                          }}
                          onMouseEnter={() => {
                            if (dragFillRange && dragFillRange.col === header) {
                              setDragFillRange(prev => prev ? { ...prev, endRow: globalIndex } : null);
                            }
                            if (isSelecting) {
                              setSelection(prev => prev ? { ...prev, endRow: globalIndex, endCol: header } : null);
                            }
                          }}
                          onClick={() => { 
                            setActiveCell({ row: globalIndex, col: header }); 
                            // Only clear selection if it's a single cell click (no drag range)
                            if (selection && selection.startRow === selection.endRow && selection.startCol === selection.endCol) {
                              setSelection(null); 
                            }
                          }}
                          className={`p-0 border-r border-slate-200 bg-white group/cell relative align-top ${
                            activeCell?.row === globalIndex && activeCell?.col === header ? 'ring-2 ring-inset ring-blue-500 z-20' : ''
                          } ${
                            isInSelection ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-200 z-10' : ''
                          }`}
                        >
                          {/* Fill Handle */}
                          {activeCell?.row === globalIndex && activeCell?.col === header && (
                            <div 
                              onMouseDown={(e) => handleDragFillStart(e, globalIndex, header)}
                              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-600 border border-white cursor-crosshair z-30 -mb-1 -mr-1 shadow-sm rounded-sm hover:scale-125 transition-transform" 
                              title="Drag to fill"
                            />
                          )}

                          {/* Drag Selection Overlay */}
                          {dragFillRange && dragFillRange.col === header && (
                            globalIndex >= Math.min(dragFillRange.startRow, dragFillRange.endRow) &&
                            globalIndex <= Math.max(dragFillRange.startRow, dragFillRange.endRow)
                          ) && (
                            <div className="absolute inset-0 pointer-events-none bg-blue-500/10 border-x-2 border-blue-500/30 z-10" />
                          )}

                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCellAlignment(globalIndex, header); }}
                            className="absolute right-1 top-1 opacity-0 group-hover/cell:opacity-100 p-1 text-slate-300 hover:text-blue-500 bg-white/90 rounded shadow-sm z-30 transition-all"
                            title="Cell Alignment"
                          >
                            {cellAlign === 'center' ? <AlignCenter size={10} /> :
                             cellAlign === 'right' ? <AlignRight size={10} /> : <AlignLeft size={10} />}
                          </button>

                          {header === 'Location' || header === 'Allocation' ? (
                            <select
                              value={row[header] ?? ''}
                              data-row={globalIndex}
                              data-col={header}
                              onKeyDown={(e) => handleKeyDown(e, globalIndex, colIndex, visibleHeaders)}
                              onChange={(e) => handleUpdateCell(globalIndex, header, e.target.value)}
                              className={`grid-input w-full px-2 py-1 text-sm text-slate-800 bg-transparent border-0 focus:ring-2 focus:ring-inset focus:ring-blue-400 outline-none cursor-pointer relative z-0 font-sans ${alignClass}`}
                            >
                              <option value="">Select...</option>
                              {(header === 'Location' ? LOCATIONS : ALLOCATIONS).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : isDate ? (
                        <div className="relative w-full h-full flex items-center group/date min-h-[28px]">
                              <input
                                type="date"
                                data-row={globalIndex}
                                data-col={header}
                                onKeyDown={(e) => handleKeyDown(e, globalIndex, colIndex, visibleHeaders)}
                                value={row[header] || ''}
                                onChange={(e) => handleUpdateCell(globalIndex, header, e.target.value)}
                                onClick={(e) => {
                                  try {
                                    e.currentTarget.showPicker();
                                  } catch (err) {
                                    // Fallback for older browsers
                                  }
                                }}
                            className="absolute inset-0 opacity-0 z-20 cursor-pointer w-full h-full"
                              />
                          <div className={`w-full px-2 py-1 text-sm text-slate-800 !normal-case font-sans ${alignClass} group-hover/date:bg-blue-50/30 transition-colors flex items-center ${
                            cellAlign === 'center' ? 'justify-center' : cellAlign === 'right' ? 'justify-end' : 'justify-start'
                          }`}>
                            {row[header] 
                              ? formatDateDisplay(row[header], meta.format) 
                              : <span className="text-slate-400 font-normal italic flex items-center gap-1.5"><Calendar size={14} className="shrink-0" /> Set Date...</span>}
                              </div>
                            </div>
                          ) : isMedia ? (
                            <div className="flex items-center group/media relative min-h-[28px] w-full">
                              <div className="flex-1 min-w-0 px-2 py-1">
                                {meta.attachments && meta.attachments.length > 0 && (() => {
                                  const atts = meta.attachments;
                                  const hasImages = atts.some((a: any) => a.type === 'image');
                                  const hasFiles = atts.some((a: any) => a.type === 'file');
                                  let label = 'Attachment';
                                  if (hasImages && !hasFiles) label = 'Image';
                                  else if (hasFiles && !hasImages) label = 'File';
                                  const plural = atts.length > 1 ? 's' : '';
                                  
                                  return (
                                    <button 
                                      onClick={() => setViewingMedia({ attachments: atts, row: globalIndex, col: header })}
                                      className={`text-xs text-blue-600 hover:underline font-medium block leading-tight w-full ${alignClass}`}
                                    >
                                      [View {label}{plural}]
                                      {atts.length > 1 && <span className="ml-1 opacity-60">({atts.length})</span>}
                                    </button>
                                  );
                                })()}
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCellMetadata(globalIndex, header);
                                }}
                                className="opacity-0 group-hover/media:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all absolute right-1 top-1 bg-white/80 rounded shadow-sm"
                                title="Remove Attachment"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : isFormula ? (
                            <div 
                              onClick={() => setActiveCell({ row: globalIndex, col: header })}
                              className={`w-full px-2 py-1 text-sm text-slate-800 cursor-text transition-all !normal-case font-sans min-h-[28px] flex items-center ${
                                activeCell?.row === globalIndex && activeCell?.col === header 
                                  ? 'bg-purple-50/80' 
                                  : 'hover:bg-purple-50/50'
                              } ${cellAlign === 'center' ? 'justify-center' : cellAlign === 'right' ? 'justify-end' : 'justify-start'}`}
                            >
                              {(() => {
                                const result = evaluateFormula(row[header], row, meta.format);
                                return typeof result === 'number' 
                                  ? formatNumberDisplay(result, meta.format || 'decimal')
                                  : result;
                              })()}
                            </div>
                          ) : (meta.type === 'number' || header === 'Amount') ? (
                            activeCell?.row === globalIndex && activeCell?.col === header ? (
                              <input
                                type="number"
                                step="0.01"
                                data-row={globalIndex}
                                data-col={header}
                                autoFocus
                                value={row[header] ?? ''}
                                onChange={(e) => handleUpdateCell(globalIndex, header, e.target.value === '' ? '' : parseFloat(e.target.value))}
                                onKeyDown={(e) => handleKeyDown(e, globalIndex, colIndex, visibleHeaders)}
                                className={`grid-input w-full px-2 py-1 text-sm text-slate-800 bg-transparent border-0 focus:ring-2 focus:ring-inset focus:ring-blue-400 outline-none font-sans ${alignClass}`}
                              />
                            ) : (
                              <div 
                                onClick={() => setActiveCell({ row: globalIndex, col: header })}
                                className={`w-full px-2 py-1 text-sm text-slate-800 cursor-text min-h-[28px] flex items-center font-sans ${
                                  cellAlign === 'center' ? 'justify-center' : cellAlign === 'right' ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                {row[header] !== undefined && row[header] !== "" 
                                  ? formatNumberDisplay(row[header], meta.format || 'decimal') 
                                  : <span className="text-slate-300">0.00</span>}
                              </div>
                            )
                          ) : (
                            <input
                              type="text"
                              data-row={globalIndex}
                              data-col={header}
                              value={row[header] ?? ''}
                              onFocus={() => setActiveCell({ row: globalIndex, col: header })}
                              onChange={(e) => handleUpdateCell(globalIndex, header, header === 'Amount' ? parseFloat(e.target.value) : e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, globalIndex, colIndex, visibleHeaders)}
                              className={`grid-input w-full px-2 py-1 text-sm text-slate-800 bg-transparent border-0 focus:ring-2 focus:ring-inset focus:ring-blue-400 outline-none font-sans ${alignClass}`}
                            />
                          )}
                        </td>
                      );
                    })}
                    {/* Spacer cell to align with 'Add Column' header */}
                    <td className="border-r border-b border-slate-200 bg-transparent"></td>
                    <td className="px-2 py-2 text-center sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-200 z-20 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">
                      <button onClick={() => removeTableRow(globalIndex)} className="text-slate-300 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                        );
                      })}
                      {/* Section Summary Row */}
                      <tr className="bg-slate-50/50 border-t border-slate-200 font-semibold">
                        <td className="w-10 min-w-[40px] border-r border-b border-slate-300 bg-slate-50/50"></td>
                        {visibleHeaders.map((header) => {
                          const alignClass = columnAlignments[header] === 'center' ? 'text-center' : 
                                           columnAlignments[header] === 'right' ? 'text-right' : 'text-left';

                          if (header === "Title / Item") {
                            return (
                              <td key="total-label" className={`px-2 py-1.5 text-xs font-bold text-slate-500 text-right border-r border-slate-300 bg-slate-50`}>
                                Subtotal:
                              </td>
                            );
                          }
                          if (header === "Amount") {
                            const total = sectionRows.reduce((sum: number, r: any) => sum + (Number(r.Amount) || 0), 0);
                            return (
                              <td key="total-amount" className={`px-3 py-1.5 text-sm font-bold text-blue-700 border-r border-slate-200 ${alignClass}`}>
                                {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            );
                          }
                          return <td key={`total-empty-${header}`} className="border-r border-slate-200"></td>;
                        })}
                        <td className="border-r border-slate-200"></td>
                        <td className="sticky right-0 bg-slate-50/50 border-l border-slate-200 z-20"></td>
                      </tr>
                      {/* Option (Insert) Row */}
                      <tr>
                        <td colSpan={visibleHeaders.length + 3} className="p-0 border-b border-slate-200">
                          <button 
                            onClick={() => addRowToSection(sectionName)}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-blue-500 hover:bg-blue-50 transition-colors flex items-center gap-1.5"
                          >
                            <Plus size={12} /> Option (Insert)
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {showBackToTop && (
              <button 
                onClick={scrollToTop}
                className="fixed bottom-10 right-10 p-3 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-all z-50 animate-in fade-in zoom-in duration-300 group"
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
        <div className="p-12 border-2 border-dashed border-red-200 rounded-xl bg-red-50 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-red-100 rounded-full text-red-600 mb-4">
            <Code size={24} />
          </div>
          <h3 className="text-red-800 font-bold mb-2">JSON Syntax Error</h3>
          <p className="text-sm text-red-600 mb-6 max-w-sm">
            {e instanceof Error ? e.message : "We encountered an error while parsing your data."}
            <br />
            <span className="opacity-70 mt-2 block">Check for missing commas, brackets, or quotes in the code view.</span>
          </p>
          <button 
            onClick={() => setViewMode('code')}
            className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm"
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
    <main className="flex h-screen bg-slate-50 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
      <aside 
        className={`bg-white flex flex-col shadow-sm transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
          isExplorerVisible && !isFullScreen ? 'w-72 border-r p-4' : 'w-0 border-none p-0'
        }`}
      >
        <div className="flex justify-between items-center mb-4 px-1 min-w-[260px]">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsExplorerVisible(false)} 
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors" 
              title="Hide Explorer"
            >
              <PanelLeftClose size={18} />
            </button>
            <h1 className="font-bold text-slate-800 text-sm tracking-tight opacity-70 line-clamp-1">Explorer</h1>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => addItem('folder')} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors" title="New Folder">
              <FolderPlus size={16} />
            </button>
            <button onClick={() => addItem('file')} className="p-1.5 hover:bg-slate-100 rounded-md text-blue-600 transition-colors" title="New File">
              <FilePlus size={16} />
            </button>
          </div>
        </div>
        <div className="mb-4 relative group min-w-[260px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search files..." 
            value={explorerSearch}
            onChange={(e) => setExplorerSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {explorerSearch && (
            <button onClick={() => setExplorerSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar min-w-[260px]">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            filteredTree.map(node => (
              <FileNodeItem 
                key={node.id} 
                node={node} 
                onDelete={handleDelete} 
                onRename={handleRename}
                onAdd={addItem}
                onSelect={(node) => setSelectedId(node.id)}
                selectedId={selectedId ?? undefined}
                searchTerm={explorerSearch}
                comparisonIds={comparisonIds}
                onToggleCompare={toggleComparisonId}
              />
            ))
          )}
        </div>
      </aside>

      <div className={`flex-1 flex flex-col overflow-hidden ${isFullScreen ? 'p-0' : 'p-3'}`}>
        {!isExplorerVisible && !isFullScreen && (
          <div className="mb-4 flex items-center">
            <button 
              onClick={() => setIsExplorerVisible(true)} 
              className="p-2 bg-white border border-slate-200 rounded-md shadow-sm text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all group" 
              title="Show Explorer"
            >
              <PanelLeftOpen size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}

        {activeNode ? (
          <div className={`flex flex-col flex-1 min-h-0 ${viewMode === 'table' || viewMode === 'compare' ? 'w-full' : 'max-w-2xl'}`}>
            {!isFullScreen && (
              <>
                <h2 className="text-lg font-bold mb-3 text-slate-800">{activeNode.name}</h2>
                
                <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                  <button 
                    onClick={() => setIsMetadataVisible(!isMetadataVisible)}
                    className="w-full flex items-center justify-between p-2 hover:bg-slate-50 transition-colors"
                  >
                    <h3 className="text-sm font-semibold text-slate-500 tracking-wider">Metadata</h3>
                    {isMetadataVisible ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </button>

                  {isMetadataVisible && (
                    <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-50 pt-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                          <Clock size={16} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Created At</p>
                          <p className="text-xs font-medium">{new Date(activeNode.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-green-50 rounded-lg text-green-600">
                          <User size={16} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Owner</p>
                          <p className="text-xs font-medium">LGU Labason User</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                          <HardDrive size={16} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">File Size</p>
                          <p className="text-xs font-medium">{formatSize(activeNode.size_bytes)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            
            {activeNode.type === 'file' && (
              <div className={`flex flex-col flex-1 min-h-0 ${isFullScreen ? 'mt-0' : 'mt-4 gap-3'}`}>
                <div className={`flex items-center justify-between ${isFullScreen ? 'bg-white p-2 border-b border-slate-200' : ''}`}>
                  <div className="flex items-center gap-3">
                    {isFullScreen ? (
                      <div className="flex items-center gap-3">
                        <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md"><TableIcon size={16} /></span>
                        <h2 className="text-sm font-bold text-slate-700 line-clamp-1 max-w-[300px]">{activeNode.name}</h2>
                      </div>
                    ) : (
                      <h3 className="text-sm font-semibold text-slate-500 tracking-wider">Data Editor</h3>
                    )}
                    <div className="flex bg-slate-200 p-1 rounded-lg">
                      <button 
                        onClick={() => setViewMode('table')}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <TableIcon size={14} />
                        Excel View
                      </button>
                      <button 
                        onClick={handleShare}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all text-slate-600 hover:text-slate-900"
                      >
                        <Share2 size={14} />
                        Copy Link
                      </button>
                      <button 
                        onClick={() => window.open(`/print?id=${selectedId}`, '_blank')}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileText size={14} />
                        Printable Report
                      </button>
                      <button 
                        onClick={() => setViewMode('code')}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          viewMode === 'code' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Code size={14} />
                        JSON Code
                      </button>
                      <button 
                        onClick={() => setViewMode('compare')}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          viewMode === 'compare' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <RefreshCcw size={14} />
                        Compare Mode {comparisonIds.length > 0 && `(${comparisonIds.length})`}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center print:hidden">
                    <button 
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                    >
                      {isFullScreen ? (
                        <><Minimize2 size={14} /> Exit Mode</>
                      ) : (
                        <><Maximize2 size={14} /> Full Screen</>
                      )}
                    </button>
                    <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>

                {viewMode === 'code' ? (
                  <textarea
                    value={codeViewContent}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    className="w-full h-[500px] p-4 font-mono text-sm bg-slate-900 text-slate-100 rounded-lg border border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none shadow-inner"
                    placeholder='{ "content": [...], "display_settings": {...} }'
                  />
                ) : viewMode === 'table' ? (
                  renderTableEditor()
                ) : viewMode === 'compare' ? (
                  renderComparisonTable()
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Folder size={48} className="mb-4 opacity-20" />
            <p>Select a file to start data entry.</p>
          </div>
        )}

        {/* Media Preview Modal */}
        {viewingMedia && (
          <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={() => setViewingMedia(null)}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" 
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Paperclip size={18} className="text-blue-500" />
                    Cell Attachments ({viewingMedia.attachments.length})
                  </h3>
                  <div className="h-4 w-px bg-slate-200" />
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => insertMedia(viewingMedia.row, viewingMedia.col, 'image')}
                      className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-green-100 transition-colors border border-green-200 shadow-sm"
                    >
                      <ImageIcon size={12} /> Add Image
                    </button>
                    <button 
                      onClick={() => insertMedia(viewingMedia.row, viewingMedia.col, 'file')}
                      className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-amber-100 transition-colors border border-amber-200 shadow-sm"
                    >
                      <Paperclip size={12} /> Add File
                    </button>
                  </div>
                </div>
                <button onClick={() => setViewingMedia(null)} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1">
                {/* Images Section */}
                {viewingMedia.attachments.some((m: any) => m.type === 'image') && (
                  <div className="mb-8">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ImageIcon size={14} className="text-green-500" /> Images
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {viewingMedia.attachments.map((img: any, idx: number) => {
                        if (img.type !== 'image') return null;
                        return (
                          <div key={idx} className="group relative bg-white p-2 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <div className="relative aspect-video rounded-lg bg-slate-50 overflow-hidden">
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
                              <p className="text-[10px] font-bold text-slate-700 truncate">{img.name}</p>
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
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <FileIcon size={14} className="text-amber-500" /> Documents & Files
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {viewingMedia.attachments.map((file: any, idx: number) => {
                        if (file.type !== 'file') return null;
                        return (
                          <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-100 transition-colors group">
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-500">
                              <FileIcon size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-slate-800 truncate leading-tight">{file.name}</p>
                              <p className="text-[9px] text-slate-400 uppercase tracking-tighter">{formatSize(file.size || 0)}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <a href={file.url} download={file.name} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all" title="Download">
                                <Save size={14} />
                              </a>
                              <button 
                                onClick={() => deleteAttachment(viewingMedia.row, viewingMedia.col, idx)}
                                className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"
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
      </div>
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-slate-400 font-sans">Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
