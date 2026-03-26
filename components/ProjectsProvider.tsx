"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  fetchProjects as fetchCloudProjects,
  saveProjects as saveCloudProjects,
} from "@/lib/supabase/projects";
import {
  migrateToProjects,
  loadProjects,
  saveProjects as saveProjectsLocal,
  type ProjectData,
} from "@/lib/storage";

type ProjectsContextValue = {
  projects: ProjectData[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectData[]>>;
  persistProjects: (projects: ProjectData[]) => void;
  isReady: boolean;
  isCloud: boolean;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isReady, setIsReady] = useState(false);
  const supabaseRef = useRef(createClient());

  const isCloud = !!user;

  useEffect(() => {
    if (!user) {
      // Local mode: migrate old tabs → projects if needed
      const local = migrateToProjects();
      if (local.length > 0) {
        setProjects(local);
      } else {
        setProjects(loadProjects());
      }
      setIsReady(true);
      return;
    }
    const supabase = supabaseRef.current;
    fetchCloudProjects(supabase, user.id)
      .then((cloud) => {
        if (cloud.length > 0) {
          setProjects(cloud);
        } else {
          // Try migrating local data to cloud
          const local = migrateToProjects();
          if (local.length > 0) {
            setProjects(local);
            saveCloudProjects(supabase, user.id, local).then(() => {});
          } else {
            setProjects([]);
          }
        }
        setIsReady(true);
      })
      .catch(() => {
        const local = migrateToProjects();
        setProjects(local.length > 0 ? local : loadProjects());
        setIsReady(true);
      });
  }, [user?.id]);

  const persistProjects = useCallback(
    (next: ProjectData[]) => {
      if (user) {
        saveCloudProjects(supabaseRef.current, user.id, next).then(() => {});
      } else {
        saveProjectsLocal(next);
      }
    },
    [user?.id]
  );

  return (
    <ProjectsContext.Provider
      value={{ projects, setProjects, persistProjects, isReady, isCloud }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx)
    throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
