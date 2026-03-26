export interface FileNode {
  id: string;
  name: string;
  /** Absolute path within the project, e.g. "/chapters/intro.tex" */
  path: string;
  type: "file";
  source: string;
  updatedAt?: number;
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  type: "folder";
}

export type TreeNode = FileNode | FolderNode;

/** Kept for backward compat during migration */
export interface TabData {
  id: string;
  name: string;
  source: string;
  updatedAt?: number;
  path?: string;
}

export interface ProjectData {
  id: string;
  name: string;
  files: TreeNode[];
  /** ID of the file that gets compiled */
  mainFileId: string;
  updatedAt: number;
}

const STORAGE_KEY = "morph-latex-tabs";
const PROJECTS_STORAGE_KEY = "morph-latex-projects";
const ACTIVE_PROJECT_KEY = "morph-latex-active-project";
const ACTIVE_TAB_KEY = "morph-latex-active-tab";

// --- Legacy tab functions (kept for migration) ---

export function loadTabs(): TabData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

export function saveTabs(tabs: TabData[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
}

// --- Project functions ---

export function loadProjects(): ProjectData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Deduplicate: if any IDs collide, regenerate them
        const seenIds = new Set<string>();
        let hasDupes = false;
        for (const p of parsed) {
          if (seenIds.has(p.id)) { hasDupes = true; break; }
          seenIds.add(p.id);
          for (const f of p.files ?? []) {
            if (seenIds.has(f.id)) { hasDupes = true; break; }
            seenIds.add(f.id);
          }
          if (hasDupes) break;
        }
        if (hasDupes) {
          // Re-key everything with fresh UUIDs
          const fixed = (parsed as ProjectData[]).map((p) => {
            const newFiles = p.files.map((f) => ({ ...f, id: newId() }));
            const mainIdx = p.files.findIndex((f) => f.id === p.mainFileId);
            return {
              ...p,
              id: newProjectId(),
              files: newFiles,
              mainFileId: mainIdx >= 0 ? newFiles[mainIdx].id : newFiles[0]?.id ?? "",
            };
          });
          saveProjects(fixed);
          return fixed;
        }
        return parsed;
      }
    }
  } catch {}
  return [];
}

export function saveProjects(projects: ProjectData[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

/**
 * Migrate old flat tabs to project format. Idempotent — if projects
 * already exist, returns them. Each old tab becomes its own project.
 */
export function migrateToProjects(): ProjectData[] {
  const existing = loadProjects();
  if (existing.length > 0) return existing;

  const oldTabs = loadTabs();
  if (oldTabs.length === 0) return [];

  const projects: ProjectData[] = oldTabs.map((tab) => {
    const fileId = newId();
    return {
      id: newProjectId(),
      name: tab.name.replace(/\.tex$/, ""),
      files: [
        {
          id: fileId,
          name: tab.name,
          path: "/" + tab.name,
          type: "file" as const,
          source: tab.source,
          updatedAt: tab.updatedAt ?? Date.now(),
        },
      ],
      mainFileId: fileId,
      updatedAt: tab.updatedAt ?? Date.now(),
    };
  });

  saveProjects(projects);
  return projects;
}

// --- Active state ---

export function loadActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export function saveActiveProjectId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_PROJECT_KEY, id);
}

export function loadActiveTabId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_TAB_KEY);
}

export function saveActiveTabId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_TAB_KEY, id);
}

// --- ID generators ---

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newId(): string {
  return `tab-${uuid()}`;
}

export function newProjectId(): string {
  return `proj-${uuid()}`;
}

// --- Tree helpers ---

/** Get all files (not folders) from the tree */
export function getFiles(nodes: TreeNode[]): FileNode[] {
  return nodes.filter((n): n is FileNode => n.type === "file");
}

/** Get all folders from the tree */
export function getFolders(nodes: TreeNode[]): FolderNode[] {
  return nodes.filter((n): n is FolderNode => n.type === "folder");
}

/** Get children of a given folder path */
export function getChildren(nodes: TreeNode[], folderPath: string): TreeNode[] {
  const prefix = folderPath === "/" ? "/" : folderPath + "/";
  return nodes.filter((n) => {
    if (n.path === folderPath) return false;
    const parent = n.path.substring(0, n.path.lastIndexOf("/")) || "/";
    return parent === (folderPath === "/" ? "" : folderPath) || (folderPath === "/" && parent === "");
  });
}

/** Build a nested tree structure for rendering */
export interface TreeItem {
  node: TreeNode;
  children: TreeItem[];
}

export function buildTree(nodes: TreeNode[]): TreeItem[] {
  // Get parent path for a node
  const parentPath = (path: string): string => {
    const idx = path.lastIndexOf("/");
    if (idx <= 0) return "/";
    return path.substring(0, idx);
  };

  // Sort: folders first, then alphabetically
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const itemMap = new Map<string, TreeItem>();
  const roots: TreeItem[] = [];

  // Create TreeItems for all nodes
  for (const node of sorted) {
    itemMap.set(node.path, { node, children: [] });
  }

  // Build hierarchy
  for (const node of sorted) {
    const item = itemMap.get(node.path)!;
    const parent = parentPath(node.path);
    const parentItem = itemMap.get(parent);
    if (parentItem) {
      parentItem.children.push(item);
    } else {
      roots.push(item);
    }
  }

  return roots;
}
