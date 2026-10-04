import { createServer, type Server } from "node:http";

type Message = { role: string; content: unknown; tool_calls?: unknown };
type Reply = string | { tool: string; args: object };

export interface FakeModel {
  url: string;
  /** Every request body the server received. */
  requests: { messages: Message[]; tools?: unknown[] }[];
  close(): Promise<void>;
}

/**
 * A stand-in for Ollama's OpenAI-compatible endpoint. `respond` sees the
 * request and returns either text or a tool call.
 */
export async function fakeModel(respond: (messages: Message[], call: number) => Reply): Promise<FakeModel> {
  const requests: FakeModel["requests"] = [];
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const body = JSON.parse(raw);
      requests.push(body);
      const reply = respond(body.messages, requests.length);
      const message =
        typeof reply === "string"
          ? { role: "assistant", content: reply }
          : {
              role: "assistant",
              content: null,
              tool_calls: [
                { id: "call_1", type: "function", function: { name: reply.tool, arguments: JSON.stringify(reply.args) } },
              ],
            };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "fake",
          object: "chat.completion",
          created: 0,
          model: body.model,
          choices: [{ index: 0, message, finish_reason: typeof reply === "string" ? "stop" : "tool_calls" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

export const textOf = (messages: Message[]): string => JSON.stringify(messages);
