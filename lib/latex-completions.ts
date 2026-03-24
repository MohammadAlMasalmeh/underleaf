import type * as Monaco from "monaco-editor";

type M = typeof Monaco;

export function registerLatexCompletions(monaco: M) {
  monaco.languages.registerCompletionItemProvider("latex", {
    triggerCharacters: ["\\", "{"],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // Check if we're after a backslash
      const lineContent = model.getLineContent(position.lineNumber);
      const charBefore = lineContent[word.startColumn - 2];
      const isCommand = charBefore === "\\";

      // Check if we're inside \begin{ or \end{
      const textBefore = lineContent.substring(0, position.column - 1);
      const beginMatch = textBefore.match(/\\begin\{(\w*)$/);
      const endMatch = textBefore.match(/\\end\{(\w*)$/);
      const usepackageMatch = textBefore.match(/\\usepackage(?:\[.*?\])?\{(\w*)$/);

      if (beginMatch || endMatch) {
        return {
          suggestions: ENVIRONMENTS.map((env) => ({
            label: env.name,
            kind: monaco.languages.CompletionItemKind.Enum,
            insertText: env.name,
            detail: env.detail,
            range,
          })),
        };
      }

      if (usepackageMatch) {
        return {
          suggestions: PACKAGES.map((pkg) => ({
            label: pkg.name,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: pkg.name,
            detail: pkg.detail,
            range,
          })),
        };
      }

      if (isCommand) {
        const suggestions: Monaco.languages.CompletionItem[] = [];

        // Commands
        for (const cmd of COMMANDS) {
          suggestions.push({
            label: cmd.label,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: cmd.insertText,
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: cmd.detail,
            documentation: cmd.documentation,
            range,
          });
        }

        // Begin/end environments as snippets
        for (const env of ENVIRONMENTS) {
          suggestions.push({
            label: `begin{${env.name}}`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: `begin{${env.name}}\n\t$0\n\\end{${env.name}}`,
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: `${env.detail} environment`,
            range,
          });
        }

        // Greek letters
        for (const g of GREEK) {
          suggestions.push({
            label: g,
            kind: monaco.languages.CompletionItemKind.Constant,
            insertText: g,
            detail: "Greek letter",
            range,
          });
        }

        // Math symbols
        for (const sym of MATH_SYMBOLS) {
          suggestions.push({
            label: sym.label,
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: sym.insertText,
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: sym.detail,
            range,
          });
        }

        return { suggestions };
      }

      return { suggestions: [] };
    },
  });

  // Auto-close braces and environments
  monaco.languages.setLanguageConfiguration("latex", {
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "$", close: "$" },
      { open: "``", close: "''" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "$", close: "$" },
    ],
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    comments: {
      lineComment: "%",
    },
  });
}

// ── Data ──

interface CmdEntry {
  label: string;
  insertText: string;
  detail: string;
  documentation?: string;
}

const COMMANDS: CmdEntry[] = [
  // Document structure
  { label: "documentclass", insertText: "documentclass{${1:article}}", detail: "Document class" },
  { label: "usepackage", insertText: "usepackage{${1:package}}", detail: "Import package" },
  { label: "title", insertText: "title{${1:Title}}", detail: "Document title" },
  { label: "author", insertText: "author{${1:Author}}", detail: "Document author" },
  { label: "date", insertText: "date{${1:\\\\today}}", detail: "Document date" },
  { label: "maketitle", insertText: "maketitle", detail: "Render title block" },
  { label: "tableofcontents", insertText: "tableofcontents", detail: "Table of contents" },

  // Sections
  { label: "section", insertText: "section{${1:Title}}", detail: "Section" },
  { label: "subsection", insertText: "subsection{${1:Title}}", detail: "Subsection" },
  { label: "subsubsection", insertText: "subsubsection{${1:Title}}", detail: "Subsubsection" },
  { label: "section*", insertText: "section*{${1:Title}}", detail: "Unnumbered section" },
  { label: "paragraph", insertText: "paragraph{${1:Title}}", detail: "Paragraph heading" },
  { label: "chapter", insertText: "chapter{${1:Title}}", detail: "Chapter" },
  { label: "part", insertText: "part{${1:Title}}", detail: "Part" },

  // Text formatting
  { label: "textbf", insertText: "textbf{${1:text}}", detail: "Bold text" },
  { label: "textit", insertText: "textit{${1:text}}", detail: "Italic text" },
  { label: "texttt", insertText: "texttt{${1:text}}", detail: "Monospace text" },
  { label: "textsc", insertText: "textsc{${1:text}}", detail: "Small caps" },
  { label: "underline", insertText: "underline{${1:text}}", detail: "Underline" },
  { label: "emph", insertText: "emph{${1:text}}", detail: "Emphasis" },
  { label: "textrm", insertText: "textrm{${1:text}}", detail: "Roman text" },
  { label: "textsf", insertText: "textsf{${1:text}}", detail: "Sans-serif text" },

  // Font sizes
  { label: "tiny", insertText: "tiny", detail: "Tiny text" },
  { label: "scriptsize", insertText: "scriptsize", detail: "Script size" },
  { label: "footnotesize", insertText: "footnotesize", detail: "Footnote size" },
  { label: "small", insertText: "small", detail: "Small text" },
  { label: "normalsize", insertText: "normalsize", detail: "Normal size" },
  { label: "large", insertText: "large", detail: "Large text" },
  { label: "Large", insertText: "Large", detail: "Larger text" },
  { label: "LARGE", insertText: "LARGE", detail: "Even larger" },
  { label: "huge", insertText: "huge", detail: "Huge text" },
  { label: "Huge", insertText: "Huge", detail: "Largest text" },

  // References & labels
  { label: "label", insertText: "label{${1:key}}", detail: "Set label" },
  { label: "ref", insertText: "ref{${1:key}}", detail: "Reference" },
  { label: "eqref", insertText: "eqref{${1:key}}", detail: "Equation reference" },
  { label: "pageref", insertText: "pageref{${1:key}}", detail: "Page reference" },
  { label: "cite", insertText: "cite{${1:key}}", detail: "Citation" },
  { label: "footnote", insertText: "footnote{${1:text}}", detail: "Footnote" },

  // Math
  { label: "frac", insertText: "frac{${1:num}}{${2:den}}", detail: "Fraction" },
  { label: "dfrac", insertText: "dfrac{${1:num}}{${2:den}}", detail: "Display fraction" },
  { label: "sqrt", insertText: "sqrt{${1:expr}}", detail: "Square root" },
  { label: "sum", insertText: "sum_{${1:i=1}}^{${2:n}}", detail: "Summation" },
  { label: "prod", insertText: "prod_{${1:i=1}}^{${2:n}}", detail: "Product" },
  { label: "int", insertText: "int_{${1:a}}^{${2:b}}", detail: "Integral" },
  { label: "iint", insertText: "iint", detail: "Double integral" },
  { label: "iiint", insertText: "iiint", detail: "Triple integral" },
  { label: "oint", insertText: "oint", detail: "Contour integral" },
  { label: "lim", insertText: "lim_{${1:x \\\\to ${2:\\\\infty}}}", detail: "Limit" },
  { label: "infty", insertText: "infty", detail: "Infinity" },
  { label: "partial", insertText: "partial", detail: "Partial derivative" },
  { label: "nabla", insertText: "nabla", detail: "Nabla/gradient" },
  { label: "forall", insertText: "forall", detail: "For all" },
  { label: "exists", insertText: "exists", detail: "There exists" },
  { label: "in", insertText: "in", detail: "Element of" },
  { label: "notin", insertText: "notin", detail: "Not element of" },
  { label: "subset", insertText: "subset", detail: "Subset" },
  { label: "subseteq", insertText: "subseteq", detail: "Subset or equal" },
  { label: "supset", insertText: "supset", detail: "Superset" },
  { label: "cup", insertText: "cup", detail: "Union" },
  { label: "cap", insertText: "cap", detail: "Intersection" },
  { label: "emptyset", insertText: "emptyset", detail: "Empty set" },
  { label: "mathbb", insertText: "mathbb{${1:R}}", detail: "Blackboard bold" },
  { label: "mathcal", insertText: "mathcal{${1:A}}", detail: "Calligraphic" },
  { label: "mathfrak", insertText: "mathfrak{${1:g}}", detail: "Fraktur" },
  { label: "mathrm", insertText: "mathrm{${1:text}}", detail: "Roman in math" },
  { label: "mathbf", insertText: "mathbf{${1:x}}", detail: "Bold math" },
  { label: "hat", insertText: "hat{${1:x}}", detail: "Hat accent" },
  { label: "bar", insertText: "bar{${1:x}}", detail: "Bar accent" },
  { label: "tilde", insertText: "tilde{${1:x}}", detail: "Tilde accent" },
  { label: "vec", insertText: "vec{${1:x}}", detail: "Vector arrow" },
  { label: "dot", insertText: "dot{${1:x}}", detail: "Dot accent" },
  { label: "ddot", insertText: "ddot{${1:x}}", detail: "Double dot" },
  { label: "overline", insertText: "overline{${1:expr}}", detail: "Overline" },
  { label: "underbrace", insertText: "underbrace{${1:expr}}_{${2:label}}", detail: "Underbrace" },
  { label: "overbrace", insertText: "overbrace{${1:expr}}^{${2:label}}", detail: "Overbrace" },
  { label: "left", insertText: "left${1:(}", detail: "Left delimiter" },
  { label: "right", insertText: "right${1:)}", detail: "Right delimiter" },
  { label: "text", insertText: "text{${1:text}}", detail: "Text in math mode" },
  { label: "operatorname", insertText: "operatorname{${1:name}}", detail: "Custom operator" },
  { label: "binom", insertText: "binom{${1:n}}{${2:k}}", detail: "Binomial coefficient" },
  { label: "stackrel", insertText: "stackrel{${1:top}}{${2:bot}}", detail: "Stacked relation" },

  // Arrows
  { label: "to", insertText: "to", detail: "Right arrow →" },
  { label: "rightarrow", insertText: "rightarrow", detail: "Right arrow" },
  { label: "leftarrow", insertText: "leftarrow", detail: "Left arrow" },
  { label: "leftrightarrow", insertText: "leftrightarrow", detail: "Left-right arrow" },
  { label: "Rightarrow", insertText: "Rightarrow", detail: "Double right arrow ⇒" },
  { label: "Leftarrow", insertText: "Leftarrow", detail: "Double left arrow" },
  { label: "Leftrightarrow", insertText: "Leftrightarrow", detail: "Double left-right arrow" },
  { label: "mapsto", insertText: "mapsto", detail: "Maps to ↦" },
  { label: "implies", insertText: "implies", detail: "Implies ⟹" },
  { label: "iff", insertText: "iff", detail: "If and only if ⟺" },

  // Relations
  { label: "leq", insertText: "leq", detail: "Less or equal ≤" },
  { label: "geq", insertText: "geq", detail: "Greater or equal ≥" },
  { label: "neq", insertText: "neq", detail: "Not equal ≠" },
  { label: "approx", insertText: "approx", detail: "Approximately ≈" },
  { label: "equiv", insertText: "equiv", detail: "Equivalent ≡" },
  { label: "sim", insertText: "sim", detail: "Similar ∼" },
  { label: "propto", insertText: "propto", detail: "Proportional ∝" },
  { label: "ll", insertText: "ll", detail: "Much less ≪" },
  { label: "gg", insertText: "gg", detail: "Much greater ≫" },
  { label: "pm", insertText: "pm", detail: "Plus-minus ±" },
  { label: "mp", insertText: "mp", detail: "Minus-plus ∓" },
  { label: "times", insertText: "times", detail: "Times ×" },
  { label: "cdot", insertText: "cdot", detail: "Center dot ·" },
  { label: "div", insertText: "div", detail: "Division ÷" },
  { label: "circ", insertText: "circ", detail: "Circle ∘" },

  // Dots
  { label: "ldots", insertText: "ldots", detail: "Low dots …" },
  { label: "cdots", insertText: "cdots", detail: "Center dots ⋯" },
  { label: "vdots", insertText: "vdots", detail: "Vertical dots ⋮" },
  { label: "ddots", insertText: "ddots", detail: "Diagonal dots ⋱" },

  // Spacing
  { label: "quad", insertText: "quad", detail: "Quad space" },
  { label: "qquad", insertText: "qquad", detail: "Double quad space" },
  { label: "hspace", insertText: "hspace{${1:1cm}}", detail: "Horizontal space" },
  { label: "vspace", insertText: "vspace{${1:1cm}}", detail: "Vertical space" },
  { label: "newline", insertText: "newline", detail: "New line" },
  { label: "newpage", insertText: "newpage", detail: "New page" },

  // Figures & tables
  { label: "includegraphics", insertText: "includegraphics[width=${1:\\\\textwidth}]{${2:file}}", detail: "Include image" },
  { label: "caption", insertText: "caption{${1:Caption text}}", detail: "Caption" },
  { label: "centering", insertText: "centering", detail: "Center content" },
  { label: "hline", insertText: "hline", detail: "Horizontal line in table" },

  // Bibliography
  { label: "bibliography", insertText: "bibliography{${1:refs}}", detail: "Bibliography file" },
  { label: "bibliographystyle", insertText: "bibliographystyle{${1:plain}}", detail: "Bibliography style" },

  // Misc
  { label: "item", insertText: "item ", detail: "List item" },
  { label: "LaTeX", insertText: "LaTeX", detail: "LaTeX logo" },
  { label: "TeX", insertText: "TeX", detail: "TeX logo" },
  { label: "today", insertText: "today", detail: "Today's date" },
  { label: "input", insertText: "input{${1:file}}", detail: "Input file" },
  { label: "include", insertText: "include{${1:file}}", detail: "Include file" },
];

const ENVIRONMENTS = [
  { name: "document", detail: "Document body" },
  { name: "equation", detail: "Numbered equation" },
  { name: "equation*", detail: "Unnumbered equation" },
  { name: "align", detail: "Aligned equations" },
  { name: "align*", detail: "Aligned (unnumbered)" },
  { name: "gather", detail: "Gathered equations" },
  { name: "gather*", detail: "Gathered (unnumbered)" },
  { name: "multline", detail: "Multi-line equation" },
  { name: "multline*", detail: "Multi-line (unnumbered)" },
  { name: "split", detail: "Split equation" },
  { name: "cases", detail: "Piecewise cases" },
  { name: "matrix", detail: "Matrix (no delimiters)" },
  { name: "pmatrix", detail: "Matrix with ( )" },
  { name: "bmatrix", detail: "Matrix with [ ]" },
  { name: "Bmatrix", detail: "Matrix with { }" },
  { name: "vmatrix", detail: "Matrix with | |" },
  { name: "Vmatrix", detail: "Matrix with || ||" },
  { name: "itemize", detail: "Bullet list" },
  { name: "enumerate", detail: "Numbered list" },
  { name: "description", detail: "Description list" },
  { name: "figure", detail: "Figure float" },
  { name: "figure*", detail: "Wide figure" },
  { name: "table", detail: "Table float" },
  { name: "table*", detail: "Wide table" },
  { name: "tabular", detail: "Table content" },
  { name: "abstract", detail: "Abstract" },
  { name: "quote", detail: "Block quote" },
  { name: "quotation", detail: "Block quotation" },
  { name: "verbatim", detail: "Verbatim text" },
  { name: "center", detail: "Centered content" },
  { name: "flushleft", detail: "Left-aligned" },
  { name: "flushright", detail: "Right-aligned" },
  { name: "minipage", detail: "Mini page" },
  { name: "theorem", detail: "Theorem" },
  { name: "lemma", detail: "Lemma" },
  { name: "proposition", detail: "Proposition" },
  { name: "corollary", detail: "Corollary" },
  { name: "definition", detail: "Definition" },
  { name: "remark", detail: "Remark" },
  { name: "example", detail: "Example" },
  { name: "proof", detail: "Proof" },
  { name: "tikzpicture", detail: "TikZ drawing" },
];

const PACKAGES = [
  { name: "amsmath", detail: "AMS math extensions" },
  { name: "amssymb", detail: "AMS symbols" },
  { name: "amsthm", detail: "AMS theorem environments" },
  { name: "amsfonts", detail: "AMS fonts" },
  { name: "mathtools", detail: "Math tools (extends amsmath)" },
  { name: "geometry", detail: "Page geometry" },
  { name: "graphicx", detail: "Graphics inclusion" },
  { name: "hyperref", detail: "Hyperlinks" },
  { name: "babel", detail: "Language support" },
  { name: "inputenc", detail: "Input encoding" },
  { name: "fontenc", detail: "Font encoding" },
  { name: "xcolor", detail: "Color support" },
  { name: "tikz", detail: "TikZ graphics" },
  { name: "pgfplots", detail: "Plots with PGF/TikZ" },
  { name: "booktabs", detail: "Better table rules" },
  { name: "array", detail: "Extended tabular" },
  { name: "multirow", detail: "Multi-row cells" },
  { name: "enumitem", detail: "Custom lists" },
  { name: "fancyhdr", detail: "Custom headers/footers" },
  { name: "titlesec", detail: "Custom section titles" },
  { name: "listings", detail: "Code listings" },
  { name: "algorithm2e", detail: "Algorithms" },
  { name: "algorithmicx", detail: "Algorithm typesetting" },
  { name: "float", detail: "Float placement" },
  { name: "subcaption", detail: "Subfigures/subtables" },
  { name: "caption", detail: "Caption customization" },
  { name: "natbib", detail: "Bibliography (author-year)" },
  { name: "biblatex", detail: "Modern bibliography" },
  { name: "cleveref", detail: "Smart cross-references" },
  { name: "siunitx", detail: "SI units" },
  { name: "physics", detail: "Physics notation" },
  { name: "bm", detail: "Bold math symbols" },
  { name: "cancel", detail: "Cancel terms in math" },
  { name: "url", detail: "URL typesetting" },
  { name: "microtype", detail: "Microtypography" },
  { name: "parskip", detail: "Paragraph spacing" },
  { name: "setspace", detail: "Line spacing" },
  { name: "lipsum", detail: "Lorem ipsum text" },
];

const GREEK = [
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon",
  "zeta", "eta", "theta", "vartheta", "iota", "kappa",
  "lambda", "mu", "nu", "xi", "pi", "varpi",
  "rho", "varrho", "sigma", "varsigma", "tau", "upsilon",
  "phi", "varphi", "chi", "psi", "omega",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi",
  "Sigma", "Upsilon", "Phi", "Psi", "Omega",
];

const MATH_SYMBOLS: CmdEntry[] = [
  { label: "sin", insertText: "sin", detail: "Sine" },
  { label: "cos", insertText: "cos", detail: "Cosine" },
  { label: "tan", insertText: "tan", detail: "Tangent" },
  { label: "log", insertText: "log", detail: "Logarithm" },
  { label: "ln", insertText: "ln", detail: "Natural log" },
  { label: "exp", insertText: "exp", detail: "Exponential" },
  { label: "min", insertText: "min", detail: "Minimum" },
  { label: "max", insertText: "max", detail: "Maximum" },
  { label: "sup", insertText: "sup", detail: "Supremum" },
  { label: "inf", insertText: "inf", detail: "Infimum" },
  { label: "lim", insertText: "lim", detail: "Limit" },
  { label: "det", insertText: "det", detail: "Determinant" },
  { label: "dim", insertText: "dim", detail: "Dimension" },
  { label: "ker", insertText: "ker", detail: "Kernel" },
  { label: "arg", insertText: "arg", detail: "Argument" },
  { label: "deg", insertText: "deg", detail: "Degree" },
  { label: "hom", insertText: "hom", detail: "Homomorphism" },
  { label: "gcd", insertText: "gcd", detail: "GCD" },
  { label: "arcsin", insertText: "arcsin", detail: "Arc sine" },
  { label: "arccos", insertText: "arccos", detail: "Arc cosine" },
  { label: "arctan", insertText: "arctan", detail: "Arc tangent" },
  { label: "sinh", insertText: "sinh", detail: "Hyperbolic sine" },
  { label: "cosh", insertText: "cosh", detail: "Hyperbolic cosine" },
  { label: "tanh", insertText: "tanh", detail: "Hyperbolic tangent" },
];
