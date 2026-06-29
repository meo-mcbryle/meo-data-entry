import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const LOGS_PAGE_SIZE = 50;

export function useAuditLogs(user: any) {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);

  const fetchAuditLogs = useCallback(async (offset = 0) => {
    if (!user) return;
    setIsLoadingLogs(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, nodes(name)')
      .order('created_at', { ascending: false })
      .range(offset, offset + LOGS_PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching logs:', error.message);
    } else {
      setAuditLogs(prev => (offset === 0 ? (data || []) : [...prev, ...(data || [])]));
      setHasMoreLogs((data || []).length === LOGS_PAGE_SIZE);
    }
    setIsLoadingLogs(false);
  }, [user]);

  const logAction = useCallback(async (action: string, nodeId: string | null, details: any = {}) => {
    if (!user) return;
    const { error } = await supabase.from('audit_logs').insert([{
      action,
      node_id: nodeId,
      user_id: user.id,
      details: {
        ...details,
        user_email: user.email // Capture current email for display
      }
    }]);
    if (error) {
      console.error(`Audit Log Failed [${action}]:`, error.message);
    }
  }, [user]);

  return {
    auditLogs,
    isLoadingLogs,
    hasMoreLogs,
    fetchAuditLogs,
    logAction
  };
}
