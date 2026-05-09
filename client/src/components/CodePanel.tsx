// Read-only viewer for the room's sandbox project files.
// Pulls from the runner's /api/code/* endpoint (Caddy proxies localhost:4000).

import { useEffect, useMemo, useState } from "react";

type Props = {
  roomId: string;
  onClose: () => void;
};

type FileTreeNode =
  | { type: "dir"; name: string; path: string; children: FileTreeNode[] }
  | { type: "file"; name: string; path: string };

function buildTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  for (const fullPath of paths) {
    const parts = fullPath.split("/");
    let level = root;
    let prefix = "";
    parts.forEach((segment, i) => {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      const isFile = i === parts.length - 1;
      let node = level.find((n) => n.name === segment);
      if (!node) {
        node = isFile
          ? { type: "file", name: segment, path: prefix }
          : { type: "dir", name: segment, path: prefix, children: [] };
        level.push(node);
      }
      if (node.type === "dir") level = node.children;
    });
  }
  // sort: dirs first, then files, alpha within
  const sortRec = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) if (n.type === "dir") sortRec(n.children);
  };
  sortRec(root);
  return root;
}

function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return (
    ({
      js: "javascript",
      mjs: "javascript",
      cjs: "javascript",
      ts: "typescript",
      tsx: "tsx",
      jsx: "jsx",
      json: "json",
      html: "html",
      css: "css",
      scss: "scss",
      py: "python",
      sh: "bash",
      yml: "yaml",
      yaml: "yaml",
      md: "markdown",
      toml: "toml",
    } as Record<string, string>)[ext] ?? "text"
  );
}

function TreeNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  if (node.type === "file") {
    const isSelected = selected === node.path;
    return (
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={[
          "block w-full truncate rounded px-2 py-0.5 text-left text-xs",
          isSelected
            ? "bg-cyan-100 text-cyan-900"
            : "text-ink-muted hover:bg-paper-hover",
        ].join(" ")}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        title={node.path}
      >
        {node.name}
      </button>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="block w-full truncate rounded px-2 py-0.5 text-left text-xs font-medium text-ink hover:bg-paper-hover"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {open ? "▾" : "▸"} {node.name}/
      </button>
      {open &&
        node.children.map((c) => (
          <TreeNode
            key={c.path}
            node={c}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export default function CodePanel({ roomId, onClose }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);

  const tree = useMemo(() => buildTree(files), [files]);

  const refresh = () => {
    setFilesLoading(true);
    setFilesError(null);
    fetch(`/api/code/files?roomId=${encodeURIComponent(roomId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { files: string[] }) => {
        setFiles(d.files);
        if (!selected && d.files.length > 0) setSelected(d.files[0] ?? null);
      })
      .catch((err) => setFilesError(err.message ?? "failed to load files"))
      .finally(() => setFilesLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (!selected) {
      setContent("");
      return;
    }
    setContentLoading(true);
    fetch(
      `/api/code/file?roomId=${encodeURIComponent(roomId)}&path=${encodeURIComponent(selected)}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(setContent)
      .catch((err) => setContent(`(failed to load: ${err.message ?? err})`))
      .finally(() => setContentLoading(false));
  }, [roomId, selected]);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-[min(1200px,95vw)] flex-col overflow-hidden rounded-xl border border-line-strong bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-cream px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-ink">📁 Project files</span>
            <span className="text-xs text-ink-soft">
              {filesLoading
                ? "loading…"
                : filesError
                  ? `error: ${filesError}`
                  : `${files.length} file${files.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="rounded border border-line px-2 py-1 text-xs text-ink-muted hover:bg-paper-hover"
              title="Re-list files from sandbox"
            >
              ↻ Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-line px-2 py-1 text-xs text-ink-muted hover:bg-paper-hover"
              title="Close (Esc)"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* File tree */}
          <aside className="w-64 shrink-0 overflow-y-auto border-r border-line bg-cream py-2">
            {filesError && (
              <div className="px-3 text-xs text-red-700">{filesError}</div>
            )}
            {!filesError && !filesLoading && files.length === 0 && (
              <div className="px-3 text-xs text-ink-soft">
                No files yet. Spawn an agent to start a project.
              </div>
            )}
            {tree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                selected={selected}
                onSelect={setSelected}
              />
            ))}
          </aside>

          {/* File content */}
          <main className="flex-1 overflow-auto bg-paper">
            {selected ? (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-cream px-4 py-2">
                  <span className="font-mono text-xs text-ink">{selected}</span>
                  <span className="text-[10px] uppercase tracking-wider text-ink-soft">
                    {languageFromPath(selected)}
                  </span>
                </div>
                <pre className="m-0 whitespace-pre overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-ink">
                  {contentLoading ? "loading…" : content}
                </pre>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">
                Select a file
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
