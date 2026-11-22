import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpToLine,
  CheckCircle2,
  Image as ImageIcon,
  ImagePlus,
  Link2,
  Loader2,
  PanelLeft,
  PanelRight,
  Upload,
  X
} from 'lucide-react';

export type MarkdownImagePlacement = 'top' | 'bottom' | 'left' | 'right';

export function parseMarkdownImageAltAndPlacement(rawAlt: string): {
  alt: string;
  align: 'block' | 'left' | 'right';
} {
  const match = rawAlt.match(/^(.*?)\|(left|right|center|top|bottom)$/i);
  if (!match) {
    return {
      alt: rawAlt.trim(),
      align: 'block'
    };
  }
  const pos = match[2].toLowerCase();
  return {
    alt: match[1].trim(),
    align: pos === 'left' ? 'left' : pos === 'right' ? 'right' : 'block'
  };
}

const MAX_DIMENSION_PX = 1400;
const MAX_DATA_URL_BYTES = 750 * 1024; // Keep well under Firestore document limits

export function isSafeMarkdownImageUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
  if (/^\/(?!\/)\S+$/.test(trimmed)) return true;
  if (
    /^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(
      trimmed
    )
  ) {
    return true;
  }
  return false;
}

export interface ProcessedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  byteSize: number;
  suggestedAlt: string;
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanFilenameToAlt(filename: string): string {
  const base = filename.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || 'Course diagram';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to decode this image file.'));
    img.src = src;
  });
}

export async function processImageFileToDataUrl(
  file: File
): Promise<ProcessedImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (PNG, JPG, WebP, GIF, or SVG).');
  }

  const suggestedAlt = cleanFilenameToAlt(file.name);
  const rawDataUrl = await readFileAsDataUrl(file);

  // Preserve small SVGs and animated GIFs directly when within budget
  if (
    (file.type === 'image/svg+xml' && rawDataUrl.length <= 220 * 1024) ||
    (file.type === 'image/gif' && rawDataUrl.length <= 500 * 1024)
  ) {
    return {
      dataUrl: rawDataUrl,
      width: 0,
      height: 0,
      byteSize: rawDataUrl.length,
      suggestedAlt
    };
  }

  const img = await loadImageElement(rawDataUrl);
  const origW = img.naturalWidth || img.width || 800;
  const origH = img.naturalHeight || img.height || 600;

  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(origW, origH));
  const targetW = Math.max(1, Math.round(origW * scale));
  const targetH = Math.max(1, Math.round(origH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if (rawDataUrl.length <= MAX_DATA_URL_BYTES) {
      return {
        dataUrl: rawDataUrl,
        width: origW,
        height: origH,
        byteSize: rawDataUrl.length,
        suggestedAlt
      };
    }
    throw new Error('Browser canvas unavailable to resize large image.');
  }

  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Try WebP first (supports transparency & high compression), then JPEG fallback
  let outputUrl = canvas.toDataURL('image/webp', 0.84);
  if (!outputUrl.startsWith('data:image/webp')) {
    outputUrl = canvas.toDataURL('image/jpeg', 0.84);
  }

  // If original was already smaller and within dimensions, keep the smaller one
  if (
    scale === 1 &&
    rawDataUrl.length < outputUrl.length &&
    /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(rawDataUrl)
  ) {
    outputUrl = rawDataUrl;
  }

  // Re-encode at slightly lower quality if still oversized
  if (outputUrl.length > MAX_DATA_URL_BYTES) {
    const compressed = canvas.toDataURL('image/webp', 0.65);
    outputUrl = compressed.startsWith('data:image/webp')
      ? compressed
      : canvas.toDataURL('image/jpeg', 0.68);
  }

  if (outputUrl.length > MAX_DATA_URL_BYTES) {
    throw new Error(
      'Image is too large even after optimization. Please use an image URL or a smaller image.'
    );
  }

  return {
    dataUrl: outputUrl,
    width: targetW,
    height: targetH,
    byteSize: outputUrl.length,
    suggestedAlt
  };
}

interface MarkdownImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (payload: { src: string; alt: string; placement: MarkdownImagePlacement }) => void;
}

const PLACEMENT_OPTIONS: {
  id: MarkdownImagePlacement;
  label: string;
  hint: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'top',
    label: 'Top',
    hint: 'Places the image at the top above your text.',
    icon: ArrowUpToLine
  },
  {
    id: 'bottom',
    label: 'Bottom',
    hint: 'Places the image at the bottom below your text.',
    icon: ArrowDownToLine
  },
  {
    id: 'left',
    label: 'Left',
    hint: 'Places the image on the left side with text beside it on the right.',
    icon: PanelLeft
  },
  {
    id: 'right',
    label: 'Right',
    hint: 'Places the image on the right side with text beside it on the left.',
    icon: PanelRight
  }
];

export const MarkdownImageModal: React.FC<MarkdownImageModalProps> = ({
  isOpen,
  onClose,
  onInsert
}) => {
  const [sourceTab, setSourceTab] = useState<'upload' | 'url'>('upload');
  const [placement, setPlacement] = useState<MarkdownImagePlacement>('top');
  const [caption, setCaption] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploadedPreview, setUploadedPreview] = useState<ProcessedImageResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [urlPreviewStatus, setUrlPreviewStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    'idle'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSourceTab('upload');
    setPlacement('top');
    setCaption('');
    setImageUrl('');
    setUploadedPreview(null);
    setIsProcessing(false);
    setIsDragging(false);
    setErrorMsg(null);
    setUrlPreviewStatus('idle');
  }, [isOpen]);

  const handleSelectedFile = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const processed = await processImageFileToDataUrl(file);
      setUploadedPreview(processed);
      if (!caption.trim()) {
        setCaption(processed.suggestedAlt);
      }
    } catch (err) {
      setUploadedPreview(null);
      setErrorMsg(err instanceof Error ? err.message : 'Could not process selected image.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Support Ctrl+V / Cmd+V image paste while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const handleWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            setSourceTab('upload');
            void handleSelectedFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmedUrl = imageUrl.trim();
  const isUrlValid = isSafeMarkdownImageUrl(trimmedUrl);

  const canSubmit =
    sourceTab === 'upload'
      ? Boolean(uploadedPreview?.dataUrl) && !isProcessing
      : isUrlValid;

  const handleConfirmInsert = () => {
    const cleanAlt = caption.trim().replace(/[\r\n[\]|]/g, ' ').trim();
    if (sourceTab === 'upload' && uploadedPreview) {
      onInsert({
        src: uploadedPreview.dataUrl,
        alt: cleanAlt || uploadedPreview.suggestedAlt,
        placement
      });
      onClose();
    } else if (sourceTab === 'url' && isUrlValid) {
      onInsert({
        src: trimmedUrl,
        alt: cleanAlt || 'Course illustration',
        placement
      });
      onClose();
    }
  };

  const activePlacementOption =
    PLACEMENT_OPTIONS.find(opt => opt.id === placement) || PLACEMENT_OPTIONS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="insert-image-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <ImagePlus className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="insert-image-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                Insert Image
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Upload, drag &amp; drop, paste from clipboard, or link an image URL
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close insert image dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Source Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setSourceTab('upload');
                setErrorMsg(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                sourceTab === 'upload'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload / Paste File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceTab('url');
                setErrorMsg(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                sourceTab === 'url'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Paste Image URL</span>
            </button>
          </div>

          {sourceTab === 'upload' ? (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleSelectedFile(file);
                  }
                  e.target.value = '';
                }}
              />

              {!uploadedPreview ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      void handleSelectedFile(file);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`p-6 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors space-y-2.5 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 hover:border-blue-400 dark:hover:border-cyan-500'
                  }`}
                >
                  <div className="w-10 h-10 mx-auto rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-cyan-400 shadow-2xs">
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {isProcessing
                        ? 'Optimizing image...'
                        : 'Click to choose an image, drag & drop, or press Ctrl+V'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      PNG, JPG, WebP, GIF, or SVG · Automatically resized for fast loading
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 space-y-2.5">
                  <div className="rounded-lg overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center max-h-52">
                    <img
                      src={uploadedPreview.dataUrl}
                      alt={caption || uploadedPreview.suggestedAlt}
                      className="max-h-52 w-auto object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Ready
                        {uploadedPreview.width > 0
                          ? ` · ${uploadedPreview.width}×${uploadedPreview.height}`
                          : ''}
                        {' · '}
                        <span className="tabular-nums">
                          {formatByteSize(uploadedPreview.byteSize)}
                        </span>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline whitespace-nowrap"
                    >
                      Replace image
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Image URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setImageUrl(val);
                    setErrorMsg(null);
                    setUrlPreviewStatus(isSafeMarkdownImageUrl(val) ? 'loading' : 'idle');
                  }}
                  placeholder="https://example.com/topology-diagram.png"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {trimmedUrl && !isUrlValid && (
                  <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                    Enter a valid <code className="font-mono">https://</code>,{' '}
                    <code className="font-mono">http://</code>, or <code className="font-mono">/</code>{' '}
                    image path.
                  </p>
                )}
              </div>

              {isUrlValid && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 space-y-2">
                  <div className="rounded-lg overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center min-h-[120px] max-h-48">
                    {urlPreviewStatus === 'error' ? (
                      <div className="p-4 text-center space-y-1 text-xs text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-5 h-5 mx-auto" />
                        <p className="font-semibold">Preview could not be loaded from this URL</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Check that the URL points directly to an image and is publicly accessible.
                        </p>
                      </div>
                    ) : (
                      <img
                        src={trimmedUrl}
                        alt={caption || 'URL preview'}
                        referrerPolicy="no-referrer"
                        onLoad={() => setUrlPreviewStatus('loaded')}
                        onError={() => setUrlPreviewStatus('error')}
                        className="max-h-48 w-auto object-contain"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Image Placement */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Image Position
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {PLACEMENT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = placement === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPlacement(option.id)}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {activePlacementOption.hint}
            </p>
          </div>

          {/* Optional Caption / Alt Text */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Caption / Alt Text <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g., Figure 1.1: Campus VLAN & Trunking Topology"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleConfirmInsert}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:pointer-events-none text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span>Insert Image</span>
          </button>
        </div>
      </div>
    </div>
  );
};
