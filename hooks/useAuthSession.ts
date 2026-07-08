import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

const decodeJwt = (token: string) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

let authInitPromise: Promise<{ data: { session: Session | null }; error: any }> | null = null;

const getInitialSession = () => {
  if (!authInitPromise) {
    authInitPromise = supabase.auth.getSession();
  }
  return authInitPromise;
};

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'unauthorized' | 'ready'>('loading');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('meo-theme') as 'light' | 'dark';
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    }
    return 'dark';
  });
  const isTransitioning = useRef(false);

  // Theme Management
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('meo-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    if (isTransitioning.current) return;
    const next = theme === 'light' ? 'dark' : 'light';
    // @ts-ignore
    if (!document.startViewTransition) {
      setTheme(next);
      return;
    }
    isTransitioning.current = true;
    // @ts-ignore
    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });
    transition.finished.finally(() => { isTransitioning.current = false; });
  }, [theme]);

  // Auth Management
  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const checkAuth = async (currentSession: Session | null, event?: string) => {
      if (event === 'SIGNED_OUT') {
        authInitPromise = null;
        localStorage.removeItem('meo-offline-session');
        if (isMounted) { setSession(null); setStatus('unauthorized'); }
        return;
      }

      if (!currentSession) {
        const cachedSessionStr = localStorage.getItem('meo-offline-session');
        if (cachedSessionStr) {
          try {
            const cachedSession = JSON.parse(cachedSessionStr);
            const isExpired = cachedSession?.expires_at
              ? (Date.now() / 1000) > cachedSession.expires_at
              : true;
            if (!isExpired && cachedSession?.access_token) {
              const payload = decodeJwt(cachedSession.access_token);
              if (payload && payload.app_metadata?.role === 'admin') {
                const reconstructedSession: Session = {
                  access_token: cachedSession.access_token,
                  token_type: 'bearer',
                  expires_in: cachedSession.expires_at - Math.floor(Date.now() / 1000),
                  expires_at: cachedSession.expires_at,
                  refresh_token: '',
                  user: {
                    id: payload.sub || '',
                    email: payload.email || '',
                    app_metadata: payload.app_metadata || {},
                    user_metadata: payload.user_metadata || {},
                    aud: payload.aud || 'authenticated',
                    created_at: payload.created_at || ''
                  }
                };
                if (isMounted) { setSession(reconstructedSession); setStatus('ready'); }
                return;
              }
            }
          } catch (e) {
            console.error('Failed to parse cached offline session:', e);
          }
        }
        if (isMounted) { setSession(null); setStatus('unauthorized'); }
        return;
      }

      const isAuthorized = currentSession.user?.app_metadata?.role === 'admin';
      if (!isAuthorized) {
        try {
          await supabase.auth.signOut();
          alert('Access Denied: This account does not have administrator privileges for the MEO Data Entry system.');
        } catch (e) {
          console.error('Sign out during unauthorized access check failed', e);
        } finally {
          authInitPromise = null;
          localStorage.removeItem('meo-offline-session');
          if (isMounted) { setSession(null); setStatus('unauthorized'); }
        }
      } else {
        localStorage.setItem('meo-offline-session', JSON.stringify({
          access_token: currentSession.access_token,
          expires_at: currentSession.expires_at
        }));
        if (isMounted) { setSession(currentSession); setStatus('ready'); }
      }
    };

    const init = async () => {
      let initSession: Session | null = null;
      try {
        const { data } = await getInitialSession();
        initSession = data.session;
      } catch (err) {
        console.warn('Failed to get initial session from Supabase (offline?):', err);
      }
      if (!isMounted) return;
      await checkAuth(initSession);
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!isMounted) return;
        await checkAuth(newSession, event);
      });
      subscription = sub;
    };

    init();
    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    status,
    theme,
    toggleTheme
  };
}
