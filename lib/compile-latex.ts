import { writeFile, readFile, mkdir, rm } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);

export interface CompileResult {
  pdf: Buffer;
}

/**
 * Compile LaTeX source to PDF using tectonic.
 * Returns the PDF buffer on success, throws on failure.
 */
export async function compileLatex(source: string): Promise<CompileResult> {
  const workDir = join(tmpdir(), `morph-latex-${randomUUID()}`);

  try {
    await mkdir(workDir, { recursive: true });
    const texPath = join(workDir, "document.tex");
    const pdfPath = join(workDir, "document.pdf");

    await writeFile(texPath, source, "utf-8");

    try {
      await execFileAsync(
        "tectonic",
        ["-X", "compile", "-Zcontinue-on-errors", texPath],
        {
          cwd: workDir,
          timeout: 30000,
          env: { ...process.env, HOME: process.env.HOME || "/tmp" },
        }
      );
    } catch (err: unknown) {
      const isNotFound =
        err instanceof Error &&
        ("code" in err
          ? (err as NodeJS.ErrnoException).code === "ENOENT"
          : false);
      if (isNotFound) {
        throw new Error("TECTONIC_NOT_FOUND");
      }
      // Tectonic may still produce a PDF even with warnings/errors
      try {
        await readFile(pdfPath);
      } catch {
        const msg =
          err instanceof Error
            ? (err as Error & { stderr?: string }).stderr || err.message
            : String(err);
        throw new Error(`Compilation failed:\n${msg}`);
      }
    }

    const pdf = await readFile(pdfPath);
    return { pdf: Buffer.from(pdf) };
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
