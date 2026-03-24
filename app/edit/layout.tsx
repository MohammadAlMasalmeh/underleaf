import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function EditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading…
          </span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
