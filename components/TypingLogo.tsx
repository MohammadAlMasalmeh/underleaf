"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const TYPING_INTERVAL = 80;
const PAUSE_AFTER_TYPING = 600;
const HIGHLIGHT_DURATION = 800;
const PAUSE_AFTER_HIGHLIGHT = 300;

const FULL_OVERLEAF = "Overleaf";
const PREFIX_TO_HIGHLIGHT = "Over";
const REPLACEMENT = "Under";
const REST = "leaf";

const sizeClasses = {
  base: "text-base",
  hero: "text-4xl sm:text-5xl md:text-6xl",
} as const;

export default function TypingLogo({ size = "base" }: { size?: keyof typeof sizeClasses }) {
  const sizeClass = sizeClasses[size];
  const [phase, setPhase] = useState<
    "typingOver" | "highlight" | "typingUnder" | "done"
  >("typingOver");
  const [visibleLength, setVisibleLength] = useState(0);
  const [replacementLength, setReplacementLength] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  // Phase 1: type "Overleaf"
  useEffect(() => {
    if (phase !== "typingOver") return;
    let i = 0;
    const typeNext = () => {
      if (i <= FULL_OVERLEAF.length) {
        setVisibleLength(i);
        i++;
        const t = setTimeout(typeNext, TYPING_INTERVAL);
        timersRef.current.push(t);
      } else {
        const t = setTimeout(() => setPhase("highlight"), PAUSE_AFTER_TYPING);
        timersRef.current.push(t);
      }
    };
    typeNext();
    return () => clearTimers();
  }, [phase]);

  // Phase 2: highlight "Over"
  useEffect(() => {
    if (phase !== "highlight") return;
    setHighlight(true);
    const t = setTimeout(() => setPhase("typingUnder"), HIGHLIGHT_DURATION);
    timersRef.current.push(t);
    return () => clearTimeout(t);
  }, [phase]);

  // Phase 3: type "Under" character by character
  useEffect(() => {
    if (phase !== "typingUnder") return;
    setHighlight(false);
    setVisibleLength(0);
    let i = 0;
    const typeNext = () => {
      if (i <= REPLACEMENT.length) {
        setReplacementLength(i);
        i++;
        const t = setTimeout(typeNext, TYPING_INTERVAL);
        timersRef.current.push(t);
      } else {
        const t = setTimeout(() => setPhase("done"), PAUSE_AFTER_HIGHLIGHT);
        timersRef.current.push(t);
      }
    };
    typeNext();
    return () => clearTimers();
  }, [phase]);

  const showCursor = phase === "typingOver" || phase === "typingUnder";

  return (
    <Link
      href="/"
      className={`flex flex-col font-semibold tracking-tight text-zinc-900 no-underline transition-colors hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300 ${sizeClass}`}
    >
      <span className="flex items-baseline gap-0.5">
        {phase === "highlight" && (
          <>
            <span className="rounded px-0.5 bg-blue-200 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100">
              {PREFIX_TO_HIGHLIGHT}
            </span>
            <span>{REST}</span>
          </>
        )}
        {phase === "typingUnder" && (
          <>
            <span>{REPLACEMENT.slice(0, replacementLength)}</span>
            {showCursor && (
              <span
                className="animate-blink text-white drop-shadow-[0_0_1px_rgba(0,0,0,0.4)] dark:drop-shadow-none"
                aria-hidden
              >
                _
              </span>
            )}
            <span>{REST}</span>
          </>
        )}
        {phase === "done" && <span>UnderLeaf</span>}
        {phase === "typingOver" && (
          <>
            <span>{FULL_OVERLEAF.slice(0, visibleLength)}</span>
            {showCursor && (
              <span
                className="animate-blink text-white drop-shadow-[0_0_1px_rgba(0,0,0,0.4)] dark:drop-shadow-none"
                aria-hidden
              >
                _
              </span>
            )}
          </>
        )}
      </span>
      <span
        className={
          size === "hero"
            ? "mt-1 text-base font-normal text-zinc-500 dark:text-zinc-400 sm:text-lg"
            : "text-xs font-normal text-zinc-500 dark:text-zinc-400"
        }
      >
        The other one
      </span>
    </Link>
  );
}
