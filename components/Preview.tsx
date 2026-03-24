"use client";

import { useRef, useCallback, useState } from "react";
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });

interface PreviewProps {
  source: string;
  onCompile: (source: string) => void;
  compiling: boolean;
  pdfUrl: string | null;
  compileError: string | null;
  onDownloadPdf: () => void;
}

export default function Preview({
  source,
  onCompile: _onCompile,
  compiling,
  pdfUrl,
  compileError,
  onDownloadPdf: _onDownloadPdf,
}: PreviewProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Panel label only — Build / Download live in the top bar */}
      <div className="flex shrink-0 items-center border-b border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Preview</span>
      </div>

      {/* Content */}
      <div className="relative flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
        {pdfUrl && (
          <div className="absolute inset-0 z-10 bg-white dark:bg-zinc-900">
            <PdfViewer url={pdfUrl} />
          </div>
        )}

        {!pdfUrl && !compileError && !compiling && (
          <div className="absolute inset-0 z-0 flex flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Use <strong className="font-medium text-zinc-700 dark:text-zinc-300">Build</strong> in the toolbar to generate the PDF.
            </p>
          </div>
        )}

        {compileError && !compiling && (
          <div className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-white p-4 dark:bg-zinc-900">
            <span className="mb-2 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              Compilation error
            </span>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-red-600 dark:text-red-400">
              {compileError}
            </pre>
          </div>
        )}

        {compiling && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm dark:bg-zinc-900/95">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 dark:border-zinc-600 dark:border-t-blue-500" />
            <span className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Building…</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Resizable panel wrapper.
 * Blocks pointer events over content during drag to prevent stealing.
 */
export function ResizablePreview({
  children,
  defaultWidth,
  minWidth,
}: {
  children: React.ReactNode;
  defaultWidth: number;
  minWidth: number;
  maxWidth?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(defaultWidth);
  const [dragging, setDragging] = useState(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = widthRef.current;
      setDragging(true);

      const onMouseMove = (ev: MouseEvent) => {
        const parentWidth =
          panelRef.current?.parentElement?.clientWidth ?? window.innerWidth;
        const effectiveMax = Math.floor(parentWidth * 0.7);

        const delta = startX - ev.clientX;
        const newWidth = Math.min(
          effectiveMax,
          Math.max(minWidth, startWidth + delta)
        );
        widthRef.current = newWidth;
        if (panelRef.current) {
          panelRef.current.style.flexBasis = `${newWidth}px`;
        }
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setDragging(false);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [minWidth]
  );

  return (
    <div
      ref={panelRef}
      className="relative shrink-0 overflow-hidden bg-white dark:bg-zinc-900"
      style={{ flexBasis: defaultWidth, maxWidth: "70%" }}
    >
      <div
        onMouseDown={onMouseDown}
        className="absolute left-0 top-0 z-40 h-full w-2 cursor-col-resize transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
      />
      {dragging && <div className="absolute inset-0 z-30" />}
      {children}
    </div>
  );
}
