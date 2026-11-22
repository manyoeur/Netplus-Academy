import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  ImageOff,
  Maximize2,
  PanelLeft,
  PanelRight,
  RotateCcw
} from 'lucide-react';
import {
  clampImageDimensions,
  isSafeMarkdownImageUrl,
  MarkdownImageAlign,
  parseMarkdownImageModifiers
} from './MarkdownImageModal';

export interface ResizableMarkdownImageProps {
  src: string;
  rawAlt: string;
  inline?: boolean;
  editable?: boolean;
  imageIndex?: number;
  onResize?: (imageIndex: number, width: number, height: number) => void;
  onResetSize?: (imageIndex: number) => void;
  onChangeAlign?: (imageIndex: number, align: MarkdownImageAlign) => void;
}

type ResizeHandleKind = 'right' | 'bottom' | 'corner';

export const ResizableMarkdownImage: React.FC<ResizableMarkdownImageProps> = ({
  src,
  rawAlt,
  inline = false,
  editable = false,
  imageIndex,
  onResize,
  onResetSize,
  onChangeAlign
}) => {
  const [hasError, setHasError] = useState(false);
  const [dragDims, setDragDims] = useState<{ width: number; height: number } | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandleKind | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const latestDragDimsRef = useRef<{ width: number; height: number } | null>(null);

  const { alt, align, width, height } = parseMarkdownImageModifiers(rawAlt);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  useEffect(() => {
    latestDragDimsRef.current = dragDims;
  }, [dragDims]);

  const activeWidth = dragDims?.width ?? width;
  const activeHeight = dragDims?.height ?? height;
  const hasCustomSize = typeof activeWidth === 'number' && typeof activeHeight === 'number';

  const startResize = (
    e: React.PointerEvent<HTMLElement>,
    handle: ResizeHandleKind
  ) => {
    if (!editable || typeof imageIndex !== 'number' || !frameRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = frameRef.current.getBoundingClientRect();
    const startW = Math.max(80, Math.round(rect.width));
    const startH = Math.max(60, Math.round(rect.height));
    const startX = e.clientX;
    const startY = e.clientY;
    const aspectRatio = startW / Math.max(1, startH);

    // Measure parent prose container width so image never drags wider than its editor container
    const proseHost = frameRef.current.closest('figure')?.parentElement ?? frameRef.current.parentElement;
    const hostRect = proseHost?.getBoundingClientRect();
    const maxAllowedWidth = hostRect
      ? Math.max(160, Math.min(1200, Math.round(hostRect.width - 16)))
      : 1000;

    setActiveHandle(handle);
    const initialDims = clampImageDimensions(startW, startH);
    latestDragDimsRef.current = initialDims;
    setDragDims(initialDims);

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvt: PointerEvent) => {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;

      let rawNextW = startW;
      let rawNextH = startH;

      if (handle === 'right') {
        rawNextW = Math.min(maxAllowedWidth, startW + dx);
        rawNextH = startH;
      } else if (handle === 'bottom') {
        rawNextW = startW;
        rawNextH = startH + dy;
      } else {
        rawNextW = Math.min(maxAllowedWidth, startW + dx);
        rawNextH = moveEvt.shiftKey
          ? rawNextW / aspectRatio
          : startH + dy;
      }

      const clamped = clampImageDimensions(rawNextW, rawNextH);
      latestDragDimsRef.current = clamped;
      setDragDims(clamped);
    };

    const finishDrag = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      document.body.style.userSelect = prevUserSelect;
      const finalDims = latestDragDimsRef.current;
      setActiveHandle(null);
      setDragDims(null);
      latestDragDimsRef.current = null;
      if (finalDims && typeof imageIndex === 'number') {
        onResize?.(imageIndex, finalDims.width, finalDims.height);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
  };

  if (!isSafeMarkdownImageUrl(src) || hasError) {
    return (
      <span
        className={`my-2 flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400 ${
          align === 'left'
            ? 'sm:float-left sm:mr-6 sm:mb-3 w-full sm:w-[42%] sm:max-w-[340px]'
            : align === 'right'
            ? 'sm:float-right sm:ml-6 sm:mb-3 w-full sm:w-[42%] sm:max-w-[340px]'
            : 'clear-both'
        }`}
      >
        <ImageOff className="w-4 h-4 shrink-0 text-slate-400" />
        <span className="truncate">{alt || 'Image unavailable'}</span>
      </span>
    );
  }

  // Inline image inside paragraph/list
  if (inline) {
    const inlineFrameStyle: React.CSSProperties | undefined = hasCustomSize
      ? {
          width: `${activeWidth}px`,
          maxWidth: '100%',
          aspectRatio: `${activeWidth} / ${activeHeight}`
        }
      : undefined;

    if (!editable) {
      return (
        <img
          src={src}
          alt={alt || 'Course illustration'}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          style={inlineFrameStyle}
          className={`inline-block max-w-full rounded-lg border border-slate-200 dark:border-slate-700 align-middle my-1 ${
            hasCustomSize ? 'object-contain' : 'max-h-64 w-auto'
          }`}
        />
      );
    }

    return (
      <span
        ref={frameRef}
        style={inlineFrameStyle}
        className={`group/img relative inline-block align-middle my-1 rounded-lg border transition-shadow ${
          activeHandle
            ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg'
            : 'border-slate-200 dark:border-slate-700 hover:ring-2 hover:ring-blue-500/60'
        }`}
      >
        <img
          src={src}
          alt={alt || 'Course illustration'}
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setHasError(true)}
          className={`block rounded-lg ${
            hasCustomSize ? 'w-full h-full object-contain' : 'max-h-64 w-auto max-w-full'
          }`}
        />

        {hasCustomSize && (
          <span
            className={`pointer-events-none absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-950/80 text-white font-mono text-[10px] tabular-nums transition-opacity ${
              activeHandle ? 'opacity-100' : 'opacity-0 group-hover/img:opacity-100'
            }`}
          >
            {activeWidth} × {activeHeight}
          </span>
        )}

        {/* Right Width Handle */}
        <button
          type="button"
          onPointerDown={(e) => startResize(e, 'right')}
          title="Drag horizontally to resize width"
          aria-label="Resize image width"
          className={`touch-none absolute right-0.5 top-1/2 -translate-y-1/2 w-2 h-6 rounded-full bg-blue-600/90 hover:bg-blue-500 border border-white dark:border-slate-900 shadow cursor-ew-resize transition-opacity ${
            activeHandle === 'right'
              ? 'opacity-100'
              : 'opacity-65 group-hover/img:opacity-100'
          }`}
        />

        {/* Bottom Height Handle */}
        <button
          type="button"
          onPointerDown={(e) => startResize(e, 'bottom')}
          title="Drag vertically to resize height"
          aria-label="Resize image height"
          className={`touch-none absolute bottom-0.5 left-1/2 -translate-x-1/2 h-2 w-6 rounded-full bg-blue-600/90 hover:bg-blue-500 border border-white dark:border-slate-900 shadow cursor-ns-resize transition-opacity ${
            activeHandle === 'bottom'
              ? 'opacity-100'
              : 'opacity-65 group-hover/img:opacity-100'
          }`}
        />

        {/* Bottom-Right Corner Width & Height Handle */}
        <button
          type="button"
          onPointerDown={(e) => startResize(e, 'corner')}
          title="Drag corner to resize width and height (hold Shift to lock aspect ratio)"
          aria-label="Resize image width and height"
          className={`touch-none absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-md bg-blue-600 hover:bg-blue-500 text-white border-2 border-white dark:border-slate-900 shadow cursor-nwse-resize flex items-center justify-center transition-transform ${
            activeHandle === 'corner' ? 'scale-110' : 'group-hover/img:scale-105'
          }`}
        >
          <Maximize2 className="w-2 h-2 rotate-90" />
        </button>
      </span>
    );
  }

  // Block / Floated figure image
  const figurePlacementClass =
    align === 'left'
      ? `my-2 sm:my-1 sm:float-left sm:mr-6 sm:mb-3 max-w-full ${
          hasCustomSize ? 'w-fit' : 'w-full sm:w-[42%] sm:max-w-[340px]'
        }`
      : align === 'right'
      ? `my-2 sm:my-1 sm:float-right sm:ml-6 sm:mb-3 max-w-full ${
          hasCustomSize ? 'w-fit' : 'w-full sm:w-[42%] sm:max-w-[340px]'
        }`
      : `clear-both my-4 ${hasCustomSize ? 'w-fit max-w-full mx-auto' : ''}`;

  const frameStyle: React.CSSProperties | undefined = hasCustomSize
    ? {
        width: `${activeWidth}px`,
        maxWidth: '100%',
        aspectRatio: `${activeWidth} / ${activeHeight}`
      }
    : undefined;

  return (
    <figure
      className={`${figurePlacementClass} group/img relative rounded-xl border bg-slate-50/70 dark:bg-slate-950/50 overflow-visible transition-shadow ${
        editable
          ? activeHandle
            ? 'border-blue-500 ring-2 ring-blue-500 shadow-lg'
            : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-cyan-500'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div
        className={`flex items-center justify-center p-2 sm:p-3 bg-white/70 dark:bg-slate-900/40 ${
          alt ? 'rounded-t-xl' : 'rounded-xl'
        }`}
      >
        <div
          ref={frameRef}
          style={frameStyle}
          className={`relative flex items-center justify-center rounded-lg ${
            hasCustomSize ? 'overflow-visible' : 'max-w-full'
          } ${
            editable && activeHandle
              ? 'ring-2 ring-blue-500/70'
              : editable
              ? 'group-hover/img:ring-1 group-hover/img:ring-blue-500/40'
              : ''
          }`}
        >
          <img
            src={src}
            alt={alt || 'Course illustration'}
            loading="lazy"
            referrerPolicy="no-referrer"
            draggable={!editable}
            onError={() => setHasError(true)}
            className={`rounded-lg ${
              hasCustomSize
                ? 'w-full h-full object-contain'
                : align === 'block'
                ? 'max-h-[460px] w-auto max-w-full object-contain'
                : 'max-h-[320px] w-full max-w-full object-contain'
            }`}
          />

          {/* Editor Interactive Handles & Quick Controls */}
          {editable && (
            <>
              {/* Live Dimension Readout */}
              <div
                className={`pointer-events-none absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/80 text-white font-mono text-[10px] tabular-nums shadow-sm transition-opacity ${
                  activeHandle ? 'opacity-100' : 'opacity-0 group-hover/img:opacity-100'
                }`}
              >
                {hasCustomSize ? `${activeWidth} × ${activeHeight} px` : 'Drag handles to resize'}
              </div>

              {/* Quick Placement & Reset Controls */}
              {typeof imageIndex === 'number' && (
                <div
                  className={`absolute top-2 right-2 flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-950/80 border border-slate-700/80 shadow-md transition-opacity ${
                    activeHandle
                      ? 'opacity-0 pointer-events-none'
                      : 'opacity-0 group-hover/img:opacity-100 focus-within:opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onChangeAlign?.(imageIndex, 'left')}
                    title="Place left of text"
                    aria-label="Place left of text"
                    className={`p-1 rounded transition-colors ${
                      align === 'left'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <PanelLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeAlign?.(imageIndex, 'block')}
                    title="Center block (above/below text)"
                    aria-label="Center block"
                    className={`p-1 rounded transition-colors ${
                      align === 'block'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <AlignCenter className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeAlign?.(imageIndex, 'right')}
                    title="Place right of text"
                    aria-label="Place right of text"
                    className={`p-1 rounded transition-colors ${
                      align === 'right'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <PanelRight className="w-3 h-3" />
                  </button>
                  {typeof width === 'number' && typeof height === 'number' && (
                    <button
                      type="button"
                      onClick={() => onResetSize?.(imageIndex)}
                      title="Reset image to auto size"
                      aria-label="Reset image size"
                      className="p-1 rounded text-amber-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Right-Edge Width Drag Handle */}
              <button
                type="button"
                onPointerDown={(e) => startResize(e, 'right')}
                title="Drag horizontally to adjust width"
                aria-label="Drag to resize image width"
                className={`touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-9 rounded-full bg-blue-600 hover:bg-blue-500 border-2 border-white dark:border-slate-900 shadow-md cursor-ew-resize transition-opacity ${
                  activeHandle === 'right'
                    ? 'opacity-100 scale-110'
                    : 'opacity-75 group-hover/img:opacity-100'
                }`}
              />

              {/* Bottom-Edge Height Drag Handle */}
              <button
                type="button"
                onPointerDown={(e) => startResize(e, 'bottom')}
                title="Drag vertically to adjust height"
                aria-label="Drag to resize image height"
                className={`touch-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-2.5 w-9 rounded-full bg-blue-600 hover:bg-blue-500 border-2 border-white dark:border-slate-900 shadow-md cursor-ns-resize transition-opacity ${
                  activeHandle === 'bottom'
                    ? 'opacity-100 scale-110'
                    : 'opacity-75 group-hover/img:opacity-100'
                }`}
              />

              {/* Bottom-Right Corner Width & Height Drag Handle */}
              <button
                type="button"
                onPointerDown={(e) => startResize(e, 'corner')}
                title="Drag corner to adjust width and height (hold Shift to lock aspect ratio)"
                aria-label="Drag corner to resize image width and height"
                className={`touch-none absolute -bottom-2 -right-2 w-5 h-5 rounded-md bg-blue-600 hover:bg-blue-500 text-white border-2 border-white dark:border-slate-900 shadow-md cursor-nwse-resize flex items-center justify-center transition-all ${
                  activeHandle === 'corner'
                    ? 'opacity-100 scale-110'
                    : 'opacity-90 group-hover/img:opacity-100 group-hover/img:scale-105'
                }`}
              >
                <Maximize2 className="w-2.5 h-2.5 rotate-90" />
              </button>
            </>
          )}
        </div>
      </div>

      {alt && (
        <figcaption className="px-3.5 py-2 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 text-center rounded-b-xl">
          {alt}
        </figcaption>
      )}
    </figure>
  );
};
