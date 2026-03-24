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
import { fetchProjects, saveProjects } from "@/lib/supabase/projects";
import { loadTabs, saveTabs as saveTabsLocal, type TabData } from "@/lib/storage";

type ProjectsContextValue = {
  tabs: TabData[];
  setTabs: React.Dispatch<React.SetStateAction<TabData[]>>;
  persistTabs: (tabs: TabData[]) => void;
  isReady: boolean;
  isCloud: boolean;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [isReady, setIsReady] = useState(false);
  const supabaseRef = useRef(createClient());

  const isCloud = !!user;

  useEffect(() => {
    if (!user) {
      setTabs(loadTabs());
      setIsReady(true);
      return;
    }
    const supabase = supabaseRef.current;
    fetchProjects(supabase, user.id)
      .then((cloud) => {
        if (cloud.length > 0) {
          setTabs(cloud);
        } else {
          const local = loadTabs();
          if (local.length > 0) {
            setTabs(local);
            saveProjects(supabase, user.id, local).then(() => {});
          } else {
            setTabs([]);
          }
        }
        setIsReady(true);
      })
      .catch(() => {
        setTabs(loadTabs());
        setIsReady(true);
      });
  }, [user?.id]);

  const persistTabs = useCallback(
    (next: TabData[]) => {
      if (user) {
        saveProjects(supabaseRef.current, user.id, next).then(() => {});
      } else {
        saveTabsLocal(next);
      }
    },
    [user?.id]
  );

  return (
    <ProjectsContext.Provider
      value={{ tabs, setTabs, persistTabs, isReady, isCloud }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
