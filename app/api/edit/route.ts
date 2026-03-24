import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a LaTeX editing assistant. When given LaTeX source and an instruction, output the COMPLETE LaTeX source with the edit applied. Preserve the entire document and only change what the instruction asks for. Do NOT wrap your output in markdown code fences. Output only the raw LaTeX.`;

export async function POST(request: Request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set in environment variables." },
      { status: 500 }
    );
  }

  let body: { source: string; instruction: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { source, instruction } = body;
  if (!source || !instruction) {
    return NextResponse.json(
      { error: "Both 'source' and 'instruction' are required." },
      { status: 400 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const claudeResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `<instruction>${instruction}</instruction>\n\n<code>${source}</code>`,
        },
      ],
    });

    const mergedCode = claudeResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!mergedCode) {
      return NextResponse.json(
        { error: "Claude returned an empty response." },
        { status: 502 }
      );
    }

    return NextResponse.json({ mergedCode });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Edit API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
