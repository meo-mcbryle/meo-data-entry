import { useState, useEffect, useCallback } from 'react';

export function useDashboardState() {
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'explorer' | 'settings' | 'code' | 'table' | 'compare' | 'logs' | 'trash'>('table');
  const [bgStyle, setBgStyle] = useState<'blueprint' | 'particles'>('particles');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    handleResize();

    // Set initial viewMode based on screen size on mount
    if (window.innerWidth < 768) {
      setViewMode('explorer');
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleComparisonId = useCallback((id: string) => {
    setComparisonIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  return {
    isMobile,
    setIsMobile,
    viewMode,
    setViewMode,
    bgStyle,
    setBgStyle,
    showGlobalSearch,
    setShowGlobalSearch,
    pendingSelectId,
    setPendingSelectId,
    comparisonIds,
    setComparisonIds,
    toggleComparisonId
  };
}
