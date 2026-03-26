import type { TreeNode, ProjectData } from "@/lib/storage";
import { newId } from "@/lib/storage";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "projects";

interface ProjectRow {
  id: string;
  name: string;
  source: string;
  updated_at: number;
  project_name?: string | null;
  files?: TreeNode[] | null;
}

export async function fetchProjects(
  supabase: SupabaseClient,
  userId: string
): Promise<ProjectData[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, source, updated_at, project_name, files")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return [];
  if (!data || !Array.isArray(data)) return [];

  return (data as ProjectRow[]).map((row) => {
    // New format: files column is populated
    if (row.files && Array.isArray(row.files) && row.files.length > 0) {
      const files = row.files as TreeNode[];
      const firstFile = files.find((f) => f.type === "file");
      return {
        id: row.id,
        name: row.project_name || row.name.replace(/\.tex$/, ""),
        files,
        mainFileId: firstFile?.id ?? "",
        updatedAt: row.updated_at,
      };
    }

    // Legacy format: single file, no files column
    const fileId = `file-${row.id}`;
    return {
      id: row.id,
      name: row.project_name || row.name.replace(/\.tex$/, ""),
      files: [
        {
          id: fileId,
          name: row.name,
          path: "/" + row.name,
          type: "file" as const,
          source: row.source,
          updatedAt: row.updated_at,
        },
      ],
      mainFileId: fileId,
      updatedAt: row.updated_at,
    };
  });
}

export async function saveProjects(
  supabase: SupabaseClient,
  userId: string,
  projects: ProjectData[]
): Promise<{ error: unknown }> {
  const rows = projects.map((p) => {
    const mainFile = p.files.find((f) => f.type === "file" && f.id === p.mainFileId) as
      | (TreeNode & { source?: string })
      | undefined;
    return {
      id: p.id,
      user_id: userId,
      project_name: p.name,
      // Backward compat: keep name/source columns populated with main file
      name: mainFile?.name ?? "main.tex",
      source: mainFile && "source" in mainFile ? mainFile.source : "",
      files: p.files,
      updated_at: p.updatedAt ?? Date.now(),
    };
  });
  const { error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: "user_id,id" });
  return { error };
}
