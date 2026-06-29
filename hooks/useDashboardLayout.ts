import { useState, useEffect, useRef, useCallback } from 'react';

export function useDashboardLayout(
  setRowHeights: React.Dispatch<React.SetStateAction<Record<string, number>>>
) {
  const [isExplorerVisible, setIsExplorerVisible] = useState(false);
  const [isSidebarMoving, setIsSidebarMoving] = useState(false);
  const [containerHeight, setContainerHeight] = useState(800);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFreezeHeaders, setIsFreezeHeaders] = useState(true);
  const [isFreezePanes, setIsFreezePanes] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Throttled Height Updates: Prevents layout thrashing during sidebar resize
  const heightUpdateQueue = useRef<Record<string, number>>({});
  const heightRafId = useRef<number | null>(null);

  const toggleSidebar = useCallback((forceState?: boolean) => {
    const nextState = forceState !== undefined ? forceState : !isExplorerVisible;
    setIsSidebarMoving(true);
    setIsExplorerVisible(nextState);
    setTimeout(() => setIsSidebarMoving(false), 350); // Matches 300ms duration + buffer
  }, [isExplorerVisible]);

  const onMeasuredHeight = useCallback((index: number, height: number) => {
    // Silently ignore measurements while sidebar is animating to keep FPS high
    if (isSidebarMoving) return;
    heightUpdateQueue.current[String(index)] = height;
    
    if (heightRafId.current !== null) return;
    
    heightRafId.current = requestAnimationFrame(() => {
      setRowHeights(prev => {
        const next = { ...prev };
        let changed = false;
        for (const [idx, h] of Object.entries(heightUpdateQueue.current)) {
          if (prev[idx] === undefined || Math.abs(prev[idx] - h) > 0.5) {
            next[idx] = h;
            changed = true;
          }
        }
        heightUpdateQueue.current = {};
        heightRafId.current = null;
        return changed ? next : prev;
      });
    });
  }, [isSidebarMoving, setRowHeights]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => { 
      if (heightRafId.current !== null) cancelAnimationFrame(heightRafId.current);
    };
  }, []);

  // Responsive Sidebar: Desktop: Open by default, Mobile: Hidden by default
  useEffect(() => {
    let prevIsDesktop = window.innerWidth >= 768;
    setIsExplorerVisible(prevIsDesktop);

    const handleResponsiveSidebar = () => {
      const isDesktop = window.innerWidth >= 768;
      if (isDesktop !== prevIsDesktop) {
        setIsExplorerVisible(isDesktop);
        prevIsDesktop = isDesktop;
      }
    };
    window.addEventListener('resize', handleResponsiveSidebar);
    return () => window.removeEventListener('resize', handleResponsiveSidebar);
  }, []);

  return {
    isExplorerVisible,
    setIsExplorerVisible,
    isSidebarMoving,
    setIsSidebarMoving,
    containerHeight,
    setContainerHeight,
    isFullScreen,
    setIsFullScreen,
    isFreezeHeaders,
    setIsFreezeHeaders,
    isFreezePanes,
    setIsFreezePanes,
    zoom,
    setZoom,
    toggleSidebar,
    onMeasuredHeight
  };
}
