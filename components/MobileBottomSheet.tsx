import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const MobileBottomSheet = ({
  isOpen,
  onClose,
  title,
  children
}: MobileBottomSheetProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll when bottom sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-end justify-center md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet Content Container */}
      <div
        data-sheet
        className="relative w-full max-h-[85vh] bg-card/90 backdrop-blur-2xl border-t border-border/40 rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] p-5 pb-safe z-[260] flex flex-col gap-4 animate-in slide-in-from-bottom duration-300"
      >
        {/* Glow Accent top bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />

        {/* Drag/Handle Bar */}
        <div 
          className="w-12 h-1 bg-muted/30 rounded-full mx-auto cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={onClose}
        />

        {/* Header (optional) */}
        {title && (
          <div className="flex justify-between items-center mt-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-muted/15 rounded-lg text-muted hover:text-foreground transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Main Body */}
        <div className="overflow-y-auto flex-1 min-h-0 py-1 no-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
