"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { TreeNode, FileNode, TreeItem } from "@/lib/storage";
import { buildTree } from "@/lib/storage";

// --- Icons ---

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 ${className ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function FolderIcon({ open, className }: { open: boolean; className?: string }) {
  return open ? (
    <svg className={`h-4 w-4 ${className ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      <path d="M2 10h20" />
    </svg>
  ) : (
    <svg className={`h-4 w-4 ${className ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""} ${className ?? ""}`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

// --- Context Menu ---

interface ContextMenuProps {
  x: number;
  y: number;
  items: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[];
  onClose: () => void;
}

function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          disabled={item.disabled}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`w-full px-3 py-1.5 text-left text-[13px] transition-colors disabled:opacity-40 ${
            item.danger
              ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// --- Tree Item ---

interface TreeNodeRowProps {
  item: TreeItem;
  depth: number;
  activeFileId: string;
  mainFileId: string;
  onSelectFile: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onSetMain: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
}

function TreeNodeRow({
  item,
  depth,
  activeFileId,
  mainFileId,
  onSelectFile,
  onRename,
  onDelete,
  onSetMain,
  onContextMenu,
}: TreeNodeRowProps) {
  const { node, children } = item;
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const isFile = node.type === "file";
  const isActive = isFile && node.id === activeFileId;
  const isMain = isFile && node.id === mainFileId;

  const handleClick = () => {
    if (isFile) {
      onSelectFile(node.id);
    } else {
      setOpen((prev) => !prev);
    }
  };

  const commitRename = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== node.name) {
      onRename(node.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <>
      <div
        className={`group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 ${
          isActive
            ? "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
            : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        }`}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
        onClick={handleClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, node);
        }}
      >
        {!isFile && (
          <ChevronIcon open={open} className="shrink-0 text-zinc-400 dark:text-zinc-500" />
        )}
        {isFile ? (
          <FileIcon className="shrink-0 text-zinc-400 dark:text-zinc-500" />
        ) : (
          <FolderIcon open={open} className="shrink-0 text-amber-500 dark:text-amber-400" />
        )}

        {editing ? (
          <input
            ref={inputRef}
            className="min-w-0 flex-1 border-b border-blue-500 bg-transparent text-sm outline-none dark:border-blue-400"
            defaultValue={node.name}
            onBlur={(e) => commitRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename(e.currentTarget.value);
              if (e.key === "Escape") setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm">{node.name}</span>
        )}

        {isMain && (
          <span className="ml-auto shrink-0 rounded bg-green-100 px-1 py-0.5 text-[9px] font-bold uppercase text-green-700 dark:bg-green-900/40 dark:text-green-400">
            main
          </span>
        )}
      </div>

      {!isFile && open && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNodeRow
              key={child.node.id}
              item={child}
              depth={depth + 1}
              activeFileId={activeFileId}
              mainFileId={mainFileId}
              onSelectFile={onSelectFile}
              onRename={onRename}
              onDelete={onDelete}
              onSetMain={onSetMain}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </>
  );
}

// --- Main FileTree ---

interface FileTreeProps {
  files: TreeNode[];
  activeFileId: string;
  mainFileId: string;
  onSelectFile: (id: string) => void;
  onAddFile: (parentPath: string) => void;
  onAddFolder: (parentPath: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onSetMain: (id: string) => void;
}

export default function FileTree({
  files,
  activeFileId,
  mainFileId,
  onSelectFile,
  onAddFile,
  onAddFolder,
  onRename,
  onDelete,
  onSetMain,
}: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: TreeNode | null;
  } | null>(null);

  const tree = buildTree(files);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: TreeNode) => {
      setContextMenu({ x: e.clientX, y: e.clientY, node });
    },
    []
  );

  const handleBgContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, node: null });
    },
    []
  );

  const contextMenuItems = (() => {
    if (!contextMenu) return [];
    const { node } = contextMenu;

    if (!node) {
      // Right-clicked on empty space
      return [
        { label: "New File", onClick: () => onAddFile("/") },
        { label: "New Folder", onClick: () => onAddFolder("/") },
      ];
    }

    if (node.type === "folder") {
      return [
        { label: "New File", onClick: () => onAddFile(node.path) },
        { label: "New Folder", onClick: () => onAddFolder(node.path) },
        { label: "Rename", onClick: () => onRename(node.id, node.name) },
        { label: "Delete", onClick: () => onDelete(node.id), danger: true },
      ];
    }

    // File
    return [
      {
        label: "Set as Main File",
        onClick: () => onSetMain(node.id),
        disabled: node.id === mainFileId,
      },
      { label: "Rename", onClick: () => onRename(node.id, node.name) },
      {
        label: "Delete",
        onClick: () => onDelete(node.id),
        danger: true,
        disabled: node.id === mainFileId,
      },
    ];
  })();

  return (
    <div
      className="flex h-full flex-col"
      onContextMenu={handleBgContextMenu}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-2.5 py-2 dark:border-zinc-800">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Files
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onAddFile("/")}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
            title="New file"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M12 18v-6M9 15h6" />
            </svg>
          </button>
          <button
            onClick={() => onAddFolder("/")}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
            title="New folder"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              <path d="M12 11v6M9 14h6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1">
        {tree.map((item) => (
          <TreeNodeRow
            key={item.node.id}
            item={item}
            depth={0}
            activeFileId={activeFileId}
            mainFileId={mainFileId}
            onSelectFile={onSelectFile}
            onRename={onRename}
            onDelete={onDelete}
            onSetMain={onSetMain}
            onContextMenu={handleContextMenu}
          />
        ))}
        {tree.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Right-click to add files
          </p>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
