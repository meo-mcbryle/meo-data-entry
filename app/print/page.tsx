'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FileNode } from '@/lib/tree-utils';
import { FileText } from 'lucide-react';

function PrintContent() {
  const searchParams = useSearchParams();
  const [node, setNode] = useState<FileNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;

    const fetchNode = async () => {
      const { data, error } = await supabase.from('nodes').select('*').eq('id', id).single();
      if (!error && data) {
        setNode(data as FileNode);
        // Allow extra time for complex table calculation before freezing the frame
        if (Array.isArray(data.content) && data.content.length > 0) {
          setTimeout(() => window.print(), 1000);
        }
      }
      setIsLoading(false);
    };

    fetchNode();
  }, [searchParams]);

  if (isLoading) return <div className="p-10 text-center font-sans text-slate-400">Preparing document...</div>;
  if (!node) return <div className="p-10 text-center font-sans text-red-500">File not found.</div>;

  // Handle cases where content might be an object (uninitialized) or null
  const rawContent = node.content;
  const data = Array.isArray(rawContent) ? rawContent : [];

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

  const sections = Array.from(new Set(data.map((r: any) => r.section || "Uncategorized")));
  const grandTotal = data.reduce((sum: number, r: any) => sum + (Number(r.Amount) || 0), 0);
  const cellMetadata = node.display_settings?.cellMetadata || {};

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
      const getColumnValue = (colName: string) => {
        const actualKey = Object.keys(rowData).find(
          key => key.toLowerCase() === colName.toLowerCase()
        );
        return actualKey ? rowData[actualKey] : null;
      };

      if (value.toUpperCase().startsWith('=SUM(')) {
        const match = value.match(/\=SUM\((.*)\)/i);
        if (!match) return '#ERROR!';
        const args = match[1].split(',').map(s => s.trim());
        return args.reduce((acc, colName) => acc + (Number(getColumnValue(colName)) || 0), 0);
      }

      if (value.toUpperCase().startsWith('=ADD_DAYS(')) {
        const match = value.match(/\=ADD_DAYS\((.*)\)/i);
        if (!match) return '#ERROR!';
        const args = match[1].split(',').map(s => s.trim());
        if (args.length !== 2) return '#ARGS!';

        const startDateRaw = getColumnValue(args[0]);
        const daysToAdd = Number(getColumnValue(args[1]) ?? args[1]) || 0;

        if (!startDateRaw) return '';

        let date: Date;
        if (typeof startDateRaw === 'string' && startDateRaw.includes('-')) {
          const [y, m, d] = startDateRaw.split('-').map(Number);
          date = new Date(y, m - 1, d);
        } else {
          date = new Date(startDateRaw);
        }

        if (isNaN(date.getTime())) return '#DATE!';

        date.setDate(date.getDate() + daysToAdd);
        return formatDateDisplay(date.toISOString().split('T')[0], formatId);
      }
    } catch (e) {
      return '#ERR!';
    }
    return value;
  };

  const year = node.display_settings?.selectedYear || '2020';
  
  // Logic to handle dynamic headers just like the Excel view
  const hiddenColumns = node.display_settings?.hiddenColumns || [];
  const columnOrder = node.display_settings?.columnOrder || [];
  const allHeaders = Object.keys(data[0]);
  const baseOrder = columnOrder.length > 0 ? columnOrder : allHeaders;
  const uniqueObjectKeys = allHeaders.filter(k => !baseOrder.includes(k));
  const finalOrder = [...baseOrder, ...uniqueObjectKeys];
  const visibleHeaders = finalOrder.filter(header => 
    !hiddenColumns.includes(header) && 
    header !== 'section' && 
    allHeaders.includes(header)
  );

  return (
    <div className="p-10 min-h-screen bg-white font-serif text-slate-900">
      {/* Landscape Print Styling */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: landscape; margin: 0.4in; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; }
          .no-print { display: none; }
        }
      `}} />

      {/* Professional Header */}
      <div className="border-b-4 border-double border-slate-900 pb-3 mb-6 flex justify-between items-end">
        <div>
          <p className="text-[10px] font-sans font-bold text-blue-700 mb-0.5 tracking-[0.25em]">REPUBLIC OF THE PHILIPPINES</p>
          <h1 className="text-3xl font-black tracking-tight">{node.name}</h1>
          <p className="text-xs font-sans text-slate-500 mt-0.5 italic">Consolidated Summary • Fiscal Year {year}</p>
        </div>
        <div className="text-right font-sans space-y-0.5">
          <p className="text-sm font-black text-slate-900 leading-tight tracking-tighter">LGU LABASON</p>
          <p className="text-[9px] font-bold text-slate-700">Zamboanga del Norte</p>
          <p className="text-[9px] text-slate-400 tracking-widest pt-1">Printed: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Sectioned Table */}
      <table className="w-full border-collapse mb-8 border-2 border-slate-400">
        <thead>
          <tr className="bg-slate-100 text-[9px] tracking-widest text-slate-900 font-black border-b-2 border-slate-400">
            {visibleHeaders.map(header => {
              const headerMeta = cellMetadata[`header:${header}`] || {};
              if (headerMeta.mergedIn) return null;

              const columnAlignments = node.display_settings?.columnAlignments || {};
              const defaultAlign = (header === "Title / Item" || header === "Amount") ? "right" : "left";
              const align = columnAlignments[header] || defaultAlign;
              const alignClass = align === 'center' ? 'text-center' : 
                               align === 'right' ? 'text-right' : 'text-left';
              
              return (
                <th key={header} colSpan={headerMeta.colSpan} className={`py-2 px-3 border-r border-slate-400 last:border-0 whitespace-nowrap ${alignClass}`}>
                  {header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sections.map((sectionName: any) => {
            const sectionRows = data.filter((r: any) => r.section === sectionName);
            const sectionTotal = sectionRows.reduce((sum: number, r: any) => sum + (Number(r.Amount) || 0), 0);

            return (
              <React.Fragment key={sectionName}>
                <tr className="bg-slate-50">
                  <td colSpan={visibleHeaders.length} className="py-2 px-3 font-black text-[10px] tracking-widest border-y border-slate-300 text-slate-800">
                    Section: {sectionName}
                  </td>
                </tr>
                {sectionRows.map((row: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-200 text-[10px] leading-normal">
                    {visibleHeaders.map(header => {
                      const cellKey = `${data.indexOf(row)}:${header}`;
                      const meta = cellMetadata[cellKey] || {};

                      if (meta.mergedIn) return null;

                      const columnAlignments = node.display_settings?.columnAlignments || {};
                      const cellAlignments = node.display_settings?.cellAlignments || {};
                      const defaultAlign = (header === "Title / Item" || header === "Amount") ? "right" : "left";
                      const cellAlign = cellAlignments[cellKey] || columnAlignments[header] || defaultAlign;
                      const alignClass = cellAlign === 'center' ? 'text-center' : 
                                       cellAlign === 'right' ? 'text-right' : 'text-left';

                      const isAmount = header === "Amount";
                      const isTitle = header === "Title / Item";
                      let content = row[header];
                      
                      if (isAmount) content = Number(content).toLocaleString(undefined, { minimumFractionDigits: 2 });
                      if (meta.type === 'date') content = formatDateDisplay(content, meta.format);
                      if (meta.type === 'media') {
                        const atts = meta.attachments || [];
                        content = atts.length === 0 ? '' : `[Attachment${atts.length > 1 ? 's' : ''}${atts.length > 1 ? ` (${atts.length})` : ''}]`;
                      }
                      if (meta.type === 'formula') content = evaluateFormula(content, row, meta.format);

                      return (
                        <td key={header} rowSpan={meta.rowSpan} colSpan={meta.colSpan} className={`py-1.5 px-3 border-r border-slate-200 last:border-0 ${alignClass} ${
                          isAmount || isTitle ? "font-mono bg-slate-50/20" : "text-slate-700 normal-case font-sans"
                        }`}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="font-bold text-sm">
                  {visibleHeaders.map(header => {
                    if (header === "Amount") {
                      return <td key="subtotal-val" className="py-2 px-3 text-right border-t-2 border-slate-400 text-blue-700 font-mono text-[10px]">{sectionTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>;
                    }
                    if (header === "Title / Item") {
                      return <td key="subtotal-label" className="py-2 px-3 text-right text-[9px] text-slate-400 tracking-tighter font-black">SubTotal</td>;
                    }
                    return <td key={`subtotal-empty-${header}`} className="py-2 px-3 border-t-2 border-slate-400 opacity-0"></td>;
                  })}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Summary and Signatures */}
      <div className="flex flex-col items-end pt-6 border-t-4 border-double border-slate-900 mt-12">
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 tracking-[0.3em] mb-1">Combined Project Valuation</p>
          <p className="text-4xl font-black italic tracking-tighter text-slate-900">
            <span className="text-xl font-normal not-italic mr-2">PHP</span>
            {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="mt-24 grid grid-cols-2 gap-20 text-center px-12">
        <div className="border-t border-slate-900 pt-4">
          <p className="text-[10px] font-bold text-slate-800">Verified & Validated By</p>
        </div>
        <div className="border-t border-slate-900 pt-4">
          <p className="text-[10px] font-bold text-slate-800">Approved for Transmittal</p>
        </div>
      </div>
    </div>
  );
}

export default function PrintPage() {
  return <Suspense><PrintContent /></Suspense>;
}