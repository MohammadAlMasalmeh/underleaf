"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Preview, { ResizablePreview } from "@/components/Preview";
import AIChatPanel from "@/components/AIChatPanel";
import FileTree from "@/components/FileTree";
import { useTheme } from "@/components/ThemeProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { useAuth } from "@/components/AuthProvider";
import {
  ProjectData,
  FileNode,
  TreeNode,
  getFiles,
  loadActiveProjectId,
  saveActiveProjectId,
  loadActiveTabId,
  saveActiveTabId,
  newId,
  newProjectId,
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

function createDefaultFile(): FileNode {
  return {
    id: newId(),
    name: "main.tex",
    path: "/main.tex",
    type: "file",
    source: DEFAULT_LATEX,
    updatedAt: Date.now(),
  };
}

function createDefaultProject(): ProjectData {
  const main = createDefaultFile();
  return {
    id: newProjectId(),
    name: "Untitled",
    files: [main],
    mainFileId: main.id,
    updatedAt: Date.now(),
  };
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
  const { theme, toggleTheme } = useTheme();
  const { projects, setProjects, persistProjects, isReady, isCloud } = useProjects();
  const { user } = useAuth();
  const projectsRef = useRef(projects);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [activeFileId, setActiveFileId] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  projectsRef.current = projects;

  // Derive current project state
  const currentProject = projects.find((p) => p.id === activeProjectId);
  const treeNodes = currentProject?.files ?? [];
  const allFiles = getFiles(treeNodes);
  const activeFile = allFiles.find((f) => f.id === activeFileId);
  const source = activeFile?.source ?? "";
  const mainFileId = currentProject?.mainFileId ?? "";

  // --- Initialization ---
  useEffect(() => {
    if (!isReady) return;
    const projectParam = searchParams.get("project");
    const tabParam = searchParams.get("tab");
    const wantNew = searchParams.get("new") === "1";
    let allProjects = projectsRef.current;

    if (wantNew) {
      const newProj = createDefaultProject();
      allProjects = [...allProjects, newProj];
      setProjects(allProjects);
      persistProjects(allProjects);
      setActiveProjectId(newProj.id);
      setActiveFileId(newProj.files[0].id);
      setInitialized(true);
      saveActiveProjectId(newProj.id);
      saveActiveTabId(newProj.files[0].id);
      window.history.replaceState(null, "", `/edit?project=${newProj.id}&tab=${newProj.files[0].id}`);
      return;
    }

    // Find the right project
    let projId = "";
    let fileId = "";

    if (projectParam && allProjects.some((p) => p.id === projectParam)) {
      projId = projectParam;
    } else if (tabParam) {
      // Backward compat: find project containing this file
      const found = allProjects.find((p) =>
        getFiles(p.files).some((f) => f.id === tabParam)
      );
      if (found) {
        projId = found.id;
        fileId = tabParam;
      }
    }

    if (!projId) {
      const savedProjId = loadActiveProjectId();
      if (savedProjId && allProjects.some((p) => p.id === savedProjId)) {
        projId = savedProjId;
      } else if (allProjects.length > 0) {
        projId = allProjects[0].id;
      }
    }

    if (!projId || allProjects.length === 0) {
      const newProj = createDefaultProject();
      allProjects = [newProj];
      setProjects(allProjects);
      persistProjects(allProjects);
      projId = newProj.id;
      fileId = newProj.files[0].id;
    }

    const proj = allProjects.find((p) => p.id === projId)!;
    const projFiles = getFiles(proj.files);

    if (!fileId) {
      if (tabParam && projFiles.some((f) => f.id === tabParam)) {
        fileId = tabParam;
      } else {
        const savedTabId = loadActiveTabId();
        if (savedTabId && projFiles.some((f) => f.id === savedTabId)) {
          fileId = savedTabId;
        } else {
          fileId = projFiles[0]?.id ?? "";
        }
      }
    }

    setActiveProjectId(projId);
    setActiveFileId(fileId);
    setInitialized(true);
    window.history.replaceState(null, "", `/edit?project=${projId}&tab=${fileId}`);
  }, [searchParams, isReady, setProjects, persistProjects]);

  // Persist on change
  useEffect(() => {
    if (!initialized) return;
    persistProjects(projects);
  }, [projects, initialized, persistProjects]);

  useEffect(() => {
    if (!initialized || !activeProjectId) return;
    saveActiveProjectId(activeProjectId);
  }, [activeProjectId, initialized]);

  useEffect(() => {
    if (!initialized || !activeFileId) return;
    saveActiveTabId(activeFileId);
  }, [activeFileId, initialized]);

  // --- Project update helper ---
  const updateCurrentProject = useCallback(
    (updater: (proj: ProjectData) => ProjectData) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProjectId ? updater(p) : p))
      );
    },
    [activeProjectId, setProjects]
  );

  // --- File operations ---
  const setSource = useCallback(
    (newSource: string) => {
      updateCurrentProject((proj) => ({
        ...proj,
        updatedAt: Date.now(),
        files: proj.files.map((f) =>
          f.id === activeFileId && f.type === "file"
            ? { ...f, source: newSource, updatedAt: Date.now() }
            : f
        ),
      }));
    },
    [activeFileId, updateCurrentProject]
  );

  const handleAddFile = useCallback(
    (parentPath: string) => {
      const id = newId();
      const name = "untitled.tex";
      const path = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
      const file: FileNode = {
        id,
        name,
        path,
        type: "file",
        source: "",
        updatedAt: Date.now(),
      };
      updateCurrentProject((proj) => ({
        ...proj,
        updatedAt: Date.now(),
        files: [...proj.files, file],
      }));
      setActiveFileId(id);
      window.history.replaceState(null, "", `/edit?project=${activeProjectId}&tab=${id}`);
    },
    [activeProjectId, updateCurrentProject]
  );

  const handleAddFolder = useCallback(
    (parentPath: string) => {
      const id = newId();
      const name = "new-folder";
      const path = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
      updateCurrentProject((proj) => ({
        ...proj,
        updatedAt: Date.now(),
        files: [
          ...proj.files,
          { id, name, path, type: "folder" as const },
        ],
      }));
    },
    [updateCurrentProject]
  );

  const handleRename = useCallback(
    (id: string, newName: string) => {
      updateCurrentProject((proj) => {
        const node = proj.files.find((f) => f.id === id);
        if (!node) return proj;

        const oldPath = node.path;
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/")) || "";
        const newPath = parentPath + "/" + newName;

        // Rename the node and update paths of children if it's a folder
        const updatedFiles = proj.files.map((f) => {
          if (f.id === id) {
            return { ...f, name: newName, path: newPath };
          }
          // Update children paths if renaming a folder
          if (node.type === "folder" && f.path.startsWith(oldPath + "/")) {
            return { ...f, path: newPath + f.path.slice(oldPath.length) };
          }
          return f;
        });

        return { ...proj, updatedAt: Date.now(), files: updatedFiles };
      });
    },
    [updateCurrentProject]
  );

  const handleDelete = useCallback(
    (id: string) => {
      updateCurrentProject((proj) => {
        const node = proj.files.find((f) => f.id === id);
        if (!node) return proj;
        // Don't delete the main file
        if (node.type === "file" && node.id === proj.mainFileId) return proj;

        let updatedFiles: TreeNode[];
        if (node.type === "folder") {
          // Delete folder and all children
          updatedFiles = proj.files.filter(
            (f) => f.id !== id && !f.path.startsWith(node.path + "/")
          );
        } else {
          updatedFiles = proj.files.filter((f) => f.id !== id);
        }

        // If we deleted the active file, switch to main
        if (id === activeFileId) {
          setActiveFileId(proj.mainFileId);
        }

        return { ...proj, updatedAt: Date.now(), files: updatedFiles };
      });
    },
    [activeFileId, updateCurrentProject]
  );

  const handleSetMain = useCallback(
    (id: string) => {
      updateCurrentProject((proj) => ({
        ...proj,
        mainFileId: id,
        updatedAt: Date.now(),
      }));
    },
    [updateCurrentProject]
  );

  const handleSelectFile = useCallback(
    (id: string) => {
      setActiveFileId(id);
      window.history.replaceState(null, "", `/edit?project=${activeProjectId}&tab=${id}`);
    },
    [activeProjectId]
  );

  // --- Compile & Edit state ---
  const [compiling, setCompiling] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [preEditSource, setPreEditSource] = useState<string | null>(null);

  useEffect(() => {
    setReviewing(false);
    setPreEditSource(null);
  }, [activeFileId]);

  // Compile uses the main file, not the active file
  const mainFile = allFiles.find((f) => f.id === mainFileId);
  const compileSource = mainFile?.source ?? source;

  const handleCompile = useCallback(async (_src?: string) => {
    const src = _src ?? compileSource;
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
          } catch { /* ignore */ }
        }
        setCompileError(errorMessage);
        setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
        return;
      }
      const blob = await res.blob();
      setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCompileError(msg);
      setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    } finally {
      setCompiling(false);
    }
  }, [compileSource]);

  const handleDownloadPdf = useCallback(() => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${mainFile?.name || "document"}.pdf`;
    a.click();
  }, [pdfUrl, mainFile?.name]);

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
      chatHistory: Array<{ role: "user" | "assistant"; content: string }>,
      onStep: (step: { id: string; message: string }) => void,
      onThinking: (content: string) => void,
      onDone: (mergedCode: string) => void,
      onError: (message: string) => void
    ) => {
      const currentSource = source;
      fetch("/api/edit-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: currentSource, instruction, model, extendedThinking, chatHistory }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            onError(data.error || `Request failed (${res.status})`);
            return;
          }
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          if (!reader) { onError("No response body"); return; }
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
                if (data.type === "step") onStep({ id: data.id, message: data.message });
                if (data.type === "thinking") onThinking(data.content ?? "");
                if (data.type === "done") onDone(data.mergedCode ?? "");
                if (data.type === "error") onError(data.message ?? "Unknown error");
              } catch { /* skip */ }
            }
          }
          if (buffer) {
            const match = buffer.match(/^data: (.+)$/m);
            if (match) {
              try {
                const data = JSON.parse(match[1]);
                if (data.type === "done") onDone(data.mergedCode ?? "");
                if (data.type === "error") onError(data.message ?? "Unknown error");
              } catch { /* skip */ }
            }
          }
        })
        .catch((err: unknown) => {
          onError(err instanceof Error ? err.message : String(err));
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
          {currentProject && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {currentProject.name}
            </span>
          )}
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
            onClick={() => handleCompile()}
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
          <FileTree
            files={treeNodes}
            activeFileId={activeFileId}
            mainFileId={mainFileId}
            onSelectFile={handleSelectFile}
            onAddFile={handleAddFile}
            onAddFolder={handleAddFolder}
            onRename={handleRename}
            onDelete={handleDelete}
            onSetMain={handleSetMain}
          />
        </aside>

        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="shrink-0 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {activeFile?.name ?? "Source"}
              </span>
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
              source={compileSource}
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
            <button onClick={handleAcceptEdits} className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Accept</button>
            <button onClick={handleRejectEdits} className="rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">Reject</button>
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
