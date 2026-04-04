import { NextResponse } from "next/server";
import { compileLatex } from "@/lib/compile-latex";

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

  try {
    const { pdf } = await compileLatex(source);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="document.pdf"',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "TECTONIC_NOT_FOUND") {
      return NextResponse.json(
        {
          error:
            "LaTeX compiler (tectonic) is not installed or not on PATH. Install from https://tectonic.newton.cx/ or run: curl --proto '=https' --tlsv1.2 -fsSL https://pkg.tectonic.newton.cx/tectonic/setup.sh | sh",
        },
        { status: 503 }
      );
    }
    console.error("Compile error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
allowed = payload.model_dump(include={'display_name', 'avatar_url', 'timezone'})
user.update(**allowed)
