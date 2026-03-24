import { NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  let body: { source: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { source } = body;
  if (!source) {
    return NextResponse.json(
      { error: "'source' is required." },
      { status: 400 }
    );
  }

  const workDir = join(tmpdir(), `morph-latex-${randomUUID()}`);

  try {
    await mkdir(workDir, { recursive: true });
    const texPath = join(workDir, "document.tex");
    const pdfPath = join(workDir, "document.pdf");

    await writeFile(texPath, source, "utf-8");

    // Compile with tectonic — it auto-downloads packages and handles errors gracefully
    try {
      await execFileAsync("tectonic", ["-X", "compile", "-Zcontinue-on-errors", texPath], {
        cwd: workDir,
        timeout: 30000,
        env: { ...process.env, HOME: process.env.HOME || "/tmp" },
      });
    } catch (err: unknown) {
      const isNotFound =
        err instanceof Error &&
        ("code" in err ? (err as NodeJS.ErrnoException).code === "ENOENT" : false);
      if (isNotFound) {
        return NextResponse.json(
          {
            error:
              "LaTeX compiler (tectonic) is not installed or not on PATH. Install from https://tectonic.newton.cx/ or run: curl --proto '=https' --tlsv1.2 -fsSL https://pkg.tectonic.newton.cx/tectonic/setup.sh | sh",
          },
          { status: 503 }
        );
      }
      // Tectonic may still produce a PDF even with warnings/errors
      const msg =
        err instanceof Error
          ? (err as Error & { stderr?: string }).stderr || err.message
          : String(err);
      // Check if PDF was produced despite errors
      try {
        await readFile(pdfPath);
      } catch {
        return NextResponse.json(
          { error: `Compilation failed:\n${msg}` },
          { status: 422 }
        );
      }
    }

    const pdfBuffer = await readFile(pdfPath);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="document.pdf"',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Compile error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Clean up temp dir
    const { rm } = await import("fs/promises");
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
