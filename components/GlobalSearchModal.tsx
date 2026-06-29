import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, FileText, Sigma } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface GlobalSearchModalProps {
  showGlobalSearch: boolean;
  setShowGlobalSearch: (show: boolean) => void;
  setSelectedId: (id: string | null) => void;
  setViewMode: (mode: 'code' | 'table' | 'compare' | 'logs' | 'trash') => void;
  setActiveCell: (cell: { row: number, col: string } | null) => void;
}

export const GlobalSearchModal = ({
  showGlobalSearch,
  setShowGlobalSearch,
  setSelectedId,
  setViewMode,
  setActiveCell
}: GlobalSearchModalProps) => {
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestQueryRef = useRef('');

  const [globalSearchHighlightIndex, setGlobalSearchHighlightIndex] = useState(-1);
  const highlightedResultRef = useRef<HTMLButtonElement>(null);

  // Reset highlight when results change
  useEffect(() => {
    setGlobalSearchHighlightIndex(globalSearchResults.length > 0 ? 0 : -1);
  }, [globalSearchResults]);

  // Handle selected results to focus grid rows
  const handleSelectResult = useCallback((result: any) => {
    setSelectedId(result.nodeId);

    const matchingKey = Object.entries(result.row).find(([key, val]) => {
      if (key === '_index' || key === 'section' || !val) return false;
      return String(val).toLowerCase().includes(globalSearchQuery.toLowerCase());
    })?.[0] || 'Title / Item';

    setActiveCell({ row: result.rowIndex, col: matchingKey });
    setViewMode('table');
    setShowGlobalSearch(false);
  }, [setSelectedId, setViewMode, setShowGlobalSearch, setActiveCell, globalSearchQuery]);

  // Keyboard navigation for global search
  useEffect(() => {
    if (!showGlobalSearch) return;

    const handleGlobalSearchKeys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowGlobalSearch(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setGlobalSearchHighlightIndex(prev => Math.min(prev + 1, globalSearchResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setGlobalSearchHighlightIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && globalSearchHighlightIndex >= 0) {
        const result = globalSearchResults[globalSearchHighlightIndex];
        if (result) {
          handleSelectResult(result);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalSearchKeys);
    return () => window.removeEventListener('keydown', handleGlobalSearchKeys);
  }, [showGlobalSearch, globalSearchResults, globalSearchHighlightIndex, handleSelectResult, setShowGlobalSearch]);

  const performGlobalSearch = useCallback((query: string) => {
    setGlobalSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query.trim() || query.length < 2) {
      setGlobalSearchResults([]);
      setIsSearchingGlobal(false);
      return;
    }

    setIsSearchingGlobal(true);
    const currentQuery = query;
    latestQueryRef.current = currentQuery;

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('nodes')
          .select('id, name, content')
          .eq('type', 'file')
          .eq('is_deleted', false)
          .limit(200); // Safety limit for global scan

        if (error) throw error;

        if (latestQueryRef.current !== currentQuery) return; // Stale query check

        const term = currentQuery.toLowerCase();
        const matches: any[] = [];

        data?.forEach(node => {
          if (Array.isArray(node.content)) {
            node.content.forEach((row: any, idx: number) => {
              const hasMatch = Object.entries(row).some(([key, val]) => {
                if (key === '_index' || key === 'section' || !val) return false;
                return String(val || '').toLowerCase().includes(term);
              });

              if (hasMatch) {
                matches.push({ nodeId: node.id, nodeName: node.name, rowIndex: idx, row: row });
              }
            });
          }
        });
        setGlobalSearchResults(matches);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        if (latestQueryRef.current === currentQuery) {
          setIsSearchingGlobal(false);
        }
      }
    }, 400);
  }, []);

  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} className="bg-accent/30 text-accent font-bold rounded-sm px-0.5 no-underline">{part}</mark>
            : part
        )}
      </>
    );
  }, []);

  useEffect(() => {
    if (showGlobalSearch && globalSearchHighlightIndex !== -1 && highlightedResultRef.current) {
      highlightedResultRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [globalSearchHighlightIndex, showGlobalSearch]);

  if (!showGlobalSearch) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl h-[80vh] rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-border bg-muted/5 flex items-center gap-4">
          <Search className="text-accent" size={20} />
          <input
            autoFocus
            type="text"
            placeholder="Search for any entry across all projects..."
            value={globalSearchQuery}
            onChange={(e) => performGlobalSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-lg font-medium text-foreground placeholder:text-muted/30"
          />
          {globalSearchQuery && (
            <button
              onClick={() => performGlobalSearch('')}
              className="p-1.5 text-muted hover:text-foreground hover:bg-muted/20 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
          <button onClick={() => setShowGlobalSearch(false)} className="p-1 text-muted hover:text-foreground transition-colors">
            <span className="text-[10px] font-black uppercase tracking-widest mr-2 opacity-50 hidden sm:inline">Esc</span>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isSearchingGlobal ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="animate-spin text-accent" size={32} />
              <p className="text-xs font-black uppercase tracking-widest text-muted animate-pulse">Scanning records...</p>
            </div>
          ) : globalSearchResults.length > 0 ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Found {globalSearchResults.length} matches</p>
                <p className="text-[10px] font-bold text-muted/40 uppercase tracking-widest hidden sm:block">Use arrows <span className="px-1 py-0.5 bg-muted/20 rounded">↑</span> <span className="px-1 py-0.5 bg-muted/20 rounded">↓</span> to navigate</p>
              </div>
              {globalSearchResults.map((result, idx) => {
                const isHighlighted = globalSearchHighlightIndex === idx;
                return (
                  <button
                    key={`${result.nodeId}-${idx}`}
                    ref={isHighlighted ? highlightedResultRef : null}
                    onClick={() => handleSelectResult(result)}
                    className={`w-full text-left p-4 rounded-xl border transition-all group ${isHighlighted
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/20 translate-x-1'
                        : 'border-border hover:border-accent/50 hover:bg-accent/5'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className={isHighlighted ? "text-accent" : "text-blue-500"} />
                        <span className={`text-xs font-bold transition-colors ${isHighlighted ? "text-accent" : "text-foreground group-hover:text-accent"}`}>{result.nodeName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted bg-muted/10 px-1.5 py-0.5 rounded">Row {result.rowIndex + 1}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(result.row).map(([key, val]) => {
                        if (key === '_index' || key === 'section' || !val) return null;
                        const valStr = String(val);
                        const isMatch = valStr.toLowerCase().includes(globalSearchQuery.toLowerCase());
                        return (
                          <div key={key} className={`flex flex-col p-2 rounded-lg border border-transparent transition-colors ${isMatch ? 'bg-accent/5 border-accent/10' : 'bg-muted/5'}`}>
                            <span className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">{key}</span>
                            <span className="text-[11px] text-foreground font-semibold truncate leading-tight">
                              {isMatch ? highlightText(valStr, globalSearchQuery) : valStr}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : globalSearchQuery.length >= 2 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted py-12">
              <Search size={48} className="mb-4 opacity-10" />
              <p className="font-bold">No matches found for "{globalSearchQuery}"</p>
              <p className="text-xs">Try a different search term or check for typos.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted py-12">
              <div className="p-4 bg-muted/10 rounded-2xl mb-4">
                <Sigma size={32} className="opacity-20" />
              </div>
              <p className="text-sm font-medium">Global Entry Search</p>
              <p className="text-xs max-w-xs text-center mt-1">Type at least 2 characters to search for amounts, locations, project titles, and notes across your entire system.</p>

              <div className="mt-8 grid grid-cols-2 gap-2 w-full max-w-sm">
                <div className="p-2 rounded-lg bg-muted/5 border border-border text-[10px] font-bold text-center">Search Amounts</div>
                <div className="p-2 rounded-lg bg-muted/5 border border-border text-[10px] font-bold text-center">Search Locations</div>
                <div className="p-2 rounded-lg bg-muted/5 border border-border text-[10px] font-bold text-center">Search Projects</div>
                <div className="p-2 rounded-lg bg-muted/5 border border-border text-[10px] font-bold text-center">Search Contractors</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
