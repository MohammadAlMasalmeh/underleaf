"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Preview, { ResizablePreview } from "@/components/Preview";
import AIChatPanel from "@/components/AIChatPanel";
import { useTheme } from "@/components/ThemeProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { useAuth } from "@/components/AuthProvider";
import {
  TabData,
  loadActiveTabId,
  saveActiveTabId,
  newId,
} from "@/lib/storage";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

const DEFAULT_LATEX = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amsfonts}

\\title{Sample Document}
\\author{Author}

\\begin{document}
\\maketitle

\\section{Introduction}
Let $f: \\mathbb{R} \\to \\mathbb{R}$ be a continuous function.

\\textbf{Theorem.} For all $x \\in \\mathbb{R}$, we have
\\begin{equation}
  \\int_0^x f(t)\\, dt = F(x) - F(0)
\\end{equation}
where $F$ is an antiderivative of $f$.

\\section{Proof}
The proof follows directly from the fundamental theorem of calculus.

\\end{document}`;

function createDefaultTab(): TabData {
  return { id: newId(), name: "main.tex", source: DEFAULT_LATEX, updatedAt: Date.now() };
}

function isOldBrokenDefault(source: string): boolean {
  return (
    source.includes("\\begin{theorem}") &&
    !source.includes("\\usepackage{amsfonts}") &&
    !source.includes("\\usepackage{amsthm}")
  );
}

function migrateTabsIfNeeded(tabs: TabData[]): TabData[] {
  return tabs.map((tab) =>
    isOldBrokenDefault(tab.source)
      ? { ...tab, source: DEFAULT_LATEX }
      : tab
  );
}

const CHAT_MIN_HEIGHT = 200;
const CHAT_DEFAULT_HEIGHT = 320;
const CHAT_MAX_HEIGHT_RATIO = 0.6;

function ResizableChatPanel({
  children,
  defaultHeight,
  minHeight,
}: {
  children: React.ReactNode;
  defaultHeight: number;
  minHeight: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(defaultHeight);
  const [dragging, setDragging] = useState(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = heightRef.current;
      setDragging(true);

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY;
        const newHeight = Math.min(
          window.innerHeight * CHAT_MAX_HEIGHT_RATIO,
          Math.max(minHeight, startHeight - delta)
        );
        heightRef.current = newHeight;
        if (panelRef.current) {
          panelRef.current.style.flexBasis = `${newHeight}px`;
        }
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setDragging(false);
      };

      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [minHeight]
  );

  return (
    <div
      ref={panelRef}
      className="relative flex shrink-0 flex-col overflow-hidden border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      style={{
        flexBasis: defaultHeight,
        minHeight,
        maxHeight: `min(${CHAT_MAX_HEIGHT_RATIO * 100}vh, 70%)`,
      }}
    >
      <div
        onMouseDown={onMouseDown}
        className="absolute left-0 right-0 top-0 z-10 flex h-2 cursor-row-resize items-center justify-center transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <span className="h-0.5 w-6 rounded-full bg-zinc-300 dark:bg-zinc-600" />
      </div>
      {dragging && <div className="absolute inset-0 z-20" />}
      <div className="min-h-0 flex-1 pt-2">{children}</div>
    </div>
  );
}

export default function EditPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { tabs, setTabs, persistTabs, isReady, isCloud } = useProjects();
  const { user } = useAuth();
  const tabsRef = useRef(tabs);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  tabsRef.current = tabs;

  useEffect(() => {
    if (!isReady) return;
    const tabParam = searchParams.get("tab");
    const wantNew = searchParams.get("new") === "1";
    let loaded = migrateTabsIfNeeded(tabsRef.current);

    if (wantNew) {
      const newTab = createDefaultTab();
      loaded = loaded.length > 0 ? migrateTabsIfNeeded(loaded) : loaded;
      loaded = [...loaded, newTab];
      setTabs(loaded);
      setActiveTabId(newTab.id);
      setInitialized(true);
      persistTabs(loaded);
      saveActiveTabId(newTab.id);
      window.history.replaceState(null, "", `/edit?tab=${newTab.id}`);
      return;
    }

    if (loaded.length === 0) {
      loaded = [createDefaultTab()];
      setTabs(loaded);
      persistTabs(loaded);
    } else {
      setTabs(loaded);
    }

    const savedActive = loadActiveTabId();
    let activeId: string;
    if (tabParam && loaded.some((t) => t.id === tabParam)) {
      activeId = tabParam;
    } else if (savedActive && loaded.find((t) => t.id === savedActive)) {
      activeId = savedActive;
    } else {
      activeId = loaded[0].id;
    }

    setActiveTabId(activeId);
    setInitialized(true);
  }, [searchParams, isReady, setTabs, persistTabs]);

  useEffect(() => {
    if (!initialized) return;
    persistTabs(tabs);
  }, [tabs, initialized, persistTabs]);

  useEffect(() => {
    if (!initialized || !activeTabId) return;
    saveActiveTabId(activeTabId);
  }, [activeTabId, initialized]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const source = activeTab?.source ?? "";

  const setSource = useCallback(
    (newSource: string) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, source: newSource, updatedAt: Date.now() } : t
        )
      );
    },
    [activeTabId]
  );

  const addTab = useCallback(() => {
    const tab = createDefaultTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    setReviewing(false);
    setPdfUrl(null);
    setCompileError(null);
    window.history.replaceState(null, "", `/edit?tab=${tab.id}`);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          const nextId = next[0].id;
          setActiveTabId(nextId);
          window.history.replaceState(null, "", `/edit?tab=${nextId}`);
        }
        return next;
      });
    },
    [activeTabId]
  );

  const renameTab = useCallback((id: string, name: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name, updatedAt: Date.now() } : t)));
  }, []);

  const [compiling, setCompiling] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [preEditSource, setPreEditSource] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setReviewing(false);
    setPreEditSource(null);
  }, [activeTabId]);

  const handleCompile = useCallback(async (src: string) => {
    setCompiling(true);
    setCompileError(null);
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: src }),
      });
      if (!res.ok) {
        let errorMessage = `Compilation failed (${res.status})`;
        try {
          const data = await res.json();
          if (data && typeof data.error === "string") errorMessage = data.error;
        } catch {
          try {
            errorMessage = await res.text();
            if (!errorMessage) errorMessage = `Compilation failed (${res.status})`;
          } catch {
            // ignore
          }
        }
        setCompileError(errorMessage);
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        return;
      }
      const blob = await res.blob();
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCompileError(msg);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setCompiling(false);
    }
  }, []);

  const handleDownloadPdf = useCallback(() => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${activeTab?.name || "document"}.pdf`;
    a.click();
  }, [pdfUrl, activeTab?.name]);

  const handleAcceptEdits = useCallback(() => {
    setReviewing(false);
    setPreEditSource(null);
  }, []);

  const handleRejectEdits = useCallback(() => {
    if (preEditSource !== null) setSource(preEditSource);
    setReviewing(false);
    setPreEditSource(null);
  }, [preEditSource, setSource]);

  const handleEditReady = useCallback(
    (mergedCode: string) => {
      setPreEditSource(source);
      setSource(mergedCode);
      setReviewing(true);
    },
    [source, setSource]
  );

  const handleStreamEdit = useCallback(
    (
      instruction: string,
      model: string,
      extendedThinking: boolean,
      onStep: (step: { id: string; message: string }) => void,
      onThinking: (content: string) => void,
      onDone: (mergedCode: string) => void,
      onError: (message: string) => void
    ) => {
      const currentSource = source;
      fetch("/api/edit-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: currentSource, instruction, model, extendedThinking }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            onError(data.error || `Request failed (${res.status})`);
            return;
          }
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          if (!reader) {
            onError("No response body");
            return;
          }
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() ?? "";
            for (const chunk of lines) {
              const match = chunk.match(/^data: (.+)$/m);
              if (!match) continue;
              try {
                const data = JSON.parse(match[1]);
                if (data.type === "step")
                  onStep({ id: data.id, message: data.message });
                if (data.type === "thinking")
                  onThinking(data.content ?? "");
                if (data.type === "done") onDone(data.mergedCode ?? "");
                if (data.type === "error")
                  onError(data.message ?? "Unknown error");
              } catch {
                // skip
              }
            }
          }
          if (buffer) {
            const match = buffer.match(/^data: (.+)$/m);
            if (match) {
              try {
                const data = JSON.parse(match[1]);
                if (data.type === "done") onDone(data.mergedCode ?? "");
                if (data.type === "error")
                  onError(data.message ?? "Unknown error");
              } catch {
                // skip
              }
            }
          }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          onError(msg);
        });
    },
    [source]
  );

  if (!isReady || !initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
          >
            UnderLeaf
          </Link>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">LaTeX</span>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Saved to account</span>
          )}
          {!user && (
            <Link
              href="/"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Sign in to save
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => handleCompile(source)}
            disabled={compiling}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {compiling ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Building…
              </>
            ) : (
              "Build"
            )}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={!pdfUrl}
            className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Download
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-52 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex items-center justify-between border-b border-zinc-200 px-2.5 py-2 dark:border-zinc-800">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Files
            </span>
            <button
              onClick={addTab}
              className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
              title="New file"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v10M3 8h10" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`group flex cursor-pointer items-center gap-2 px-2.5 py-1.5 rounded-md ${
                  tab.id === activeTabId
                    ? "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                    : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                }`}
                onClick={() => {
                  setActiveTabId(tab.id);
                  router.replace(`/edit?tab=${tab.id}`);
                }}
                onDoubleClick={() => {
                  setEditingTabId(tab.id);
                  setTimeout(() => renameInputRef.current?.focus(), 0);
                }}
              >
                <svg
                  className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
                {editingTabId === tab.id ? (
                  <input
                    ref={renameInputRef}
                    className="min-w-0 flex-1 border-b border-blue-500 bg-transparent text-sm outline-none dark:border-blue-400"
                    defaultValue={tab.name}
                    onBlur={(e) => {
                      renameTab(tab.id, e.target.value || "main.tex");
                      setEditingTabId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renameTab(tab.id, e.currentTarget.value || "main.tex");
                        setEditingTabId(null);
                      }
                      if (e.key === "Escape") setEditingTabId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="min-w-0 truncate text-sm">
                    {tab.name}
                  </span>
                )}
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="ml-auto rounded p-0.5 text-zinc-400 opacity-0 transition-all hover:text-red-600 hover:opacity-100 group-hover:opacity-100 dark:text-zinc-500"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3l6 6M9 3l-6 6" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="shrink-0 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Source</span>
            </div>
            <div className="min-h-0 flex-1">
              <Editor
                value={source}
                onChange={setSource}
                reviewing={reviewing}
                originalValue={preEditSource ?? undefined}
                dark={theme === "dark"}
              />
            </div>
          </div>
          <ResizablePreview defaultWidth={480} minWidth={280}>
            <Preview
              source={source}
              onCompile={handleCompile}
              compiling={compiling}
              pdfUrl={pdfUrl}
              compileError={compileError}
              onDownloadPdf={handleDownloadPdf}
            />
          </ResizablePreview>
        </div>
      </div>

      {reviewing && (
        <div className="flex shrink-0 items-center justify-between border-t border-blue-200 bg-blue-50/50 px-4 py-2 dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="flex items-center gap-3 text-sm text-blue-800 dark:text-blue-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600 dark:bg-blue-400" />
            <span>Red = removed · Blue = added</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAcceptEdits}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Accept
            </button>
            <button
              onClick={handleRejectEdits}
              className="rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      <ResizableChatPanel defaultHeight={CHAT_DEFAULT_HEIGHT} minHeight={CHAT_MIN_HEIGHT}>
        <AIChatPanel
          onStreamEdit={handleStreamEdit}
          onEditReady={handleEditReady}
          onAcceptEdits={handleAcceptEdits}
          onRejectEdits={handleRejectEdits}
          reviewing={reviewing}
        />
      </ResizableChatPanel>
    </div>
  );
}
