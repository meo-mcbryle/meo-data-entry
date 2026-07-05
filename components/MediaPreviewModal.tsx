import React, { useState, useEffect } from 'react';
import { Paperclip, ImageIcon, FileIcon, Download, Trash2, X, AlertTriangle, Loader2 } from 'lucide-react';

interface Attachment {
  type: 'image' | 'file';
  url: string;
  name: string;
  size?: number;
  contentType?: string;
  path?: string;
  isOffline?: boolean;
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

const ImageWithLoader = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full h-full bg-muted/10 flex items-center justify-center">
      {!loaded && !error && (
        <div className="absolute inset-0 bg-muted/20 animate-pulse flex items-center justify-center">
          <Loader2 className="text-accent animate-spin" size={18} />
        </div>
      )}
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/5 text-red-500/50 p-2 text-center">
          <AlertTriangle size={18} />
          <span className="text-[8px] font-mono mt-1 uppercase">Load Error</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
};

const LightboxImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative max-w-full max-h-[85vh] flex items-center justify-center">
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      )}
      {error ? (
        <div className="p-8 text-center text-red-500 flex flex-col items-center gap-2">
          <AlertTriangle size={32} />
          <p className="text-xs font-mono uppercase tracking-widest">Failed to load high-res image</p>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`${className} transition-opacity duration-350 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
};

export const MediaPreviewModal = ({
  viewingMedia,
  setViewingMedia,
  insertMedia,
  deleteAttachment,
  formatSize
}: MediaPreviewModalProps) => {
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!viewingMedia) return;

    let active = true;
    const urls: Record<string, string> = {};
    const objectUrlsToClean: string[] = [];

    const resolve = async () => {
      const { LocalDB } = await import('@/lib/local-db');
      for (const att of viewingMedia.attachments) {
        if (att.path) {
          const local = await LocalDB.getAttachment(att.path);
          if (local && local.blob) {
            const objUrl = URL.createObjectURL(local.blob);
            urls[att.path] = objUrl;
            objectUrlsToClean.push(objUrl);
            continue;
          }
        }
        
        if (att.url) {
          urls[att.path || att.url] = att.url;

          // Cache remote attachment in the background
          if (typeof window !== 'undefined' && navigator.onLine && att.path && !att.url.startsWith('blob:') && att.url.startsWith('http')) {
            fetch(att.url)
              .then(res => res.blob())
              .then(async (blob) => {
                const { LocalDB: DB } = await import('@/lib/local-db');
                await DB.saveAttachment({
                  path: att.path!,
                  blob,
                  synced: 1,
                  name: att.name,
                  type: att.type,
                  size: att.size || blob.size,
                  contentType: att.contentType || blob.type
                });
              })
              .catch(err => console.warn('Failed to background cache attachment:', err));
          }
        }
      }
      if (active) {
        setResolvedUrls(urls);
      }
    };

    resolve();

    return () => {
      active = false;
      objectUrlsToClean.forEach(url => URL.revokeObjectURL(url));
    };
  }, [viewingMedia]);

  if (!viewingMedia) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/70 backdrop-blur-md antialiased animate-in fade-in duration-300" 
        onClick={() => setViewingMedia(null)}
      >
        {/* Sleek Glassmorphic Core Card */}
        <div 
          className="relative bg-card/65 backdrop-blur-xl rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-border/80 p-6 gap-5" 
          onClick={e => e.stopPropagation()}
        >
          {/* Glow accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-transparent via-accent to-transparent" />

          {/* Header section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-accent/10 text-accent rounded-xl border border-accent/20 flex items-center justify-center">
                <Paperclip size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Cell Attachments</h3>
                <p className="text-[10px] text-accent font-mono font-bold tracking-wider uppercase">
                  Row {viewingMedia.row + 1} • Col {viewingMedia.col}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => insertMedia(viewingMedia.row, viewingMedia.col, 'image')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-green-500/20 active:scale-95 transition-all border border-green-500/20 shadow-sm cursor-pointer"
              >
                <ImageIcon size={12} /> Add Image
              </button>
              <button 
                onClick={() => insertMedia(viewingMedia.row, viewingMedia.col, 'file')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-amber-500/20 active:scale-95 transition-all border border-amber-500/20 shadow-sm cursor-pointer"
              >
                <Paperclip size={12} /> Add File
              </button>
              
              <div className="h-5 w-px bg-border/60 mx-1" />
              
              <button 
                onClick={() => setViewingMedia(null)} 
                className="p-2 hover:bg-muted/15 rounded-lg text-muted hover:text-foreground transition-all duration-150 active:scale-95 cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          <div className="h-px bg-border/50" />
          
          <div className="overflow-y-auto bg-background/20 rounded-xl border border-border/40 p-4 max-h-[60vh] custom-scrollbar flex-1 space-y-6">
            {viewingMedia.attachments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted">
                <Paperclip size={32} className="text-accent/30 mb-2" />
                <p className="text-xs">No attachments associated with this cell.</p>
                <p className="text-[10px] text-muted font-mono tracking-wide mt-1 uppercase">Click Add Image or Add File to upload</p>
              </div>
            ) : (
              <>
                {/* Images Section */}
                {viewingMedia.attachments.some((m: any) => m.type === 'image') && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon size={14} className="text-green-500" /> Images
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {viewingMedia.attachments.map((img: any, idx: number) => {
                        if (img.type !== 'image') return null;
                        const displayUrl = resolvedUrls[img.path || img.url] || img.url;
                        return (
                          <div key={idx} className="group relative bg-card/40 hover:bg-card/75 p-2 rounded-xl border border-border/60 hover:border-accent/40 shadow-sm hover:shadow-md transition-all duration-200">
                            <div className="relative aspect-video rounded-lg bg-background/50 overflow-hidden border border-border/30">
                              <ImageWithLoader src={displayUrl} alt={img.name} className="w-full h-full object-contain" />
                              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => setLightboxImage({ url: displayUrl, name: img.name })}
                                  className="px-2.5 py-1.5 bg-accent text-accent-foreground text-[10px] font-bold rounded-lg hover:bg-accent/90 active:scale-95 transition-all shadow-md cursor-pointer uppercase tracking-wider"
                                >
                                  View
                                </button>
                                <a 
                                  href={displayUrl} 
                                  download={img.name}
                                  className="p-1.5 bg-muted/20 text-foreground border border-border/80 rounded-lg hover:bg-accent hover:text-accent-foreground transition-all shadow-sm flex items-center justify-center"
                                  title="Download Image"
                                >
                                  <Download size={13} />
                                </a>
                                <button 
                                  onClick={() => deleteAttachment(viewingMedia.row, viewingMedia.col, idx)}
                                  className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                  title="Delete Image"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 px-1 flex items-center justify-between gap-2">
                              <p className="text-[10px] font-bold text-foreground truncate flex-1" title={img.name}>{img.name}</p>
                              {img.size !== undefined && (
                                <span className="text-[8px] font-mono text-muted whitespace-nowrap">{formatSize(img.size)}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Files Section */}
                {viewingMedia.attachments.some((m: any) => m.type === 'file') && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                      <FileIcon size={14} className="text-amber-500" /> Documents & Files
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {viewingMedia.attachments.map((file: any, idx: number) => {
                        if (file.type !== 'file') return null;
                        const displayUrl = resolvedUrls[file.path || file.url] || file.url;
                        return (
                          <div key={idx} className="flex items-center gap-3 bg-card/45 border border-border/60 rounded-xl p-3 shadow-sm hover:border-accent/40 hover:bg-card/75 transition-all duration-200 group">
                            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 flex items-center justify-center shrink-0">
                              <FileIcon size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-foreground truncate leading-tight" title={file.name}>{file.name}</p>
                              <p className="text-[8px] text-muted font-mono uppercase tracking-wider mt-0.5">{formatSize(file.size || 0)}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <a 
                                href={displayUrl} 
                                download={file.name} 
                                className="p-2 bg-muted/15 border border-border/40 text-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-all flex items-center justify-center" 
                                title="Download File"
                              >
                                <Download size={12} />
                              </a>
                              <button 
                                onClick={() => deleteAttachment(viewingMedia.row, viewingMedia.col, idx)}
                                className="p-2 bg-muted/15 border border-border/40 text-foreground rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500/20 transition-all flex items-center justify-center cursor-pointer"
                                title="Delete Attachment"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="h-px bg-border/50" />

          {/* Footer Controls */}
          <div className="flex justify-end gap-2.5">
            <button 
              onClick={() => setViewingMedia(null)}
              className="px-4 py-2 hover:bg-muted/15 border border-transparent rounded-lg text-xs font-bold text-muted hover:text-foreground transition-all duration-150 active:scale-95 cursor-pointer"
            >
              Close Panel
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Image Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
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
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-colors flex items-center justify-center shadow-lg border border-zinc-700 cursor-pointer"
              title="Download Image"
            >
              <Download size={18} />
            </a>
            <button 
              onClick={() => setLightboxImage(null)}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-colors flex items-center justify-center shadow-lg border border-zinc-700 cursor-pointer"
              title="Close Full Screen"
            >
              <X size={18} />
            </button>
          </div>

          {/* Full Screen Image */}
          <div 
            className="relative max-w-full max-h-[85vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <LightboxImage 
              src={lightboxImage.url} 
              alt={lightboxImage.name} 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200" 
            />
          </div>
          
          {/* Label */}
          <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
            <span className="px-4 py-1.5 bg-black/70 backdrop-blur-md text-white text-[10px] font-mono font-bold tracking-wider rounded-full border border-white/10 uppercase shadow-lg">
              {lightboxImage.name}
            </span>
          </div>
        </div>
      )}
    </>
  );
};
