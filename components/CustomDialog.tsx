import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface CustomDialogProps {
  isOpen: boolean;
  type: 'confirm' | 'prompt';
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const CustomDialog = ({
  isOpen,
  type,
  title,
  message,
  defaultValue = '',
  placeholder = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}: CustomDialogProps) => {
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue);
      setTimeout(() => {
        if (type === 'prompt' && inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, defaultValue, type]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onConfirm(type === 'prompt' ? inputValue : '');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[300] flex items-center justify-center bg-background/70 backdrop-blur-md antialiased animate-in fade-in duration-200"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="relative w-full max-w-md mx-4 overflow-hidden border border-border/80 rounded-2xl bg-card/65 backdrop-blur-xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        
        {/* Glow accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-[2.5px] ${isDestructive ? 'bg-gradient-to-r from-transparent via-red-500 to-transparent' : 'bg-gradient-to-r from-transparent via-accent to-transparent'}`} />

        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">{title}</h3>
          <button 
            type="button"
            onClick={onCancel}
            className="p-1 hover:bg-muted/15 rounded-lg text-muted hover:text-foreground transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-xs font-medium text-muted/90">{message}</p>
          
          {type === 'prompt' && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 text-xs bg-muted/10 border border-border rounded-lg outline-none focus:ring-1 focus:ring-accent focus:bg-card text-foreground transition-all"
            />
          )}

          <div className="flex justify-end gap-2 mt-2">
            {cancelText && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 bg-muted/10 hover:bg-muted/20 text-foreground text-xs font-bold rounded-lg active:scale-95 transition-all cursor-pointer"
              >
                {cancelText}
              </button>
            )}
            <button
              type="submit"
              className={`px-4 py-2 text-xs font-bold rounded-lg active:scale-95 transition-all cursor-pointer ${
                isDestructive 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-accent text-accent-foreground hover:opacity-90'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
