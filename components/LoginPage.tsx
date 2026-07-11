import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, Loader2, LogIn, Layers, Network } from 'lucide-react';
import { MechanicalBlueprint } from './MechanicalBlueprint';
import { ParticleConstellation } from './ParticleConstellation';
import { ThemeToggle } from './ThemeToggle';

export const LoginPage = React.memo(() => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [bgStyle, setBgStyle] = useState<'blueprint' | 'particles'>('particles');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    if (lockoutUntil && Date.now() < lockoutUntil) {
      setError(`Too many attempts. Please try again in ${Math.ceil((lockoutUntil - Date.now()) / 1000)} seconds.`);
      setLoading(false);
      return;
    }

    try {
      sessionStorage.setItem('meo-auth-login-attempt', 'true');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        sessionStorage.removeItem('meo-auth-login-attempt');
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
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background overflow-hidden transition-colors duration-500">
      
      {/* High-Tech Background Selector */}
      {bgStyle === 'particles' ? (
        <ParticleConstellation />
      ) : (
        <MechanicalBlueprint />
      )}

      {/* Cyber Grid Subtle Overlay (Scales opacity with dark/light themes) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-accent)_5%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-accent)_5%,transparent)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0 opacity-40 dark:opacity-25" />

      {/* Glowing Glassmorphic Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Blob 1: Pink/magenta blob in top-left/center area */}
        <div className="absolute top-[10%] left-[10%] md:left-[20%] w-72 md:w-[450px] h-72 md:h-[450px] rounded-full bg-pink-500/15 dark:bg-pink-600/10 blur-[80px] md:blur-[120px] animate-blob-slow mix-blend-multiply dark:mix-blend-screen" />
        {/* Blob 2: Blue/cyan blob in bottom-right/center area */}
        <div className="absolute bottom-[10%] right-[10%] md:right-[20%] w-72 md:w-[450px] h-72 md:h-[450px] rounded-full bg-blue-500/15 dark:bg-cyan-600/10 blur-[80px] md:blur-[120px] animate-blob-reverse mix-blend-multiply dark:mix-blend-screen" />
        {/* Blob 3: Purple/violet blob in middle-left area */}
        <div className="absolute top-[35%] left-[5%] w-64 md:w-[350px] h-64 md:h-[350px] rounded-full bg-purple-500/10 dark:bg-violet-600/10 blur-[80px] md:blur-[120px] animate-blob-slow-alt mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {/* Futuristic Controls HUD in Top Right */}
      <div className="absolute top-5 right-5 z-20 flex items-center gap-1 bg-white/10 dark:bg-black/25 backdrop-blur-md rounded-xl border border-white/20 dark:border-white/10 p-1 shadow-lg transition-all duration-300">
        <button
          onClick={() => setBgStyle(bgStyle === 'particles' ? 'blueprint' : 'particles')}
          className="p-2 text-muted hover:text-accent group relative focus-visible:ring-2 focus-visible:ring-accent outline-none rounded-lg transition-colors cursor-pointer"
          aria-label="Toggle Background Style"
        >
          {bgStyle === 'particles' ? <Layers size={18} /> : <Network size={18} />}
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity">
            {bgStyle === 'particles' ? "Switch to Blueprint" : "Switch to Particles"}
          </div>
        </button>
        <div className="w-[1px] h-5 bg-white/20 dark:bg-white/10" />
        <ThemeToggle tooltipAlign="left" />
      </div>

      {/* Glassmorphic Login Card Container */}
      <div className="relative z-10 w-full max-w-md p-8 mx-4 bg-white/15 dark:bg-slate-950/30 backdrop-blur-2xl border border-white/25 dark:border-white/10 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] shadow-inner-white focus-within:border-accent/40 transition-all duration-500 hover:scale-[1.01] hover:shadow-[0_20px_40px_rgba(31,38,135,0.2)] dark:hover:shadow-[0_20px_50px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-300">
        
        {/* Ambient top light glow reflection */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-t-3xl opacity-80" />

        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-white/10 dark:bg-black/20 rounded-2xl mb-4 border border-white/20 dark:border-white/10 shadow-inner-white backdrop-blur-md">
            <img 
              src="/logo.png" 
              alt="LGU Labason Logo" 
              className="w-14 h-14 object-contain brightness-95 dark:brightness-100 contrast-105 drop-shadow-md"
            />
          </div>
          <h1 className="text-xl font-bold tracking-[0.15em] text-foreground uppercase">MEO Data Entry</h1>
          <p className="text-[10px] text-accent dark:text-blue-400 font-mono mt-1.5 uppercase tracking-[0.25em] font-bold">LGU Labason System // SECURE PORTAL</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[11px] font-semibold font-mono text-muted uppercase tracking-widest">Email Address</label>
              <span className="text-[10px] font-mono text-muted/80">SYS.USR</span>
            </div>
            {/* Input field with glassmorphic styling */}
            <div className="relative group/field border border-white/15 dark:border-white/5 focus-within:border-accent/70 bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-xl overflow-hidden transition-all duration-300 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.25)]">
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
                onClick={() => { setInfo("Password reset must be initiated via administrator portal."); setError(null); }}
                className="text-[10px] font-mono text-accent dark:text-blue-400 hover:text-accent-foreground/80 dark:hover:text-blue-300 hover:underline transition-colors uppercase tracking-wider cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            {/* Input field with glassmorphic styling */}
            <div className="relative group/field border border-white/15 dark:border-white/5 focus-within:border-accent/70 bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-xl overflow-hidden transition-all duration-300 focus-within:shadow-[0_0_15px_rgba(59,130,246,0.25)]">
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

          {info && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 backdrop-blur-md rounded-xl text-amber-600 dark:text-amber-400 text-xs font-mono font-medium animate-pulse">
              INFO // {info}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-xl text-red-600 dark:text-red-400 text-xs font-mono font-medium animate-pulse">
              ERR // {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || (lockoutUntil !== null && Date.now() < lockoutUntil)} 
            className="btn-energy-pulse relative w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 hover:opacity-95 disabled:bg-muted/20 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 dark:shadow-none hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:active:scale-100 flex items-center justify-center gap-2 overflow-hidden group/btn cursor-pointer">
            {/* Glossy sheen effect on hover */}
            <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-25deg] translate-x-[-150%] group-hover/btn:translate-x-[250%] transition-transform duration-1000" />
            
            {loading ? (
              <Loader2 className="animate-spin text-white" size={15} />
            ) : (
              <LogIn size={15} className="text-white" />
            )}
            Establish Session
          </button>
        </form>
      </div>
    </div>
  );
});

LoginPage.displayName = 'LoginPage';

