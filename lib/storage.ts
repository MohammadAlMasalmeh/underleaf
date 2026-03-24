export interface TabData {
  id: string;
  name: string;
  source: string;
  /** Unix ms; set when tab is created or content/name is saved */
  updatedAt?: number;
}

const STORAGE_KEY = "morph-latex-tabs";
const ACTIVE_TAB_KEY = "morph-latex-active-tab";

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

export function loadActiveTabId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_TAB_KEY);
}

export function saveActiveTabId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_TAB_KEY, id);
}

let counter = 0;
export function newId(): string {
  return `tab-${Date.now()}-${counter++}`;
}
