"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/components/AuthProvider";
import { useProjects } from "@/components/ProjectsProvider";
import TypingLogo from "@/components/TypingLogo";
import type { TabData } from "@/lib/storage";

function formatLastModified(updatedAt?: number): string {
  if (updatedAt == null) return "—";
  const d = new Date(updatedAt);
  const now = Date.now();
  const diffMs = now - updatedAt;
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1) return "Just now";
  if (diffM < 60) return `${diffM} min ago`;
  if (diffH < 24) return `${diffH} hour${diffH === 1 ? "" : "s"} ago`;
  if (diffD < 7) return `${diffD} day${diffD === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
}

function downloadTex(tab: TabData) {
  const blob = new Blob([tab.source], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = tab.name.endsWith(".tex") ? tab.name : `${tab.name}.tex`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const { user, isLoading: authLoading, signInWithGoogle, signInWithEmail, signOut } = useAuth();
  const { tabs, setTabs, persistTabs, isReady, isCloud } = useProjects();
  const [filter, setFilter] = useState<"all" | "yours">("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showSignIn, setShowSignIn] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) renameInputRef.current?.focus();
  }, [editingId]);

  const filteredDocs = useMemo(() => {
    if (!isReady) return [];
    let list = tabs;
    if (filter === "yours") list = list; // same for now; could filter by "owner" later
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }
    return list;
  }, [tabs, filter, search, isReady]);

  const removeDoc = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    persistTabs(next);
  };

  const startRename = (e: React.MouseEvent, tab: TabData) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(tab.id);
    setEditingName(tab.name);
  };

  const commitRename = () => {
    if (editingId == null) return;
    const name = editingName.trim() || "main.tex";
    const next = tabs.map((t) =>
      t.id === editingId ? { ...t, name, updatedAt: Date.now() } : t
    );
    setTabs(next);
    persistTabs(next);
    setEditingId(null);
    setEditingName("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-30 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-14 items-center justify-between px-4">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
          >
            UnderLeaf
          </Link>
          <div className="flex items-center gap-2">
            {isCloud && (
              <span className="hidden text-xs text-zinc-500 sm:inline dark:text-zinc-400">
                Saved to account
              </span>
            )}
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <span className="max-w-[140px] truncate">
                    {user.email ?? (user.user_metadata?.email as string) ?? "Signed in"}
                  </span>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showAccountMenu && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                    <button
                      type="button"
                      onClick={() => { signOut(); setShowAccountMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowSignIn(!showSignIn)}
                  disabled={authLoading}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {authLoading ? "Loading…" : "Sign in"}
                </button>
                {showSignIn && (
                  <div className="absolute right-4 top-full z-50 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                    <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Sign in to save projects to your account
                    </p>
                    <button
                      type="button"
                      onClick={() => signInWithGoogle()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Continue with Google
                    </button>
                    <div className="my-2 border-t border-zinc-200 dark:border-zinc-600" />
                    {!magicSent ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const { error } = await signInWithEmail(magicEmail);
                          if (error) return;
                          setMagicSent(true);
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="email"
                          placeholder="Email for magic link"
                          value={magicEmail}
                          onChange={(e) => setMagicEmail(e.target.value)}
                          className="flex-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <button
                          type="submit"
                          className="rounded bg-zinc-200 px-2 py-1.5 text-sm font-medium dark:bg-zinc-700"
                        >
                          Send link
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Check your email for the sign-in link.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
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
        </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="fixed left-0 top-14 z-20 flex w-56 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-1 p-3">
          <Link
            href="/edit?new=1"
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" />
            </svg>
            New project
          </Link>
          <nav className="mt-2 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              All projects
            </button>
            <button
              type="button"
              onClick={() => setFilter("yours")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                filter === "yours"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Your projects
            </button>
          </nav>
          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <p className="px-3 text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Organize tags
            </p>
            <button
              type="button"
              className="mt-1 rounded-lg px-3 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              + New tag
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 pl-56 pt-14">
        <div className="border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="pb-6 pt-8">
            <TypingLogo size="hero" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            All projects
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="search"
                placeholder="Search in all projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
            </div>
          </div>
        </div>

        <div className="p-6">
          {!isReady ? (
            <div className="flex items-center justify-center py-16">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</span>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {tabs.length === 0 ? "No projects yet." : "No projects match your search."}
              </p>
              {tabs.length === 0 && (
                <Link
                  href="/edit?new=1"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  New project
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="w-10 px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Title</th>
                      <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Owner</th>
                      <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Last modified</th>
                      <th className="w-36 px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((tab) => (
                      <tr
                        key={tab.id}
                        className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                      >
                        <td className="px-4 py-3">
                          <span className="sr-only">Checkbox</span>
                        </td>
                        <td className="px-4 py-3">
                          {editingId === tab.id ? (
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") cancelRename();
                              }}
                              onBlur={commitRename}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full min-w-[120px] rounded border border-blue-500 bg-white px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-500 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                          ) : (
                            <Link
                              href={`/edit?tab=${tab.id}`}
                              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {tab.name}
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">You</td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                          {formatLastModified(tab.updatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => startRename(e, tab)}
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                              title="Rename"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                downloadTex(tab);
                              }}
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                              title="Download source (.tex)"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                              </svg>
                            </button>
                            <Link
                              href={`/edit?tab=${tab.id}`}
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                              title="Open project"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                              </svg>
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => removeDoc(e, tab.id)}
                              className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                              title="Delete"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <path d="m10 11 0 6M14 11v6" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                Showing {filteredDocs.length} out of {tabs.length} project{tabs.length !== 1 ? "s" : ""}.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
