'use client';
import React, { useEffect, useState, useMemo, useCallback, Fragment, Suspense, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import { buildTree, FileNode, findNodeById } from '@/lib/tree-utils';
import FileNodeItem from '@/components/FileNodeItem';
import { Clock, User, HardDrive, Folder, Save, Code, Table as TableIcon, Plus, Trash2, X, AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Search, Printer, FileText, Share2, FolderPlus, FilePlus, PanelLeftClose, PanelLeftOpen, ChevronUp, ChevronDown, ArrowUp } from 'lucide-react';

function DashboardContent() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'table'>('table');
  const [columnAlignments, setColumnAlignments] = useState<Record<string, 'left' | 'center' | 'right'>>({});
  const [cellAlignments, setCellAlignments] = useState<Record<string, 'left' | 'center' | 'right'>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [rowFilter, setRowFilter] = useState<string>('');
  const [newColName, setNewColName] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('2020');
  const searchParams = useSearchParams();
  const [isExplorerVisible, setIsExplorerVisible] = useState(true);
  const [explorerSearch, setExplorerSearch] = useState('');
  const [isMetadataVisible, setIsMetadataVisible] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Recursive filter logic for the explorer tree
  const filteredTree = useMemo(() => {
    if (!explorerSearch.trim()) return tree;

    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes
        .map((node) => {
          const matchesSelf = node.name.toLowerCase().includes(explorerSearch.toLowerCase());
          const filteredChildren = node.children ? filterNodes(node.children) : [];

          if (matchesSelf || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
          }
          return null;
        })
        .filter((node): node is FileNode => node !== null);
    };

    return filterNodes(tree);
  }, [tree, explorerSearch]);

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

  const activeNode = useMemo(() => 
    selectedId ? findNodeById(tree, selectedId) : null
  , [tree, selectedId]);

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
    const inputs = document.querySelectorAll('.grid-input') as NodeListOf<HTMLInputElement | HTMLSelectElement>;
    const currentIndex = rowIndex * headers.length + colIndex;

    if (e.key === 'Enter') {
      e.preventDefault();
      const next = inputs[currentIndex + headers.length];
      if (next) next.focus();
    }
  };

  const toggleCellAlignment = (rowIndex: number, header: string) => {
    const cellKey = `${rowIndex}:${header}`;
    const current = cellAlignments[cellKey] || columnAlignments[header] || 'left';
    const nextMap: Record<string, 'left' | 'center' | 'right'> = {
      left: 'center',
      center: 'right',
      right: 'left'
    };
    setCellAlignments(prev => ({ ...prev, [cellKey]: nextMap[current] }));
  };

  const toggleColumnVisibility = (key: string) => {
    setHiddenColumns(prev => 
      prev.includes(key) ? prev.filter(col => col !== key) : [...prev, key]
    );
  };

  const handleRenameColumn = (oldKey: string, newKey: string) => {
    if (!newKey || oldKey === newKey) return;
    try {
      const data = JSON.parse(editedContent || '[]');
      const newData = data.map((row: any) => {
        const { [oldKey]: value, ...rest } = row;
        return { ...rest, [newKey]: value };
      });
      setColumnOrder(prev => prev.map(col => col === oldKey ? newKey : col));
      setEditedContent(JSON.stringify(newData, null, 2));
    } catch (e) {
      console.error("Failed to rename column");
    }
  };

  const handleAddColumn = (name?: string) => {
    const colName = typeof name === 'string' ? name : window.prompt("Enter new column name:");
    if (!colName) return;
    try {
      const data = JSON.parse(editedContent || '[]');
      const newData = data.map((row: any) => ({ ...row, [colName]: "" }));
      if (newData.length === 0) newData.push({ [colName]: "" });
      setColumnOrder(prev => [...prev, colName]);
      setEditedContent(JSON.stringify(newData, null, 2));
    } catch (e) {
      setEditedContent(JSON.stringify([{ [colName]: "" }], null, 2));
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
      setColumnOrder(prev => prev.filter(col => col !== keyToDelete));
      setEditedContent(JSON.stringify(newData, null, 2));
    } catch (e) {
      console.error("Failed to delete column");
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

  const removeTableRow = (index: number) => {
    try {
      const data = JSON.parse(editedContent || '[]');
      if (!Array.isArray(data)) return;
      const newData = data.filter((_, i) => i !== index);
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
      setSelectedYear(activeNode.display_settings?.selectedYear || '2020');
      setRowFilter('');
      setShowBackToTop(false);
      tableContainerRef.current?.scrollTo({ top: 0 });
    } else {
      setEditedContent('');
      setColumnAlignments({});
      setCellAlignments({});
      setColumnOrder([]);
      setHiddenColumns([]);
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
      const display_settings = { columnAlignments, cellAlignments, hiddenColumns, selectedYear, columnOrder };
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

      const toggleAlignment = (header: string) => {
        const current = columnAlignments[header] || 'left';
        const nextMap: Record<string, 'left' | 'center' | 'right'> = {
          left: 'center',
          center: 'right',
          right: 'left'
        };
        setColumnAlignments({ ...columnAlignments, [header]: nextMap[current] });
      };

      const allHeaders = data.length > 0 ? Object.keys(data[0]) : [];
      
      // Determine header order: Preferred order first, then any new keys found in the object
      const baseOrder = columnOrder.length > 0 ? columnOrder : allHeaders;
      const uniqueObjectKeys = allHeaders.filter(k => !baseOrder.includes(k));
      const finalOrder = [...baseOrder, ...uniqueObjectKeys];

      // Filter and finalize visible headers (excluding 'section')
      const visibleHeaders = finalOrder.filter(header => !hiddenColumns.includes(header) && header !== 'section' && allHeaders.includes(header));

      const sections = Array.from(new Set(data.map((r: any) => r.section || "Uncategorized")));

      return (
        <div className="flex flex-col h-full overflow-hidden border border-slate-200 rounded-lg bg-white shadow-sm">
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
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportToCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm text-slate-700">
                <HardDrive size={14} /> Export CSV
              </button>
            </div>
          </div>
          
          <div 
            ref={tableContainerRef}
            onScroll={(e) => setShowBackToTop(e.currentTarget.scrollTop > 300)}
            className="flex-1 overflow-auto relative"
          >
            <table className="w-full border-separate border-spacing-0 table-fixed min-w-full">
              <thead className="sticky top-0 z-30 bg-slate-100 shadow-[0_1px_0_rgba(0,0,0,0.1)]">
                <tr>
                  {visibleHeaders.map(header => (
                    <th key={header} className={`group/header px-2 py-2 text-xs font-bold text-slate-600 uppercase tracking-tight border-r border-b border-slate-200 relative bg-slate-100 ${
                      header === "Title / Item" ? "sticky left-0 z-40 shadow-[1px_0_0_0_#e2e8f0]" : ""
                    }`}>
                      <div className="flex items-center gap-1">
                        <input
                          defaultValue={header}
                          onBlur={(e) => handleRenameColumn(header, e.target.value)}
                          className="w-full bg-transparent border-0 focus:ring-1 focus:ring-blue-400 rounded px-1 outline-none truncate hover:bg-slate-100 transition-colors"
                        />
                        <button 
                          onClick={() => toggleAlignment(header)}
                          className="opacity-0 group-hover/header:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-all"
                          title="Toggle Alignment"
                        >
                          {columnAlignments[header] === 'center' ? (
                            <AlignCenter size={12} />
                          ) : columnAlignments[header] === 'right' ? (
                            <AlignRight size={12} />
                          ) : (
                            <AlignLeft size={12} />
                          )}
                        </button>
                        <button 
                          onClick={() => toggleColumnVisibility(header)}
                          className="opacity-0 group-hover/header:opacity-100 p-1 text-slate-400 hover:text-slate-600 transition-all"
                          title="Hide Column"
                        >
                          <Eye size={12} />
                        </button>
                        <button 
                          onClick={() => handleDeleteColumn(header)}
                          className="opacity-0 group-hover/header:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="p-2 min-w-[140px] border-r border-b border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-1">
                      <input
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newColName.trim()) {
                            handleAddColumn(newColName);
                            setNewColName('');
                          }
                        }}
                        placeholder="Add Column..."
                        className="w-full bg-transparent border-0 focus:ring-1 focus:ring-blue-400 rounded px-1 outline-none text-sm font-bold text-blue-600 uppercase placeholder:text-blue-300"
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
                        <td colSpan={visibleHeaders.length + 2} className="px-3 py-1 border-b border-slate-200">
                          <div className="flex items-center justify-between">
                            <input
                              defaultValue={sectionName}
                              onBlur={(e) => handleRenameSection(sectionName, e.target.value)}
                              className="bg-transparent border-0 font-black text-slate-800 uppercase tracking-widest text-xs outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 flex-1"
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
                    {visibleHeaders.map((header, colIndex) => {
                      const cellKey = `${globalIndex}:${header}`;
                      const defaultAlign = header === "Title / Item" ? "right" : "left";
                      const cellAlign = cellAlignments[cellKey] || columnAlignments[header] || defaultAlign;
                      const alignClass = cellAlign === 'center' ? 'text-center' : 
                                       cellAlign === 'right' ? 'text-right' : 'text-left';

                      return (
                        <td 
                          key={header} 
                          className={`p-0 border-r border-slate-200 bg-white group/cell relative align-top ${
                            header === "Title / Item" ? "sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]" : ""
                          }`}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCellAlignment(globalIndex, header); }}
                            className="absolute right-1 top-1 opacity-0 group-hover/cell:opacity-100 p-1 text-slate-300 hover:text-blue-500 bg-white/90 rounded shadow-sm z-10 transition-all"
                            title="Cell Alignment"
                          >
                            {cellAlign === 'center' ? <AlignCenter size={10} /> :
                             cellAlign === 'right' ? <AlignRight size={10} /> : <AlignLeft size={10} />}
                          </button>

                          {header === 'Location' || header === 'Allocation' ? (
                            <select
                              value={row[header] ?? ''}
                              onChange={(e) => handleUpdateCell(globalIndex, header, e.target.value)}
                              className={`grid-input w-full px-3 py-2 text-sm text-slate-900 font-medium bg-transparent border-0 focus:ring-2 focus:ring-inset focus:ring-blue-400 outline-none cursor-pointer relative z-0 ${alignClass}`}
                            >
                              <option value="">Select...</option>
                              {(header === 'Location' ? LOCATIONS : ALLOCATIONS).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={header === 'Amount' ? 'number' : 'text'}
                              value={row[header] ?? ''}
                              onChange={(e) => handleUpdateCell(globalIndex, header, header === 'Amount' ? parseFloat(e.target.value) : e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, globalIndex, colIndex, visibleHeaders)}
                              className={`grid-input w-full px-3 py-2 text-sm text-slate-800 bg-transparent border-0 focus:ring-2 focus:ring-inset focus:ring-blue-400 outline-none ${alignClass}`}
                            />
                          )}
                        </td>
                      );
                    })}
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
                        {visibleHeaders.map((header) => {
                          const alignClass = columnAlignments[header] === 'center' ? 'text-center' : 
                                           columnAlignments[header] === 'right' ? 'text-right' : 'text-left';

                          if (header === "Title / Item") {
                            return (
                              <td key="total-label" className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase text-right border-r border-slate-200 sticky left-0 z-10 bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">
                                Subtotal:
                              </td>
                            );
                          }
                          if (header === "Amount") {
                            const total = sectionRows.reduce((sum: number, r: any) => sum + (Number(r.Amount) || 0), 0);
                            return (
                              <td key="total-amount" className={`px-3 py-1.5 text-sm font-bold text-blue-700 border-r border-slate-200 ${alignClass}`}>
                                {total.toLocaleString()}
                              </td>
                            );
                          }
                          return <td key={`total-empty-${header}`} className="border-r border-slate-200"></td>;
                        })}
                        <td className="sticky right-0 bg-slate-50/50 border-l border-slate-200 z-20"></td>
                      </tr>
                      {/* Option (Insert) Row */}
                      <tr>
                        <td colSpan={visibleHeaders.length + 2} className="p-0 border-b border-slate-200">
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
          isExplorerVisible ? 'w-72 border-r p-4' : 'w-0 border-none p-0'
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
            <h1 className="font-bold text-slate-800 text-sm tracking-tight uppercase opacity-70 line-clamp-1">Explorer</h1>
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
              />
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {!isExplorerVisible && (
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
          <div className={`flex flex-col flex-1 min-h-0 ${viewMode === 'table' ? 'w-full' : 'max-w-2xl'}`}>
            <h2 className="text-2xl font-bold mb-6 text-slate-800">{activeNode.name}</h2>
            
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <button 
                onClick={() => setIsMetadataVisible(!isMetadataVisible)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Metadata</h3>
                {isMetadataVisible ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>

              {isMetadataVisible && (
                <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-50 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Created At</p>
                      <p className="text-sm font-medium">{new Date(activeNode.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-lg text-green-600">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Owner</p>
                      <p className="text-sm font-medium">LGU Labason User</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                      <HardDrive size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">File Size</p>
                      <p className="text-sm font-medium">{formatSize(activeNode.size_bytes)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {activeNode.type === 'file' && (
              <div className="mt-8 flex flex-col gap-4 flex-1 min-h-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Data Editor</h3>
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
                    </div>
                  </div>
                  <div className="flex gap-2 print:hidden">
                    <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                    >
                      <Save size={16} />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>

                {viewMode === 'code' ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-[500px] p-4 font-mono text-sm bg-slate-900 text-slate-100 rounded-lg border border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none shadow-inner"
                    placeholder='{ "key": "value" }'
                  />
                ) : viewMode === 'table' ? (
                  renderTableEditor()
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
