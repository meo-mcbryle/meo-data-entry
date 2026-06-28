import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, Loader2, LogIn } from 'lucide-react';

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
        // If Supabase returns a 429 (Too Many Requests), trigger a local lockout
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
    <div className="min-h-screen flex items-center justify-center bg-background bg-[linear-gradient(to_right,var(--color-grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-grid-line)_1px,transparent_1px)] bg-[size:24px_24px]">
      <div className="w-full max-w-md p-8 bg-card border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center mb-8">
          <div className="p-2 bg-white rounded-2xl mb-4 shadow-inner border border-border">
            <img 
              src="https://www.labason.gov.ph/images/headers/200_pixels_LGU_LOGO.png" 
              alt="LGU Labason Logo" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">MEO Data Entry</h1>
          <p className="text-sm text-muted font-medium mt-1 uppercase tracking-[0.2em]">LGU Labason System</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={18} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@labason.gov.ph" className="w-full pl-10 pr-4 py-2.5 bg-muted/5 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={18} />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-4 py-2.5 bg-muted/5 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm" />
            </div>
          </div>
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-medium">{error}</div>}
          <button 
            type="submit" 
            disabled={loading || (lockoutUntil !== null && Date.now() < lockoutUntil)} 
            className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            Sign In to System
          </button>
        </form>
      </div>
    </div>
  );
});
