import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useProfile(user: any) {
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
