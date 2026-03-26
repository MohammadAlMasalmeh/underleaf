"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";

export type ChatMessageRole = "user" | "assistant";

export interface ChatStep {
  id: string;
  message: string;
  status: "pending" | "active" | "done";
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  steps?: ChatStep[];
  mergedCode?: string | null;
  error?: string | null;
  thinking?: string;
  thinkingCollapsed?: boolean;
}

export type ModelOption = {
  id: string;
  label: string;
  supportsThinking: boolean;
};

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", supportsThinking: false },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", supportsThinking: true },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", supportsThinking: true },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", supportsThinking: true },
];

interface AIChatPanelProps {
  onStreamEdit: (
    instruction: string,
    model: string,
    extendedThinking: boolean,
    chatHistory: Array<{ role: "user" | "assistant"; content: string }>,
    onStep: (step: { id: string; message: string }) => void,
    onThinking: (content: string) => void,
    onDone: (mergedCode: string) => void,
    onError: (message: string) => void
  ) => void;
  onEditReady?: (mergedCode: string) => void;
  onAcceptEdits: () => void;
  onRejectEdits: () => void;
  reviewing: boolean;
}

const STEP_ORDER = ["reading", "thinking", "generating", "verifying"];

const STEP_LABELS: Record<string, string> = {
  reading: "Reading document",
  thinking: "Reasoning",
  generating: "Editing",
  verifying: "Verifying layout",
};

function updateStepsForStep(
  steps: ChatStep[],
  activeId: string
): ChatStep[] {
  return steps.map((s) => {
    const idx = STEP_ORDER.indexOf(s.id);
    const activeIdx = STEP_ORDER.indexOf(activeId);
    if (idx < activeIdx) return { ...s, status: "done" as const };
    if (s.id === activeId) return { ...s, status: "active" as const };
    return s;
  });
}

/** Chevron icon that rotates when open */
function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-90" : ""} ${className ?? ""}`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

/** Auto-scrolling thinking excerpt — shows latest content with a top fade */
function ThinkingExcerpt({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Auto-scroll to bottom as content streams in
    el.scrollTop = el.scrollHeight;
    setIsOverflowing(el.scrollHeight > el.clientHeight);
  }, [content]);

  return (
    <div className="relative mt-1.5 ml-1">
      {/* Top fade gradient when content overflows */}
      {isOverflowing && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 rounded-t-lg bg-gradient-to-b from-zinc-50 to-transparent dark:from-zinc-900" />
      )}
      <div
        ref={containerRef}
        className="max-h-28 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700/60 dark:bg-zinc-900/60"
      >
        <p className="whitespace-pre-wrap text-[12px] leading-[1.6] text-zinc-500 dark:text-zinc-400">
          {content}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-zinc-400 align-middle dark:bg-zinc-500" />
          )}
        </p>
      </div>
    </div>
  );
}

export default function AIChatPanel({
  onStreamEdit,
  onEditReady,
  onAcceptEdits,
  onRejectEdits,
  reviewing,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0].id);
  const [extendedThinking, setExtendedThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedModelOption = MODEL_OPTIONS.find((m) => m.id === selectedModel);
  const thinkingAvailable = selectedModelOption?.supportsThinking ?? false;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const useThinking = thinkingAvailable && extendedThinking;
    const steps: ChatStep[] = [
      { id: "reading", message: STEP_LABELS.reading, status: "pending" },
      ...(useThinking
        ? [{ id: "thinking", message: STEP_LABELS.thinking, status: "pending" as const }]
        : []),
      { id: "generating", message: STEP_LABELS.generating, status: "pending" },
    ];

    const assistantMsgId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        steps,
        thinking: "",
        thinkingCollapsed: false,
      },
    ]);

    const history: Array<{ role: "user" | "assistant"; content: string }> = messages
      .filter(m => m.content && !m.error)
      .map(m => ({
        role: m.role,
        content: m.role === "assistant" && m.mergedCode
          ? `[Applied LaTeX edit: ${m.content}]`
          : m.content,
      }));

    onStreamEdit(
      trimmed,
      selectedModel,
      useThinking,
      history,
      (step) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMsgId || m.role !== "assistant" || !m.steps)
              return m;
            let steps = m.steps;
            // Dynamically add the verifying step if the server sends it and it's not already present
            if (step.id === "verifying" && !steps.some((s) => s.id === "verifying")) {
              steps = [
                ...steps,
                { id: "verifying", message: STEP_LABELS.verifying, status: "pending" as const },
              ];
            }
            // Update the message text for dynamic steps (verifying can change its message)
            steps = steps.map((s) =>
              s.id === step.id && step.message ? { ...s, message: step.message } : s
            );
            return {
              ...m,
              steps: updateStepsForStep(steps, step.id),
            };
          })
        );
      },
      (thinkingContent) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMsgId) return m;
            return {
              ...m,
              thinking: (m.thinking ?? "") + thinkingContent,
            };
          })
        );
      },
      (mergedCode) => {
        onEditReady?.(mergedCode);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: "Changes applied. Review the diff and accept or reject.",
                  steps: (m.steps ?? []).map((s) => ({ ...s, status: "done" as const })),
                  mergedCode,
                  error: null,
                }
              : m
          )
        );
        setLoading(false);
      },
      (message) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: "",
                  steps: (m.steps ?? []).map((s) => ({ ...s, status: "done" as const })),
                  error: message,
                  mergedCode: null,
                }
              : m
          )
        );
        setLoading(false);
      }
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAccept = (msgId: string) => {
    onAcceptEdits();
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, mergedCode: null } : m))
    );
  };

  const handleReject = (msgId: string) => {
    onRejectEdits();
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, mergedCode: null } : m))
    );
  };

  const toggleThinking = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, thinkingCollapsed: !m.thinkingCollapsed } : m
      )
    );
  };

  /** Get the current active step for a message (Cursor-style single status line) */
  const getActiveStep = (steps: ChatStep[]) => {
    const active = steps.find((s) => s.status === "active");
    if (active) return active;
    const allDone = steps.every((s) => s.status === "done");
    if (allDone) return null;
    return steps.find((s) => s.status === "pending") ?? null;
  };

  const renderAssistantMessage = (msg: ChatMessage) => {
    const activeStep = msg.steps ? getActiveStep(msg.steps) : null;
    const allDone = msg.steps?.every((s) => s.status === "done") ?? false;
    const isInProgress = msg.steps && !allDone;
    const hasThinking = !!(msg.thinking && msg.thinking.length > 0);

    return (
      <div className="space-y-2.5">
        {/* Status line — single animated indicator like Cursor */}
        {isInProgress && activeStep && (
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-4 w-4 items-center justify-center">
              <span className="absolute h-4 w-4 animate-ping rounded-full bg-blue-400/30 dark:bg-blue-500/20" />
              <span className="relative h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-400" />
            </div>
            <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
              {activeStep.message}
            </span>
            <span className="inline-flex gap-[3px]">
              <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500" style={{ animationDelay: "0ms" }} />
              <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500" style={{ animationDelay: "150ms" }} />
              <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        )}

        {/* Thinking section — collapsible with chevron, Cursor-style excerpt */}
        {hasThinking && (
          <div>
            <button
              onClick={() => toggleThinking(msg.id)}
              className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 -ml-1 text-[12px] text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              <Chevron open={!msg.thinkingCollapsed} className="text-zinc-400 group-hover:text-zinc-500 dark:text-zinc-500 dark:group-hover:text-zinc-400" />
              <span>Thought process</span>
              {isInProgress && hasThinking && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-400/80 animate-pulse dark:bg-amber-500/60" />
              )}
            </button>
            {!msg.thinkingCollapsed && (
              <ThinkingExcerpt content={msg.thinking!} isStreaming={isInProgress ?? false} />
            )}
          </div>
        )}

        {/* Error */}
        {msg.error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/30">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM7.25 5a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5Zm.75 6.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
            </svg>
            <p className="text-[12px] leading-relaxed text-red-700 dark:text-red-300">{msg.error}</p>
          </div>
        )}

        {/* Completion message */}
        {msg.content && !msg.error && allDone && (
          <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">{msg.content}</p>
        )}

        {/* Accept / Reject */}
        {msg.mergedCode != null && msg.mergedCode !== "" && (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleAccept(msg.id)}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-[12px] font-medium text-white transition-all hover:bg-blue-700 active:scale-[0.98] dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Accept
            </button>
            <button
              onClick={() => handleReject(msg.id)}
              className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-zinc-600 transition-all hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden border-t border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-500 text-white">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Assistant</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
              const newModel = MODEL_OPTIONS.find((m) => m.id === e.target.value);
              if (!newModel?.supportsThinking) setExtendedThinking(false);
            }}
            disabled={loading}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 outline-none transition-colors hover:bg-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:focus:border-blue-400"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {thinkingAvailable && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Thinking</span>
              <button
                role="switch"
                aria-checked={extendedThinking}
                onClick={() => !loading && setExtendedThinking((v) => !v)}
                disabled={loading}
                className={`relative inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                  extendedThinking
                    ? "bg-blue-500 dark:bg-blue-400"
                    : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`inline-block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    extendedThinking ? "translate-x-[16px]" : "translate-x-[2px]"
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[13px] text-zinc-500 max-w-xs leading-relaxed dark:text-zinc-400">
              Describe your edit in plain language. You&apos;ll be able to review and accept or reject changes.
            </p>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">e.g. &quot;Add a section about methods&quot;</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl bg-blue-600 px-4 py-2.5 text-white dark:bg-blue-500">
                <p className="text-[13px] whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <div className="max-w-[90%] rounded-2xl border border-zinc-150 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-zinc-700/80 dark:bg-zinc-800/90 dark:shadow-none">
                {renderAssistantMessage(msg)}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex gap-2 rounded-xl border border-zinc-200 bg-zinc-50 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-blue-400 dark:focus-within:ring-blue-400/20">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the edit you want..."
            disabled={loading}
            rows={2}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-[13px] text-zinc-800 placeholder-zinc-400 outline-none disabled:opacity-60 dark:text-zinc-200 dark:placeholder-zinc-500"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className="self-end mb-2 mr-2 flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-blue-700 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {loading ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white" />
                <span>Working</span>
              </>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
