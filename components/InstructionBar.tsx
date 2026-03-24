"use client";

import { useState, KeyboardEvent } from "react";

interface InstructionBarProps {
  onSubmit: (instruction: string) => void;
  loading: boolean;
  error: string | null;
}

export default function InstructionBar({
  onSubmit,
  loading,
  error,
}: InstructionBarProps) {
  const [instruction, setInstruction] = useState("");

  const handleSubmit = () => {
    const trimmed = instruction.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-[#2a2a2a] bg-[#0e0e0e] px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-lg text-[#d4a574]">&gt;</span>
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the edit you want to apply..."
          disabled={loading}
          className="flex-1 bg-transparent font-mono text-sm text-[#e8e0d4] placeholder-[#555] outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !instruction.trim()}
          className="shrink-0 rounded-md bg-[#d4a574] px-4 py-2 font-serif text-sm font-medium text-[#0e0e0e] transition-all hover:bg-[#e0b888] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Applying...
            </span>
          ) : (
            "Apply Edit"
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 pl-7 font-mono text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
      />
    </svg>
  );
}
