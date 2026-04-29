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
          <h1 className="text-3xl font-black uppercase tracking-tight">{node.name}</h1>
          <p className="text-xs font-sans text-slate-500 mt-0.5 italic">Consolidated Summary • Fiscal Year {year}</p>
        </div>
        <div className="text-right font-sans space-y-0.5">
          <p className="text-sm font-black text-slate-900 leading-tight tracking-tighter">LGU LABASON</p>
          <p className="text-[9px] font-bold text-slate-700 uppercase">Zamboanga del Norte</p>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest pt-1">Printed: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Sectioned Table */}
      <table className="w-full border-collapse mb-8 border-2 border-slate-400">
        <thead>
          <tr className="bg-slate-100 text-left text-[9px] uppercase tracking-widest text-slate-900 font-black border-b-2 border-slate-400">
            {visibleHeaders.map(header => (
              <th key={header} className="py-2 px-3 border-r border-slate-400 last:border-0 whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((sectionName: any) => {
            const sectionRows = data.filter((r: any) => r.section === sectionName);
            const sectionTotal = sectionRows.reduce((sum: number, r: any) => sum + (Number(r.Amount) || 0), 0);

            return (
              <React.Fragment key={sectionName}>
                <tr className="bg-slate-50">
                  <td colSpan={visibleHeaders.length} className="py-2 px-3 font-black text-[10px] uppercase tracking-widest border-y border-slate-300 text-slate-800">
                    Section: {sectionName}
                  </td>
                </tr>
                {sectionRows.map((row: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-200 text-[10px] leading-normal">
                    {visibleHeaders.map(header => (
                      <td key={header} className={`py-2 px-3 border-r border-slate-200 last:border-0 ${
                        header === "Amount" || header === "Title / Item" ? "text-right font-mono bg-slate-50/20" : "text-slate-700"
                      }`}>
                        {header === "Amount" 
                          ? Number(row[header]).toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : row[header]}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="font-bold text-sm">
                  {visibleHeaders.map(header => {
                    if (header === "Amount") {
                      return <td key="subtotal-val" className="py-2 px-3 text-right border-t-2 border-slate-400 text-blue-700 font-mono text-[10px]">{sectionTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>;
                    }
                    if (header === "Title / Item") {
                      return <td key="subtotal-label" className="py-2 px-3 text-right text-[9px] text-slate-400 uppercase tracking-tighter font-black">SubTotal</td>;
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
          <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.3em] mb-1">Combined Project Valuation</p>
          <p className="text-4xl font-black italic tracking-tighter text-slate-900">
            <span className="text-xl font-normal not-italic mr-2">PHP</span>
            {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="mt-24 grid grid-cols-2 gap-20 text-center px-12">
        <div className="border-t border-slate-900 pt-4">
          <p className="text-[10px] font-bold uppercase text-slate-800">Verified & Validated By</p>
        </div>
        <div className="border-t border-slate-900 pt-4">
          <p className="text-[10px] font-bold uppercase text-slate-800">Approved for Transmittal</p>
        </div>
      </div>
    </div>
  );
}

export default function PrintPage() {
  return <Suspense><PrintContent /></Suspense>;
}