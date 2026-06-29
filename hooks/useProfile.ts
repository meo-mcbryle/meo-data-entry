import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useProfile(user: User | null) {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState(user?.user_metadata?.avatar_url || '');

  useEffect(() => {
    if (user?.user_metadata?.avatar_url) {
      setProfileAvatar(user.user_metadata.avatar_url);
    }
  }, [user]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    showProfileModal,
    setShowProfileModal,
    profileAvatar,
    setProfileAvatar,
    handleLogout
  };
}
