"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfViewerProps {
  url: string;
}

export default function PdfViewer({ url }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderingRef = useRef(false);

  const renderAllPages = useCallback(async () => {
    const container = containerRef.current;
    const pdfDoc = pdfDocRef.current;
    if (!container || !pdfDoc || renderingRef.current) return;

    renderingRef.current = true;
    const containerWidth = container.clientWidth;
    const canvases: HTMLCanvasElement[] = [];

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const unscaledViewport = page.getViewport({ scale: 1 });

      // Scale to fit container width with some padding
      const padding = 48;
      const scale = (containerWidth - padding) / unscaledViewport.width;
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * dpr });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      const ctx = canvas.getContext("2d")!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx, viewport } as any).promise;
      canvases.push(canvas);
    }

    renderingRef.current = false;
    setPages(canvases);
  }, []);

  // Load PDF when URL changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const doc = await pdfjsLib.getDocument(url).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        pdfDocRef.current = doc;
        await renderAllPages();
      } catch (err) {
        console.error("PDF load error:", err);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [url, renderAllPages]);

  // Re-render on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (pdfDocRef.current) {
        renderAllPages();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [renderAllPages]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-auto overflow-x-hidden bg-zinc-200 dark:bg-zinc-900"
    >
      <div className="flex flex-col items-center gap-2 py-3">
        {pages.map((canvas, i) => (
          <PageCanvas key={`${url}-${i}`} canvas={canvas} />
        ))}
      </div>
    </div>
  );
}

function PageCanvas({ canvas }: { canvas: HTMLCanvasElement }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.innerHTML = "";
    wrapper.appendChild(canvas);
  }, [canvas]);

  return (
    <div
      ref={wrapperRef}
      className="shadow-lg"
      style={{ lineHeight: 0 }}
    />
  );
}
