import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a LaTeX editing assistant. When given LaTeX source and an instruction, output the COMPLETE LaTeX source with the edit applied. Preserve the entire document and only change what the instruction asks for. Do NOT wrap your output in markdown code fences. Output only the raw LaTeX.`;

const VALID_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
];

function sendSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set in environment variables." },
      { status: 500 }
    );
  }

  let body: { source: string; instruction: string; model?: string; extendedThinking?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { source, instruction, model: requestedModel, extendedThinking = false } = body;
  if (!source || !instruction) {
    return NextResponse.json(
      { error: "Both 'source' and 'instruction' are required." },
      { status: 400 }
    );
  }

  const model =
    requestedModel && VALID_MODELS.includes(requestedModel)
      ? requestedModel
      : VALID_MODELS[0];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            sendSSE({
              type: "step",
              id: "reading",
              message: "Reading your request and document...",
            })
          )
        );

        const anthropic = new Anthropic({ apiKey: anthropicKey });

        if (extendedThinking) {
          controller.enqueue(
            encoder.encode(
              sendSSE({
                type: "step",
                id: "thinking",
                message: "Thinking...",
              })
            )
          );
        }

        // Build request params conditionally based on extended thinking toggle
        const requestParams: Parameters<typeof anthropic.messages.stream>[0] = {
          model,
          max_tokens: extendedThinking ? 16000 : 8192,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `<instruction>${instruction}</instruction>\n\n<code>${source}</code>`,
            },
          ],
          ...(extendedThinking && {
            thinking: {
              type: "enabled" as const,
              budget_tokens: 10000,
            },
          }),
        };

        const response = anthropic.messages.stream(requestParams);

        let fullText = "";
        let hasThinking = false;

        if (extendedThinking) {
          response.on("thinking", (thinkingDelta) => {
            hasThinking = true;
            controller.enqueue(
              encoder.encode(
                sendSSE({
                  type: "thinking",
                  content: thinkingDelta,
                })
              )
            );
          });
        }

        response.on("text", (textDelta) => {
          // When we get the first text delta, transition to generating step
          if (!fullText && (hasThinking || !extendedThinking)) {
            controller.enqueue(
              encoder.encode(
                sendSSE({
                  type: "step",
                  id: "generating",
                  message: "Applying edit...",
                })
              )
            );
          }
          fullText += textDelta;
        });

        // Wait for the stream to complete
        await response.finalMessage();

        const mergedCode = fullText.trim();

        if (!mergedCode) {
          controller.enqueue(
            encoder.encode(
              sendSSE({
                type: "error",
                message: "Claude returned an empty response.",
              })
            )
          );
          controller.close();
          return;
        }

        controller.enqueue(
          encoder.encode(
            sendSSE({
              type: "done",
              mergedCode,
            })
          )
        );
        controller.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Edit stream API error:", message);

        // If extended thinking fails (e.g. unsupported model), fall back to non-thinking request
        if (
          message.includes("thinking") ||
          message.includes("not supported")
        ) {
          try {
            const anthropic = new Anthropic({ apiKey: anthropicKey! });
            controller.enqueue(
              encoder.encode(
                sendSSE({
                  type: "step",
                  id: "generating",
                  message: "Applying edit with Claude...",
                })
              )
            );

            const claudeResponse = await anthropic.messages.create({
              model,
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
              .filter(
                (b): b is Anthropic.TextBlock => b.type === "text"
              )
              .map((b) => b.text)
              .join("")
              .trim();

            if (!mergedCode) {
              controller.enqueue(
                encoder.encode(
                  sendSSE({
                    type: "error",
                    message: "Claude returned an empty response.",
                  })
                )
              );
            } else {
              controller.enqueue(
                encoder.encode(sendSSE({ type: "done", mergedCode }))
              );
            }
            controller.close();
            return;
          } catch (fallbackErr: unknown) {
            const fallbackMsg =
              fallbackErr instanceof Error
                ? fallbackErr.message
                : String(fallbackErr);
            controller.enqueue(
              encoder.encode(
                sendSSE({ type: "error", message: fallbackMsg })
              )
            );
            controller.close();
            return;
          }
        }

        controller.enqueue(
          encoder.encode(sendSSE({ type: "error", message }))
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
