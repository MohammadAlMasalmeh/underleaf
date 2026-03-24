import type { TabData } from "@/lib/storage";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "projects";

export async function fetchProjects(
  supabase: SupabaseClient,
  userId: string
): Promise<TabData[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, source, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return [];
  if (!data || !Array.isArray(data)) return [];

  return data.map((row: { id: string; name: string; source: string; updated_at: number }) => ({
    id: row.id,
    name: row.name,
    source: row.source,
    updatedAt: row.updated_at,
  }));
}

export async function saveProjects(
  supabase: SupabaseClient,
  userId: string,
  tabs: TabData[]
): Promise<{ error: unknown }> {
  const rows = tabs.map((tab) => ({
    id: tab.id,
    user_id: userId,
    name: tab.name,
    source: tab.source,
    updated_at: tab.updatedAt ?? Date.now(),
  }));
  const { error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: "user_id,id" });
  return { error };
}
