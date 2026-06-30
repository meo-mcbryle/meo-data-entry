import React, { createContext, useContext, useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

interface ThemeContextProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextProps>({
  theme: 'dark',
  toggleTheme: () => {}
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeToggleProps {
  tooltipAlign?: 'left' | 'right' | 'bottom' | 'top';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ tooltipAlign = 'right' }) => {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by rendering the fallback on the server, 
  // and the actual theme state on the client after mount.
  const displayTheme = mounted ? theme : 'dark';

  const positionClasses = {
    right: 'absolute left-full ml-3 top-1/2 -translate-y-1/2',
    left: 'absolute right-full mr-3 top-1/2 -translate-y-1/2',
    bottom: 'absolute top-full mt-2 left-1/2 -translate-x-1/2',
    top: 'absolute bottom-full mb-2 left-1/2 -translate-x-1/2',
  }[tooltipAlign];

  return (
    <button 
      onClick={toggleTheme}
      className="p-2 text-muted hover:text-accent group relative focus-visible:ring-2 focus-visible:ring-accent outline-none rounded-lg"
      aria-label={`Switch to ${displayTheme === 'light' ? 'dark' : 'light'} mode`}
    >
      {displayTheme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      <div className={`${positionClasses} px-2 py-1 bg-foreground text-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100 shadow-2xl uppercase tracking-wider transition-opacity`}>
        {displayTheme === 'light' ? "Dark Mode" : "Light Mode"}
      </div>
    </button>
  );
};
