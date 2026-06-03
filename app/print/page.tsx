'use client';
import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FileNode } from '@/lib/tree-utils';
import { FileText, Printer, Check, Table, Settings2, Columns, LayoutList, ChevronDown, ChevronUp } from 'lucide-react';
import { toA1Key } from '@/lib/excel-utils';

function PrintContent() {
  const searchParams = useSearchParams();
  const [node, setNode] = useState<FileNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [visibleSections, setVisibleSections] = useState<string[]>([]);
  const [printHiddenColumns, setPrintHiddenColumns] = useState<string[]>([]);

  // Handle cases where content might be an object (uninitialized) or null
  const rawContent = node?.content;
  const data = Array.isArray(rawContent) ? (rawContent as any[]) : [];

  const allAvailableSections = useMemo(() => {
    return Array.from(new Set(data.map((r: any) => r.section || "Uncategorized"))) as string[];
  }, [data]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;

    const fetchNode = async () => {
      const { data, error } = await supabase.from('nodes').select('*').eq('id', id).single();
      if (!error && data) {
        setNode(data as FileNode);
      }
      setIsLoading(false);
    };

    fetchNode();
  }, [searchParams]);

  useEffect(() => {
    if (node?.content && Array.isArray(node.content)) {
      const all = Array.from(new Set(node.content.map((r: any) => r.section || "Uncategorized"))) as string[];
      setVisibleSections(all);
    }
    if (node?.display_settings?.hiddenColumns) {
      setPrintHiddenColumns(node.display_settings.hiddenColumns);
    }
  }, [node]);

  if (isLoading) return <div className="p-10 text-center font-sans text-slate-400">Preparing document...</div>;
  if (!node) return <div className="p-10 text-center font-sans text-red-500">File not found.</div>;

  if (data.length === 0) {
    return (
      <div className="p-20 text-center font-sans flex flex-col items-center gap-4">
        <FileText size={48} className="text-slate-200" />
        <h2 className="text-xl font-bold text-slate-800">No Printable Data Found</h2>
        <p className="text-slate-500 max-w-sm text-sm">
          This file does not have a structured table yet, or the changes haven't been saved to the server.
          <br /><br />
          Please go back to the dashboard, initialize the <strong>Excel Template</strong>, and click <strong>"Save Changes"</strong> before printing.
        </p>
        <button onClick={() => window.close()} className="mt-4 text-blue-600 font-bold text-sm hover:underline no-print">Close This Tab</button>
      </div>
    );
  }

  // Group rows into contiguous blocks by section name to maintain the exact sequential order 
  // of rows as they appear in the spreadsheet, allowing for split sections.
  const sectionBlocks: { name: string, rows: any[] }[] = [];
  data.forEach(row => {
    const sectionName = row.section || "Uncategorized";
    const lastBlock = sectionBlocks[sectionBlocks.length - 1];
    if (lastBlock && lastBlock.name === sectionName) {
      lastBlock.rows.push(row);
    } else {
      sectionBlocks.push({ name: sectionName, rows: [row] });
    }
  });

  const grandTotal = data
    .filter((r: any) => visibleSections.includes(r.section || "Uncategorized"))
    .reduce((sum: number, r: any) => sum + (Number(r.Amount) || 0), 0);

  const cellMetadata = node.display_settings?.cellMetadata || {};

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

  const evaluateFormula = (value: any, rowData: any, formatId?: string) => {
    if (typeof value !== 'string' || !value.startsWith('=')) return value;
    
    try {
      const getArgValue = (arg: string) => {
        const a1Match = arg.match(/^([A-Z]+)(\d+)$/i);
        if (a1Match) {
          const colLetters = a1Match[1].toUpperCase();
          const targetRowIdx = parseInt(a1Match[2], 10) - 1;
          let vIdx = 0;
          for (let i = 0; i < colLetters.length; i++) {
            vIdx = vIdx * 26 + (colLetters.charCodeAt(i) - 64);
          }
          vIdx--;
          
          const targetRow = data[targetRowIdx];
          if (!targetRow) return null;
          
          const headers = node.display_settings?.columnOrder || Object.keys(data[0]);
          const colName = headers.filter(h => h !== 'section')[vIdx];
          return targetRow[colName];
        }

        const actualKey = Object.keys(rowData).find(
          key => key.toLowerCase() === arg.toLowerCase()
        );
        return actualKey ? rowData[actualKey] : (isNaN(Number(arg)) ? arg : Number(arg));
      };

      if (value.toUpperCase().startsWith('=SUM(')) {
        const match = value.match(/\=SUM\((.*)\)/i);
        if (!match) return '#ERROR!';
        const args = match[1].split(',').map(s => s.trim());
        return args.reduce((acc, arg) => acc + (Number(getArgValue(arg)) || 0), 0);
      }

      if (value.toUpperCase().startsWith('=ADD_DAYS(')) {
        const match = value.match(/=ADD_DAYS\s*\((.*)\)/i);
        if (!match) return '#ERROR!';
        // Split and strip quotes from literals
        const args = match[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
        if (args.length !== 2) return '#ARGS!';

        let dateVal = getArgValue(args[0]);
        let daysVal = getArgValue(args[1]);

        // Smart swap: if first arg is a number and second is not, swap them
        if (!isNaN(Number(dateVal)) && isNaN(Number(daysVal))) {
          [dateVal, daysVal] = [daysVal, dateVal];
        }

        if (dateVal === null || dateVal === undefined || dateVal === '') return '';

        let date = new Date(dateVal);
        if (isNaN(date.getTime()) && typeof dateVal === 'string' && dateVal.includes('-')) {
          const parts = dateVal.split('-');
          if (parts.length === 3) {
            if (parts[0].length === 4) date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            else if (parts[2].length === 4) date = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
          }
        }

        const days = Number(daysVal);
        if (isNaN(date.getTime())) return '#DATE!';
        if (isNaN(days)) return '#NUM!';

        date.setDate(date.getDate() + days);
        return formatDateDisplay(date.toISOString().split('T')[0], formatId);
      }
    } catch (e) {
      return '#ERR!';
    }
    return value;
  };

  const formatCurrency = (val: any) => {
    const num = Number(val);
    return isNaN(num) ? "0.00" : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const year = node.display_settings?.selectedYear || '2020';
  
  // Logic to handle dynamic headers just like the Excel view
  const columnOrder = node.display_settings?.columnOrder || [];
  const allHeaders = Object.keys(data[0]);
  const baseOrder = columnOrder.length > 0 ? columnOrder : allHeaders;
  const uniqueObjectKeys = allHeaders.filter(k => !baseOrder.includes(k));
  const finalOrder = [...baseOrder, ...uniqueObjectKeys];
  const visibleHeaders = finalOrder.filter(header => 
    !printHiddenColumns.includes(header) && 
    header !== 'section' && 
    allHeaders.includes(header)
  );

  return (
    <div className="p-8 md:p-12 min-h-screen bg-white font-serif text-slate-900 leading-tight">
      {/* Landscape Print Styling */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: landscape; margin: 0.4in; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; background-color: white !important; }
          .no-print { display: none; }
          .print-compact { font-size: 8pt !important; }
        }
      `}} />

      {/* Print Configuration Panel (Visible only on screen) */}
      <div className="no-print mb-10 font-sans sticky top-4 z-50">
        <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300">
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-900 text-white rounded-lg">
                  <FileText size={14} />
                </div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-widest">Document Preview</h3>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 rounded-lg text-slate-500 text-[10px] font-bold uppercase transition-colors"
              >
                <Settings2 size={14} />
                {isSettingsOpen ? 'Hide Controls' : 'Customize Report'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => window.close()} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase">Cancel</button>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-[10px] hover:bg-slate-800 transition-all shadow-lg active:scale-95 uppercase tracking-wider"
              >
                <Printer size={14} /> Print Report
              </button>
            </div>
          </div>
          
          <div className={`px-6 py-6 bg-slate-50/50 grid grid-cols-1 md:grid-cols-2 gap-8 transition-all ${isSettingsOpen ? 'block animate-in slide-in-from-top-2' : 'hidden'}`}>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <LayoutList size={12} /> Included Sections
              </div>
              <div className="flex flex-wrap gap-2">
                {allAvailableSections.map(section => (
                  <button
                    key={section}
                    onClick={() => setVisibleSections(prev => prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section])}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                      visibleSections.includes(section) ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    {section}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <Columns size={12} /> Column Visibility
              </div>
              <div className="flex flex-wrap gap-2">
                {allHeaders.filter(h => h !== 'section').map(header => (
                  <button
                    key={header}
                    onClick={() => setPrintHiddenColumns(prev => prev.includes(header) ? prev.filter(h => h !== header) : [...prev, header])}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                      !printHiddenColumns.includes(header) ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    {header}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Header */}
      <div className="flex justify-between items-start mb-10 border-b-2 border-slate-900 pb-6">
        <div className="flex items-center gap-6">
          {/* Placeholder for LGU Seal */}
          <div className="w-20 h-20 rounded-full border-2 border-slate-200 flex items-center justify-center bg-slate-50 relative">
            <span className="text-[8px] font-black text-slate-300 absolute uppercase">LGU SEAL</span>
            <Table className="text-slate-100" size={32} />
          </div>
          <div>
            <p className="text-[10px] font-sans font-black text-blue-800 mb-0.5 tracking-[0.4em] uppercase">Republic of the Philippines</p>
            <p className="text-xs font-sans font-bold text-slate-700 tracking-tight">Province of Zamboanga del Norte</p>
            <h1 className="text-lg font-black tracking-tighter uppercase text-slate-900 leading-none mt-1">Municipality of Labason</h1>
            <p className="text-[10px] font-sans text-slate-500 mt-2 font-bold tracking-widest uppercase">Office of the Municipal Engineer</p>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black text-right tracking-tighter text-slate-900">{node.name}</h2>
          <p className="text-[10px] font-sans font-black text-right text-slate-400 uppercase tracking-widest mt-1">
            Report for Fiscal Year {year} • <span className="text-slate-900">{new Date().toLocaleDateString()}</span>
          </p>
        </div>
      </div>

      {/* Sectioned Table */}
      <table className="w-full border-collapse mb-8">
        <thead>
          <tr className="bg-slate-900 text-white text-[8px] tracking-[0.2em] font-black uppercase">
            <th className="py-2 px-2 border border-slate-900 text-center w-8">#</th>
            {visibleHeaders.map(header => {
              const master = (node.display_settings as any)?.masterColumnOrder || node.display_settings?.columnOrder || allHeaders;
              const headerMeta = cellMetadata[`header:${header}`] || cellMetadata[`${master.indexOf(header)}:${header}`] || {};
              if (headerMeta.mergedIn) return null;

              return (
                <th key={header} colSpan={headerMeta.colSpan} className="py-2 px-3 border border-slate-900 text-left" style={{ fontFamily: headerMeta.fontFamily || 'inherit' }}>
                  {header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sectionBlocks.map((block, blockIdx) => {
            if (!visibleSections.includes(block.name)) return null;
            const { name: sectionName, rows: sectionRows } = block;
            const sectionTotal = sectionRows.reduce((sum: number, r: any) => sum + (Number(r.Amount) || 0), 0);

            return (
              <React.Fragment key={`${sectionName}-${blockIdx}`}> 
                <tr className="bg-slate-100">
                  <td colSpan={visibleHeaders.length + 1} className="py-2 px-3 font-black text-[9px] tracking-[0.15em] border border-slate-300 text-blue-900 uppercase">
                    <span className="opacity-40 mr-2">Category:</span> {sectionName}
                  </td>
                </tr>
                {sectionRows.map((row: any, idx: number) => (
                  <tr key={idx} className="text-[9px] leading-tight hover:bg-slate-50/50">
                    <td className="py-1 px-2 border border-slate-200 text-center text-slate-300 font-mono font-bold">
                      {idx + 1}
                    </td>
                    {visibleHeaders.map(header => {
                      const rowIndex = data.indexOf(row);
                      const master = (node.display_settings as any)?.masterColumnOrder || node.display_settings?.columnOrder || allHeaders;
                      const cellKey = toA1Key(rowIndex, master.indexOf(header));
                      const legacyKey = `${rowIndex}:${header}`;
                      const meta = cellMetadata[cellKey] || cellMetadata[legacyKey] || {};
                      const alignments = node.display_settings?.cellAlignments || {};

                      if (meta.mergedIn) return null;

                      const columnAlignments = node.display_settings?.columnAlignments || {};
                      const defaultAlign = (header === "Title / Item" || header === "Amount") ? "right" : "left";
                      const cellAlign = alignments[cellKey] || alignments[legacyKey] || columnAlignments[header] || defaultAlign;
                      const alignClass = cellAlign === 'center' ? 'text-center' : 
                                       cellAlign === 'right' ? 'text-right' : 'text-left';

                      const isAmount = header === "Amount";
                      const isTitle = header === "Title / Item";
                      let content = row[header];
                      
                      if (isAmount) content = Number(content).toLocaleString(undefined, { minimumFractionDigits: 2 });
                      if (isAmount || meta.type === 'number') content = formatNumberDisplay(content, meta.format);
                      if (meta.type === 'date') content = formatDateDisplay(content, meta.format);
                      
                      if (meta.type === 'formula') {
                        const result = evaluateFormula(content, row, meta.format);
                        content = typeof result === 'number' 
                          ? formatNumberDisplay(result, meta.format)
                          : result;
                      }

                      return (
                        <td key={header} rowSpan={meta.rowSpan} colSpan={meta.colSpan} className={`py-1.5 px-3 border border-slate-200 ${alignClass} ${
                          isAmount || isTitle ? "font-mono bg-slate-50/20" : "text-slate-700 normal-case font-sans"
                        }`}>
                          {(meta.attachments?.length ?? 0) > 0 ? (
                            <span className="text-[10px] font-bold text-blue-800 underline italic" style={{ fontFamily: meta.fontFamily || 'inherit' }}>[View Attachment]</span>
                          ) : (
                            content
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="font-bold text-sm">
                  <td className="border border-slate-300 bg-slate-50/30"></td>
                  {visibleHeaders.map(header => {
                    if (header === "Amount") {
                      return <td key="subtotal-val" className="py-2 px-3 text-right border border-slate-300 text-blue-700 font-mono text-[9px] bg-blue-50/20">{formatCurrency(sectionTotal)}</td>;
                    }
                    if (header === "Title / Item") {
                      return <td key="subtotal-label" className="py-2 px-3 text-right text-[8px] text-slate-400 tracking-widest font-black uppercase bg-slate-50/30">SubTotal ({sectionName})</td>;
                    }
                    return <td key={`subtotal-empty-${header}`} className="py-2 px-3 border border-slate-300 bg-slate-50/30"></td>;
                  })}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Summary and Signatures */}
      <div className="flex flex-col items-end pt-6 border-t-2 border-slate-900 mt-12">
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 tracking-[0.4em] mb-1 uppercase">Grand Total Valuation</p>
          <p className="text-4xl font-black tracking-tighter text-slate-900">
            <span className="text-sm font-normal mr-2">PHP</span>
            {formatCurrency(grandTotal)}
          </p>
        </div>
      </div>

      <div className="mt-24 grid grid-cols-2 gap-20 text-center px-12">
        <section>
          <div className="h-px bg-slate-900 w-full mb-1" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-0.5">Municipal Engineer</p>
          <p className="text-[8px] font-bold text-slate-400 uppercase italic">Head of Office</p>
        </section>
        <section>
          <div className="h-px bg-slate-900 w-full mb-1" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-0.5">Municipal Mayor</p>
          <p className="text-[8px] font-bold text-slate-400 uppercase italic">Approving Authority</p>
        </section>
      </div>
    </div>
  );
}

export default function PrintPage() {
  return <Suspense><PrintContent /></Suspense>;
}