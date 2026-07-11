/* ============================================================
   Dragon Heart — Ollama client.
   A thin, typed wrapper over the OllamaTransport port. Streaming
   chat aggregates the full reply (and any separated "thinking"
   stream) while forwarding deltas for the live typing effect.
   ============================================================ */

import type { ChatStreamOptions, OllamaTransport } from "./ports";
import type { OllamaChatRequest, OllamaChatChunk, OllamaModelInfo } from "./types";

export interface ChatResult {
  content: string;
  thinking: string;
  evalCount: number;
  promptEvalCount: number;
  doneReason: string | null;
}

export type TokenHandler = (delta: string, full: string) => void;

export class OllamaClient {
  constructor(private readonly transport: OllamaTransport) {}

  async chat(
    req: OllamaChatRequest,
    onToken?: TokenHandler,
    opts?: ChatStreamOptions,
  ): Promise<ChatResult> {
    let content = "";
    let thinking = "";
    let evalCount = 0;
    let promptEvalCount = 0;
    let doneReason: string | null = null;

    const onChunk = (chunk: OllamaChatChunk) => {
      const delta = chunk.message?.content ?? "";
      const tdelta = chunk.message?.thinking ?? "";
      if (tdelta) thinking += tdelta;
      if (delta) {
        content += delta;
        onToken?.(delta, content);
      }
      if (typeof chunk.eval_count === "number") evalCount = chunk.eval_count;
      if (typeof chunk.prompt_eval_count === "number") promptEvalCount = chunk.prompt_eval_count;
      if (chunk.done_reason) doneReason = chunk.done_reason;
    };
    await this.transport.chatStream(req, onChunk, opts);

    return { content, thinking, evalCount, promptEvalCount, doneReason };
  }

  /** Embed one or more strings. Returns one vector per input. */
  async embed(model: string, input: string | string[]): Promise<number[][]> {
    const res = await this.transport.post<{ embeddings?: number[][]; embedding?: number[] }>(
      "/api/embed",
      { model, input },
    );
    if (res.embeddings && res.embeddings.length) return res.embeddings;
    if (res.embedding && res.embedding.length) return [res.embedding];
    return [];
  }

  async embedOne(model: string, input: string): Promise<number[] | null> {
    const out = await this.embed(model, input);
    return out[0] ?? null;
  }

  async listModels(): Promise<OllamaModelInfo[]> {
    const res = await this.transport.get<{ models?: OllamaModelInfo[] }>("/api/tags");
    return res.models ?? [];
  }

  async version(): Promise<string | null> {
    try {
      const res = await this.transport.get<{ version?: string }>("/api/version");
      return res.version ?? null;
    } catch {
      return null;
    }
  }
}
