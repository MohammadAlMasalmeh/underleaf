import katex from "katex";

interface ParsedDocument {
  title: string;
  author: string;
  date: string;
  bodyHtml: string;
}

/**
 * Parse a LaTeX source string and render it to HTML.
 * Handles: title/author/date, sections, paragraphs, math (inline + display),
 * theorem-like environments, proof, itemize/enumerate, bold/italic/texttt,
 * and common LaTeX commands.
 */
export function renderLatexToHtml(source: string): string {
  const doc = parseDocument(source);
  let html = "";

  // Title block
  if (doc.title || doc.author || doc.date) {
    html += `<div class="doc-titleblock">`;
    if (doc.title) {
      html += `<h1 class="doc-title">${processInline(doc.title)}</h1>`;
    }
    if (doc.author) {
      html += `<p class="doc-author">${processInline(doc.author)}</p>`;
    }
    if (doc.date) {
      html += `<p class="doc-date">${processInline(doc.date)}</p>`;
    }
    html += `</div>`;
  }

  html += doc.bodyHtml;
  return html;
}

function parseDocument(source: string): ParsedDocument {
  // Extract preamble metadata
  const title = extractCommand(source, "title");
  const author = extractCommand(source, "author");
  const date = extractCommand(source, "date");

  // Extract body between \begin{document} and \end{document}
  const bodyMatch = source.match(
    /\\begin\{document\}([\s\S]*?)\\end\{document\}/
  );
  const body = bodyMatch ? bodyMatch[1] : source;

  // Remove \maketitle
  const cleaned = body.replace(/\\maketitle/, "");

  const bodyHtml = processBody(cleaned);

  return { title, author, date, bodyHtml };
}

function extractCommand(source: string, cmd: string): string {
  const re = new RegExp(`\\\\${cmd}\\{([^}]*)\\}`);
  const m = source.match(re);
  return m ? m[1] : "";
}

function processBody(body: string): string {
  let html = "";
  // Split into blocks by double newlines (paragraphs)
  // But first, handle environments and sections as structural elements

  const lines = body.split("\n");
  let i = 0;
  let paragraphBuffer = "";

  const flushParagraph = () => {
    const trimmed = paragraphBuffer.trim();
    if (trimmed) {
      html += `<p class="doc-paragraph">${processInline(trimmed)}</p>`;
    }
    paragraphBuffer = "";
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines (paragraph breaks)
    if (trimmed === "") {
      flushParagraph();
      i++;
      continue;
    }

    // \section{...}
    const sectionMatch = trimmed.match(/^\\section\*?\{(.+)\}$/);
    if (sectionMatch) {
      flushParagraph();
      html += `<h2 class="doc-section">${processInline(sectionMatch[1])}</h2>`;
      i++;
      continue;
    }

    // \subsection{...}
    const subsectionMatch = trimmed.match(/^\\subsection\*?\{(.+)\}$/);
    if (subsectionMatch) {
      flushParagraph();
      html += `<h3 class="doc-subsection">${processInline(subsectionMatch[1])}</h3>`;
      i++;
      continue;
    }

    // \subsubsection{...}
    const subsubMatch = trimmed.match(/^\\subsubsection\*?\{(.+)\}$/);
    if (subsubMatch) {
      flushParagraph();
      html += `<h4 class="doc-subsubsection">${processInline(subsubMatch[1])}</h4>`;
      i++;
      continue;
    }

    // Environment blocks: \begin{...} ... \end{...}
    const beginMatch = trimmed.match(/^\\begin\{(\w+\*?)\}(.*)$/);
    if (beginMatch) {
      flushParagraph();
      const envName = beginMatch[1];
      const afterBegin = beginMatch[2] || "";
      // Collect until \end{envName}
      const endTag = `\\end{${envName}}`;
      let envContent = afterBegin ? afterBegin + "\n" : "";
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(endTag)) {
        envContent += lines[i] + "\n";
        i++;
      }
      i++; // skip the \end line

      html += renderEnvironment(envName, envContent.trim());
      continue;
    }

    // \maketitle — skip
    if (trimmed === "\\maketitle") {
      i++;
      continue;
    }

    // Regular text line — add to paragraph buffer
    paragraphBuffer += (paragraphBuffer ? " " : "") + trimmed;
    i++;
  }

  flushParagraph();
  return html;
}

function renderEnvironment(name: string, content: string): string {
  // Math environments
  if (
    ["equation", "equation*", "align", "align*", "gather", "gather*", "multline", "multline*", "flalign", "flalign*"].includes(name)
  ) {
    return renderDisplayMath(content, name);
  }

  // Theorem-like environments
  if (
    ["theorem", "lemma", "proposition", "corollary", "definition", "remark", "example"].includes(name)
  ) {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    // Process the content (may contain nested environments like equation)
    const innerHtml = processBody(content);
    return `<div class="doc-theorem"><span class="doc-theorem-label">${label}.</span> ${innerHtml}</div>`;
  }

  // Proof
  if (name === "proof") {
    const innerHtml = processBody(content);
    return `<div class="doc-proof"><span class="doc-proof-label">Proof.</span> ${innerHtml}<span class="doc-qed">&#9633;</span></div>`;
  }

  // itemize
  if (name === "itemize") {
    return renderList(content, "ul");
  }

  // enumerate
  if (name === "enumerate") {
    return renderList(content, "ol");
  }

  // abstract
  if (name === "abstract") {
    const innerHtml = processBody(content);
    return `<div class="doc-abstract"><h4 class="doc-abstract-title">Abstract</h4>${innerHtml}</div>`;
  }

  // quote / quotation
  if (name === "quote" || name === "quotation") {
    const innerHtml = processBody(content);
    return `<blockquote class="doc-quote">${innerHtml}</blockquote>`;
  }

  // center
  if (name === "center") {
    const innerHtml = processBody(content);
    return `<div class="doc-center">${innerHtml}</div>`;
  }

  // figure — just render the caption if present
  if (name === "figure" || name === "figure*") {
    const captionMatch = content.match(/\\caption\{([^}]*)\}/);
    const caption = captionMatch ? captionMatch[1] : "";
    return `<div class="doc-figure"><p class="doc-figure-placeholder">[Figure]</p>${caption ? `<p class="doc-caption">${processInline(caption)}</p>` : ""}</div>`;
  }

  // table — placeholder
  if (name === "table" || name === "table*" || name === "tabular") {
    return `<div class="doc-figure"><p class="doc-figure-placeholder">[Table]</p></div>`;
  }

  // Fallback: render as a generic block
  const innerHtml = processBody(content);
  return `<div class="doc-env">${innerHtml}</div>`;
}

function renderDisplayMath(content: string, envName: string): string {
  try {
    // Wrap in the environment for KaTeX
    let mathStr = content;
    // For align/gather etc., KaTeX needs the environment wrapper
    if (envName !== "equation" && envName !== "equation*") {
      mathStr = `\\begin{${envName}}${content}\\end{${envName}}`;
    }
    const rendered = katex.renderToString(mathStr, {
      displayMode: true,
      throwOnError: false,
    });
    return `<div class="doc-display-math">${rendered}</div>`;
  } catch {
    return `<div class="doc-display-math doc-math-error">[Math render error]</div>`;
  }
}

function renderList(content: string, tag: "ul" | "ol"): string {
  // Split by \item
  const items = content.split(/\\item/).filter((s) => s.trim());
  const inner = items
    .map((item) => `<li>${processInline(item.trim())}</li>`)
    .join("");
  return `<${tag} class="doc-list">${inner}</${tag}>`;
}

/**
 * Process inline LaTeX: math, bold, italic, texttt, commands, etc.
 */
function processInline(text: string): string {
  // First handle display math $$...$$ within inline text
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
    try {
      return katex.renderToString(math, {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return `<span class="doc-math-error">[math error]</span>`;
    }
  });

  // Inline math $...$
  text = text.replace(/\$([^$]+)\$/g, (_match, math) => {
    try {
      return katex.renderToString(math, {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<span class="doc-math-error">[math error]</span>`;
    }
  });

  // \textbf{...}
  text = text.replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>");

  // \textit{...} and \emph{...}
  text = text.replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>");
  text = text.replace(/\\emph\{([^}]*)\}/g, "<em>$1</em>");

  // \texttt{...}
  text = text.replace(
    /\\texttt\{([^}]*)\}/g,
    '<code class="doc-code">$1</code>'
  );

  // \underline{...}
  text = text.replace(
    /\\underline\{([^}]*)\}/g,
    '<span style="text-decoration:underline">$1</span>'
  );

  // \label{...} — hide
  text = text.replace(/\\label\{[^}]*\}/g, "");

  // \ref{...} and \eqref{...} — show as [ref]
  text = text.replace(/\\eqref\{([^}]*)\}/g, "($1)");
  text = text.replace(/\\ref\{([^}]*)\}/g, "[$1]");
  text = text.replace(/\\cite\{([^}]*)\}/g, "[$1]");

  // \footnote{...}
  text = text.replace(
    /\\footnote\{([^}]*)\}/g,
    '<sup class="doc-footnote">*</sup>'
  );

  // ~ → non-breaking space
  text = text.replace(/~/g, "&nbsp;");

  // \\ → <br>
  text = text.replace(/\\\\/g, "<br>");

  // \, \; \: \! → thin spaces
  text = text.replace(/\\,/g, "&thinsp;");
  text = text.replace(/\\;/g, "&ensp;");
  text = text.replace(/\\:/g, "&ensp;");

  // \LaTeX, \TeX
  text = text.replace(
    /\\LaTeX/g,
    '<span class="doc-latex">L<sup>A</sup>T<sub>E</sub>X</span>'
  );
  text = text.replace(
    /\\TeX/g,
    '<span class="doc-latex">T<sub>E</sub>X</span>'
  );

  // --- and -- to dashes
  text = text.replace(/---/g, "&mdash;");
  text = text.replace(/--/g, "&ndash;");

  // Remove remaining unknown commands (best effort)
  text = text.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1");
  text = text.replace(/\\[a-zA-Z]+/g, "");

  return text;
}
