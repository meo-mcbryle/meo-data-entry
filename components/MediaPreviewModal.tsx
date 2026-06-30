import React, { useState, useEffect } from 'react';
import { Paperclip, ImageIcon, FileIcon, Download, Trash2, X } from 'lucide-react';

interface Attachment {
  type: 'image' | 'file';
  url: string;
  name: string;
  size?: number;
}

interface MediaPreviewModalProps {
  viewingMedia: {
    attachments: Attachment[];
    row: number;
    col: string;
  } | null;
  setViewingMedia: (value: any) => void;
  insertMedia: (row: number, col: string, type: 'image' | 'file') => void;
  deleteAttachment: (row: number, col: string, index: number) => void;
  formatSize: (bytes: number) => string;
}

export const MediaPreviewModal = ({
  viewingMedia,
  setViewingMedia,
  insertMedia,
  deleteAttachment,
  formatSize
}: MediaPreviewModalProps) => {
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!viewingMedia) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={() => setViewingMedia(null)}
      >
        <div 
          className="bg-card rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-border" 
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0 bg-muted/5">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Paperclip size={18} className="text-accent" />
                Cell Attachments ({viewingMedia.attachments.length})
              </h3>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => insertMedia(viewingMedia.row, viewingMedia.col, 'image')}
                  className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-green-500/20 transition-colors border border-green-500/20 shadow-sm"
                >
                  <ImageIcon size={12} /> Add Image
                </button>
                <button 
                  onClick={() => insertMedia(viewingMedia.row, viewingMedia.col, 'file')}
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-amber-500/20 transition-colors border border-amber-500/20 shadow-sm"
                >
                  <Paperclip size={12} /> Add File
                </button>
              </div>
            </div>
            <button onClick={() => setViewingMedia(null)} className="p-1 hover:bg-muted/10 rounded-full transition-colors text-muted hover:text-foreground">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto bg-background/50 flex-1">
            {/* Images Section */}
            {viewingMedia.attachments.some((m: any) => m.type === 'image') && (
              <div className="mb-8">
                <h4 className="text-xs font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ImageIcon size={14} className="text-green-500" /> Images
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {viewingMedia.attachments.map((img: any, idx: number) => {
                    if (img.type !== 'image') return null;
                    return (
                      <div key={idx} className="group relative bg-card p-2 rounded-xl border border-border shadow-sm hover:shadow-md transition-all">
                        <div className="relative aspect-video rounded-lg bg-background overflow-hidden">
                          <img src={img.url} alt={img.name} className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button 
                              onClick={() => setLightboxImage({ url: img.url, name: img.name })}
                              className="px-2.5 py-1.5 bg-accent text-accent-foreground text-[10px] font-bold rounded-lg hover:bg-accent/80 transition-colors shadow-md cursor-pointer"
                            >
                              Open Full Size
                            </button>
                            <a 
                              href={img.url} 
                              download={img.name}
                              className="p-1.5 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors shadow-md"
                              title="Download Image"
                            >
                              <Download size={12} />
                            </a>
                            <button 
                              onClick={() => deleteAttachment(viewingMedia.row, viewingMedia.col, idx)}
                              className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                              title="Delete Image"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 px-1">
                          <p className="text-[10px] font-bold text-foreground truncate">{img.name}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Files Section */}
            {viewingMedia.attachments.some((m: any) => m.type === 'file') && (
              <div>
                <h4 className="text-xs font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                  <FileIcon size={14} className="text-amber-500" /> Documents & Files
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {viewingMedia.attachments.map((file: any, idx: number) => {
                    if (file.type !== 'file') return null;
                    return (
                      <div key={idx} className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm hover:bg-muted/5 transition-colors group">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                          <FileIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-foreground truncate leading-tight">{file.name}</p>
                          <p className="text-[9px] text-muted uppercase tracking-tighter">{formatSize(file.size || 0)}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a href={file.url} download={file.name} className="p-2 bg-muted/10 text-muted rounded-lg hover:bg-accent hover:text-accent-foreground transition-all" title="Download">
                            <Download size={14} />
                          </a>
                          <button 
                            onClick={() => deleteAttachment(viewingMedia.row, viewingMedia.col, idx)}
                            className="p-2 bg-muted/10 text-muted rounded-lg hover:bg-red-500 hover:text-white transition-all"
                            title="Delete Attachment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Image Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          {/* Top action bar */}
          <div 
            className="absolute top-4 right-4 flex items-center gap-3 z-[310]"
            onClick={e => e.stopPropagation()}
          >
            <a 
              href={lightboxImage.url} 
              download={lightboxImage.name}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-colors flex items-center justify-center shadow-lg border border-zinc-700"
              title="Download Image"
            >
              <Download size={20} />
            </a>
            <button 
              onClick={() => setLightboxImage(null)}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-colors flex items-center justify-center shadow-lg border border-zinc-700 cursor-pointer"
              title="Close Full Screen"
            >
              <X size={20} />
            </button>
          </div>

          {/* Full Screen Image */}
          <div 
            className="relative max-w-full max-h-[90vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <img 
              src={lightboxImage.url} 
              alt={lightboxImage.name} 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" 
            />
          </div>
          
          {/* Label */}
          <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
            <span className="px-4 py-1.5 bg-black/60 text-white text-xs font-mono rounded-full border border-white/10">{lightboxImage.name}</span>
          </div>
        </div>
      )}
    </>
  );
};
