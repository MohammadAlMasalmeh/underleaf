import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { compileLatex } from "@/lib/compile-latex";

const SYSTEM_PROMPT = `You are a LaTeX editing assistant. When given LaTeX source and an instruction, output the COMPLETE LaTeX source with the edit applied. Preserve the entire document and only change what the instruction asks for. Do NOT wrap your output in markdown code fences. Output only the raw LaTeX.`;

const RESUME_VERIFICATION_PROMPT = `You are a LaTeX resume layout reviewer. Look at this compiled PDF of a resume.

Check whether the bullet point text spans the full width of the page (from the left margin to the right margin). The text in each bullet should use the available horizontal space — it should not stop far short of the right margin, leaving large empty gaps on the right side.

Use the appropriate tool to report your finding.`;

const VERIFY_TOOLS: Anthropic.Tool[] = [
  {
    name: "layout_ok",
    description: "Call this when the resume layout is correct — bullet points span the full page width with proper margins.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "layout_fix",
    description: "Call this when the bullet points do NOT span the full page width and the LaTeX needs fixing.",
    input_schema: {
      type: "object" as const,
      properties: {
        issue: {
          type: "string",
          description: "Brief description of the layout problem found",
        },
        corrected_latex: {
          type: "string",
          description: "The complete corrected LaTeX document source with the layout fix applied",
        },
      },
      required: ["issue", "corrected_latex"],
    },
  },
];

const VALID_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
];

function sendSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function isResumeRelated(instruction: string): boolean {
  const lower = instruction.toLowerCase();
  const keywords = [
    "resume",
    "cv",
    "curriculum vitae",
    "cover letter",
    "job application",
    "work experience",
    "bullet point",
  ];
  return keywords.some((kw) => lower.includes(kw));
}

const MAX_VERIFY_ITERATIONS = 2;

export async function POST(request: Request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set in environment variables." },
      { status: 500 }
    );
  }

  let body: {
    source: string;
    instruction: string;
    model?: string;
    extendedThinking?: boolean;
    chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const {
    source,
    instruction,
    model: requestedModel,
    extendedThinking = false,
  } = body;
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

        // Build messages array with chat history for context
        const apiMessages: Anthropic.MessageParam[] = [];

        if (body.chatHistory && body.chatHistory.length > 0) {
          // Cap to last 10 messages to avoid token limits
          const recentHistory = body.chatHistory.slice(-10);

          for (const msg of recentHistory) {
            // Ensure alternation: if last message has same role, merge
            if (apiMessages.length > 0 && apiMessages[apiMessages.length - 1].role === msg.role) {
              const last = apiMessages[apiMessages.length - 1];
              apiMessages[apiMessages.length - 1] = {
                role: last.role,
                content: `${typeof last.content === 'string' ? last.content : ''}\n\n${msg.content}`,
              };
            } else {
              apiMessages.push({ role: msg.role, content: msg.content });
            }
          }
        }

        // The final message must be user role with the current instruction + source
        const currentUserMsg = `<instruction>${instruction}</instruction>\n\n<code>${source}</code>`;

        if (apiMessages.length > 0 && apiMessages[apiMessages.length - 1].role === "user") {
          // Merge with last user message
          apiMessages[apiMessages.length - 1] = {
            role: "user",
            content: `${apiMessages[apiMessages.length - 1].content}\n\n${currentUserMsg}`,
          };
        } else {
          apiMessages.push({ role: "user", content: currentUserMsg });
        }

        // Ensure first message is user role (API requirement)
        if (apiMessages.length > 0 && apiMessages[0].role !== "user") {
          apiMessages.unshift({ role: "user", content: "[Beginning of conversation]" });
        }

        // Build request params conditionally based on extended thinking toggle
        const requestParams: Parameters<
          typeof anthropic.messages.stream
        >[0] = {
          model,
          max_tokens: extendedThinking ? 16000 : 8192,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
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

        let mergedCode = fullText.trim();

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

        // --- Resume layout verification loop ---
        if (isResumeRelated(instruction)) {
          for (let i = 0; i < MAX_VERIFY_ITERATIONS; i++) {
            controller.enqueue(
              encoder.encode(
                sendSSE({
                  type: "step",
                  id: "verifying",
                  message:
                    i === 0
                      ? "Compiling PDF to verify layout..."
                      : `Recompiling to verify fix (attempt ${i + 1})...`,
                })
              )
            );

            let pdfBuffer: Buffer;
            try {
              const result = await compileLatex(mergedCode);
              pdfBuffer = result.pdf;
            } catch {
              // If compilation fails, skip verification and return what we have
              break;
            }

            controller.enqueue(
              encoder.encode(
                sendSSE({
                  type: "step",
                  id: "verifying",
                  message: "Checking bullet point layout...",
                })
              )
            );

            const pdfBase64 = pdfBuffer.toString("base64");

            const verifyResponse = await anthropic.messages.create({
              model,
              max_tokens: 8192,
              tools: VERIFY_TOOLS,
              tool_choice: { type: "any" as const },
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "document",
                      source: {
                        type: "base64",
                        media_type: "application/pdf",
                        data: pdfBase64,
                      },
                    },
                    {
                      type: "text",
                      text: RESUME_VERIFICATION_PROMPT,
                    },
                  ],
                },
              ],
            });

            const toolUseBlock = verifyResponse.content.find(
              (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
            );

            if (!toolUseBlock || toolUseBlock.name === "layout_ok") {
              break; // Layout is fine
            }

            if (toolUseBlock.name === "layout_fix") {
              const input = toolUseBlock.input as { issue: string; corrected_latex: string };
              if (!input.corrected_latex) break;

              controller.enqueue(
                encoder.encode(
                  sendSSE({
                    type: "step",
                    id: "verifying",
                    message: `Fixing: ${input.issue}`,
                  })
                )
              );

              mergedCode = input.corrected_latex;
              // Continue the loop to verify the fix
            }
          }
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

            // Rebuild apiMessages for fallback (same history logic)
            const fallbackMessages: Anthropic.MessageParam[] = [];

            if (body.chatHistory && body.chatHistory.length > 0) {
              const recentHistory = body.chatHistory.slice(-10);
              for (const msg of recentHistory) {
                if (fallbackMessages.length > 0 && fallbackMessages[fallbackMessages.length - 1].role === msg.role) {
                  const last = fallbackMessages[fallbackMessages.length - 1];
                  fallbackMessages[fallbackMessages.length - 1] = {
                    role: last.role,
                    content: `${typeof last.content === 'string' ? last.content : ''}\n\n${msg.content}`,
                  };
                } else {
                  fallbackMessages.push({ role: msg.role, content: msg.content });
                }
              }
            }

            const fallbackUserMsg = `<instruction>${instruction}</instruction>\n\n<code>${source}</code>`;

            if (fallbackMessages.length > 0 && fallbackMessages[fallbackMessages.length - 1].role === "user") {
              fallbackMessages[fallbackMessages.length - 1] = {
                role: "user",
                content: `${fallbackMessages[fallbackMessages.length - 1].content}\n\n${fallbackUserMsg}`,
              };
            } else {
              fallbackMessages.push({ role: "user", content: fallbackUserMsg });
            }

            if (fallbackMessages.length > 0 && fallbackMessages[0].role !== "user") {
              fallbackMessages.unshift({ role: "user", content: "[Beginning of conversation]" });
            }

            const claudeResponse = await anthropic.messages.create({
              model,
              max_tokens: 8192,
              system: SYSTEM_PROMPT,
              messages: fallbackMessages,
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
