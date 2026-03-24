"use client";

import MonacoEditor, { OnMount, DiffEditor, DiffOnMount } from "@monaco-editor/react";
import type { editor as monacoEditor } from "monaco-editor";
import type * as Monaco from "monaco-editor";
import { registerLatexCompletions } from "@/lib/latex-completions";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  reviewing?: boolean;
  originalValue?: string;
  dark?: boolean;
}

let latexRegistered = false;

function registerLatex(monaco: typeof Monaco) {
  if (latexRegistered) return;
  latexRegistered = true;

  monaco.languages.register({ id: "latex" });
  monaco.languages.setMonarchTokensProvider("latex", {
    tokenizer: {
      root: [
        [/%.*$/, "comment"],
        [/\\\w+/, "keyword"],
        [/\$\$/, { token: "string", next: "@displayMath" }],
        [/\$/, { token: "string", next: "@inlineMath" }],
        [/[{}]/, "delimiter.bracket"],
        [/\[|\]/, "delimiter.square"],
      ],
      inlineMath: [
        [/\$/, { token: "string", next: "@pop" }],
        [/[^$\\]+/, "string"],
        [/\\./, "string.escape"],
      ],
      displayMath: [
        [/\$\$/, { token: "string", next: "@pop" }],
        [/[^$\\]+/, "string"],
        [/\\./, "string.escape"],
      ],
    },
  });

  registerLatexCompletions(monaco);
}

const EDITOR_OPTIONS: monacoEditor.IStandaloneEditorConstructionOptions = {
  wordWrap: "on",
  lineNumbers: "on",
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  padding: { top: 16 },
  renderLineHighlight: "gutter",
  quickSuggestions: true,
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnCommitCharacter: true,
  snippetSuggestions: "top",
  tabCompletion: "on",
};

export default function Editor({
  value,
  onChange,
  reviewing,
  originalValue,
  dark = false,
}: EditorProps) {
  const theme = dark ? "vs-dark" : "vs";
  const handleMount: OnMount = (_editor, monaco) => {
    registerLatex(monaco);
  };

  const handleDiffMount: DiffOnMount = (_editor, monaco) => {
    registerLatex(monaco);
  };

  if (reviewing && originalValue !== undefined) {
    return (
      <DiffEditor
        height="100%"
        language="latex"
        theme={theme}
        original={originalValue}
        modified={value}
        onMount={handleDiffMount}
        options={{
          ...EDITOR_OPTIONS,
          readOnly: true,
          renderSideBySide: false,
          originalEditable: false,
        }}
      />
    );
  }

  return (
    <MonacoEditor
      height="100%"
      language="latex"
      theme={theme}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      options={EDITOR_OPTIONS}
    />
  );
}
