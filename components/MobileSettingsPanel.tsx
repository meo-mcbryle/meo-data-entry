import React from 'react';
import { User, Sun, Moon, Layers, Network, LogOut, EyeOff } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface MobileSettingsPanelProps {
  user: SupabaseUser | null;
  profileAvatar: string | null;
  setShowProfileModal: (show: boolean) => void;
  bgStyle: 'particles' | 'blueprint' | 'none';
  setBgStyle: (style: 'particles' | 'blueprint' | 'none') => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  handleLogout: () => void;
}

export const MobileSettingsPanel: React.FC<MobileSettingsPanelProps> = ({
  user,
  profileAvatar,
  setShowProfileModal,
  bgStyle,
  setBgStyle,
  theme,
  toggleTheme,
  handleLogout
}) => {
  return (
    <div className="flex-1 flex flex-col p-5 bg-card/45 backdrop-blur-lg border border-border/50 rounded-xl shadow-lg relative overflow-hidden gap-4 min-h-[480px]">
      {/* Glow top border */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-accent to-transparent" />
      
      {/* Profile info card */}
      <div className="flex items-center gap-4 p-4 bg-muted/5 border border-border/30 rounded-xl relative">
        <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/60 bg-muted/10 shadow-inner flex items-center justify-center">
          {profileAvatar ? (
            <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User size={26} className="text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-foreground truncate">{user?.email?.split('@')[0]}</h4>
          <p className="text-[10px] font-semibold text-muted truncate">{user?.email}</p>
        </div>
        <button 
          onClick={() => setShowProfileModal(true)}
          className="px-3 py-1.5 bg-accent/10 border border-accent/20 hover:bg-accent/20 rounded-lg text-[9px] font-black text-accent uppercase tracking-wider transition-all cursor-pointer"
        >
          Edit
        </button>
      </div>

      <div className="h-px bg-border/40 my-1 mx-2" />

      {/* UI Settings */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-black text-muted uppercase tracking-[0.18em] px-2 mb-0.5">Interface settings</span>
        
        {/* Theme Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-muted/5 border border-border/30 rounded-xl">
          <span className="text-xs font-bold text-foreground">Theme Mode</span>
          <button 
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-bold text-foreground shadow-sm cursor-pointer active:scale-95 transition-all"
          >
            {theme === 'dark' ? <Sun size={13} className="text-amber-500" /> : <Moon size={13} className="text-blue-500" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        {/* Background Animation Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-muted/5 border border-border/30 rounded-xl">
          <span className="text-xs font-bold text-foreground">Background Effect</span>
          <button 
            onClick={() => setBgStyle(bgStyle === 'particles' ? 'blueprint' : bgStyle === 'blueprint' ? 'none' : 'particles')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-bold text-foreground shadow-sm cursor-pointer active:scale-95 transition-all"
          >
            {bgStyle === 'particles' ? <Layers size={13} className="text-purple-500" /> : bgStyle === 'blueprint' ? <EyeOff size={13} className="text-muted" /> : <Network size={13} className="text-cyan-500" />}
            {bgStyle === 'particles' ? 'Blueprint' : bgStyle === 'blueprint' ? 'Static (Off)' : 'Particles'}
          </button>
        </div>
      </div>

      {/* Footer / Sign Out */}
      <div className="mt-auto pt-6 flex flex-col gap-3">
        <button 
          onClick={handleLogout}
          className="w-full py-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-500 text-xs font-black uppercase tracking-[0.18em] rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <LogOut size={15} />
          <span>Sign Out Admin</span>
        </button>
        <p className="text-[8px] font-mono text-muted/30 text-center tracking-widest select-none">
          MEO SECURE SYSTEM V1.0
        </p>
      </div>
    </div>
  );
};
