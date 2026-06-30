import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, Loader2, LogIn } from 'lucide-react';
import { MechanicalBlueprint } from './MechanicalBlueprint';
import { ThemeToggle } from './ThemeToggle';

export const LoginPage = React.memo(() => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (lockoutUntil && Date.now() < lockoutUntil) {
      setError(`Too many attempts. Please try again in ${Math.ceil((lockoutUntil - Date.now()) / 1000)} seconds.`);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.status === 429) {
          setLockoutUntil(Date.now() + 60000); // Lock for 60 seconds
        }
        throw error;
      }
    } catch (err: any) {
      setError(err.status === 429 ? "Too many login attempts. Please wait a minute." : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background overflow-hidden select-none transition-colors duration-300">
      {/* High-Tech Mechanical Blueprint Background */}
      <MechanicalBlueprint />

      {/* Cyber Grid Subtle Overlay (Scales opacity with dark/light themes) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-accent)_5%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-accent)_5%,transparent)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0 opacity-40 dark:opacity-25" />

      {/* Futuristic Theme Switcher Widget in Top Right */}
      <div className="absolute top-5 right-5 z-20 bg-card/60 backdrop-blur-md rounded-xl border border-border/60 p-0.5 shadow-sm">
        <ThemeToggle tooltipAlign="left" />
      </div>

      {/* Login Card Container */}
      <div className="relative z-10 w-full max-w-md p-8 mx-4 bg-card/50 backdrop-blur-xl border border-border/80 rounded-2xl shadow-xl dark:shadow-[0_0_50px_rgba(0,0,0,0.85)] focus-within:border-accent/40 transition-all duration-500 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Corner HUD Bracket Details for engineering theme */}
        <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-accent/40 rounded-tl-sm pointer-events-none" />
        <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-accent/40 rounded-tr-sm pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-accent/40 rounded-bl-sm pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-accent/40 rounded-br-sm pointer-events-none" />

        {/* Glow accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent/60 to-transparent rounded-t-2xl" />

        <div className="flex flex-col items-center mb-8">
          <div className="p-2.5 bg-card/90 dark:bg-zinc-900/60 rounded-2xl mb-4 border border-border/80 shadow-md backdrop-blur-sm">
            <img 
              src="https://www.labason.gov.ph/images/headers/200_pixels_LGU_LOGO.png" 
              alt="LGU Labason Logo" 
              className="w-14 h-14 object-contain brightness-90 dark:brightness-95 contrast-105"
            />
          </div>
          <h1 className="text-xl font-bold tracking-[0.15em] text-foreground uppercase">MEO Data Entry</h1>
          <p className="text-[11px] text-accent font-mono mt-1.5 uppercase tracking-[0.25em] font-bold">LGU Labason System // SECURE PORTAL</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[11px] font-semibold font-mono text-muted uppercase tracking-widest">Email Address</label>
              <span className="text-[10px] font-mono text-muted/80">SYS.USR</span>
            </div>
            {/* Input field with high-tech outline glow & accent line */}
            <div className="relative group/field border border-border focus-within:border-accent/70 bg-background/30 rounded-xl overflow-hidden transition-all duration-300 focus-within:shadow-[0_0_12px_rgba(59,130,246,0.15)] dark:focus-within:shadow-[0_0_12px_rgba(59,130,246,0.1)]">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/70 group-focus-within/field:text-accent transition-colors" size={16} />
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="admin@labason.gov.ph" 
                className="w-full pl-10 pr-4 py-2.5 bg-transparent border-0 text-foreground placeholder:text-muted/65 outline-none text-sm font-sans" 
              />
              {/* Animated bottom accent line expanding on focus */}
              <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-accent scale-x-0 group-focus-within/field:scale-x-100 transition-transform duration-350 origin-center" />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[11px] font-semibold font-mono text-muted uppercase tracking-widest">Password</label>
              <button 
                type="button" 
                onClick={() => alert("Password reset must be initiated via administrator portal.")}
                className="text-[10px] font-mono text-accent hover:text-accent-foreground/80 hover:underline transition-colors uppercase tracking-wider cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            {/* Input field with high-tech outline glow & accent line */}
            <div className="relative group/field border border-border focus-within:border-accent/70 bg-background/30 rounded-xl overflow-hidden transition-all duration-300 focus-within:shadow-[0_0_12px_rgba(59,130,246,0.15)] dark:focus-within:shadow-[0_0_12px_rgba(59,130,246,0.1)]">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/70 group-focus-within/field:text-accent transition-colors" size={16} />
              <input 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
                className="w-full pl-10 pr-4 py-2.5 bg-transparent border-0 text-foreground placeholder:text-muted/65 outline-none text-sm font-sans" 
              />
              {/* Animated bottom accent line expanding on focus */}
              <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-accent scale-x-0 group-focus-within/field:scale-x-100 transition-transform duration-350 origin-center" />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 dark:text-red-400 text-xs font-mono font-medium animate-pulse">
              ERR // {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || (lockoutUntil !== null && Date.now() < lockoutUntil)} 
            className="btn-energy-pulse relative w-full py-3 bg-accent hover:opacity-95 disabled:bg-muted/20 text-accent-foreground disabled:text-muted rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:active:scale-100 flex items-center justify-center gap-2 overflow-hidden group/btn cursor-pointer">
            {/* Glossy sheen effect on hover */}
            <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-[-25deg] translate-x-[-150%] group-hover/btn:translate-x-[250%] transition-transform duration-1000" />
            
            {loading ? (
              <Loader2 className="animate-spin text-accent-foreground" size={15} />
            ) : (
              <LogIn size={15} className="text-accent-foreground" />
            )}
            Establish Session
          </button>
        </form>
      </div>
    </div>
  );
});

LoginPage.displayName = 'LoginPage';
