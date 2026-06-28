import React, { useState, useEffect, useRef } from 'react';
import { X, User, Image as ImageIcon, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ProfileModalProps {
  user: any;
  showProfileModal: boolean;
  setShowProfileModal: (show: boolean) => void;
  profileAvatar: string;
  setProfileAvatar: (url: string) => void;
}

export const ProfileModal = ({
  user,
  showProfileModal,
  setShowProfileModal,
  profileAvatar,
  setProfileAvatar
}: ProfileModalProps) => {
  const [profileName, setProfileName] = useState(user?.user_metadata?.full_name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Sync profile state when opening modal
  useEffect(() => {
    if (showProfileModal) {
      setProfileName(user?.user_metadata?.full_name || '');
      setProfileEmail(user?.email || '');
      setProfilePassword('');
    }
  }, [showProfileModal, user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUpdatingProfile(true);
    try {
      const oldAvatarUrl = profileAvatar;
      const isSupabaseUrl = oldAvatarUrl?.includes('/storage/v1/object/public/attachments/avatars/');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      setProfileAvatar(publicUrl);

      if (isSupabaseUrl) {
        const oldPath = oldAvatarUrl.split('/attachments/')[1];
        if (oldPath) await supabase.storage.from('attachments').remove([oldPath]);
      }
    } catch (err: any) {
      alert('Error uploading avatar: ' + err.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdateProfile = async () => {
    setIsUpdatingProfile(true);
    try {
      const updateData: any = {
        data: { full_name: profileName, avatar_url: profileAvatar }
      };
      
      if (profileEmail !== user?.email) updateData.email = profileEmail;
      if (profilePassword && profilePassword.length >= 6) updateData.password = profilePassword;

      const { error } = await supabase.auth.updateUser(updateData);
      if (error) throw error;

      if (profileEmail !== user?.email) {
        alert("Profile updated. A confirmation link has been sent to your new email address.");
      }
      setShowProfileModal(false);
      setProfilePassword('');
    } catch (err: any) {
      alert(err.message);
    }
    setIsUpdatingProfile(false);
  };

  if (!showProfileModal) return null;

  return (
    <div className="fixed inset-0 z-300 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border bg-muted/5 flex justify-between items-center">
          <h3 className="font-black text-xs uppercase tracking-[0.2em] text-foreground">User Profile</h3>
          <button onClick={() => setShowProfileModal(false)} className="p-1 text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex flex-col items-center">
            <div 
              className="w-24 h-24 rounded-2xl bg-accent/10 border-2 border-accent/20 flex items-center justify-center text-accent overflow-hidden mb-4 shadow-inner cursor-pointer group relative"
              onClick={() => avatarFileInputRef.current?.click()}
              title="Click to upload new photo"
            >
              {profileAvatar ? (
                <img src={profileAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={48} />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ImageIcon size={24} className="text-white" />
              </div>
            </div>
            <input type="file" ref={avatarFileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
            <h4 className="font-bold text-lg text-foreground">{profileName || 'Juan Dela Cruz'}</h4>
            <p className="text-xs text-muted font-mono">{user?.email}</p>
            <span className="mt-2 px-2 py-0.5 bg-accent/20 text-accent text-[9px] font-black uppercase rounded tracking-widest">
              {user?.app_metadata?.role || 'User'}
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Full Name</label>
              <input 
                type="text" 
                value={profileName} 
                onChange={(e) => setProfileName(e.target.value)} 
                placeholder=" Juan Dela Cruz"
                className="w-full px-4 py-2.5 bg-muted/5 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Email Address</label>
              <input 
                type="email" 
                value={profileEmail} 
                onChange={(e) => setProfileEmail(e.target.value)} 
                placeholder="admin@labason.gov.ph"
                className="w-full px-4 py-2.5 bg-muted/5 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">New Password</label>
              <input 
                type="password" 
                value={profilePassword} 
                onChange={(e) => setProfilePassword(e.target.value)} 
                placeholder="Leave blank to keep current"
                className="w-full px-4 py-2.5 bg-muted/5 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={() => setShowProfileModal(false)}
              className="flex-1 py-3 border border-border text-foreground rounded-xl font-bold text-xs hover:bg-muted/10 transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              onClick={handleUpdateProfile}
              disabled={isUpdatingProfile}
              className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-bold text-xs shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              {isUpdatingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Update Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
