import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useSystemConnectivity() {
  const [isSystemOnline, setIsSystemOnline] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkDbConnection = async () => {
      if (!navigator.onLine) {
        setIsSystemOnline(false);
        return;
      }
      try {
        const { error } = await supabase.from('nodes').select('id').limit(1);
        setIsSystemOnline(!error);
      } catch (e) {
        setIsSystemOnline(false);
      }
    };

    checkDbConnection();

    const handleOnline = () => {
      setIsSystemOnline(true);
      checkDbConnection();
      setIsSyncModalOpen(true);
    };
    const handleOffline = () => setIsSystemOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Open sync modal on mount if there are pending items
  useEffect(() => {
    if (isSystemOnline) {
      import('@/lib/local-db').then(({ LocalDB }) => {
        LocalDB.getSyncQueue().then(queue => {
          if (queue.length > 0) setIsSyncModalOpen(true);
        });
      });
    }
  }, [isSystemOnline]);

  return {
    isSystemOnline,
    setIsSystemOnline,
    isSyncModalOpen,
    setIsSyncModalOpen
  };
}
