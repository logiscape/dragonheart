/* OllamaTransport port → the Rust reqwest proxy. Streaming chat arrives
   over a Tauri Channel (one event per NDJSON chunk); everything else is a
   plain invoke. Going through Rust avoids CORS and gives real streaming. */
import { invoke, Channel } from "@tauri-apps/api/core";
import { newId, type ChatStreamOptions, type OllamaTransport } from "@engine/ports";
import type { OllamaChatRequest, OllamaChatChunk } from "@engine/types";

export class TauriOllama implements OllamaTransport {
  constructor(private baseUrl: string) {}

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  async chatStream(
    req: OllamaChatRequest,
    onChunk: (chunk: OllamaChatChunk) => void,
    opts?: ChatStreamOptions,
  ): Promise<void> {
    const channel = new Channel<OllamaChatChunk>();
    channel.onmessage = (msg) => onChunk(msg);
    const streamId = newId();
    const onAbort = () => {
      void invoke("ollama_chat_cancel", { streamId }).catch(() => {});
    };
    opts?.signal?.addEventListener("abort", onAbort, { once: true });
    if (opts?.signal?.aborted) onAbort();
    try {
      await invoke("ollama_chat_stream", {
        baseUrl: this.baseUrl,
        body: req,
        streamId,
        onEvent: channel,
      });
    } finally {
      opts?.signal?.removeEventListener("abort", onAbort);
    }
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return invoke<T>("ollama_post", { baseUrl: this.baseUrl, path, body });
  }

  async get<T = unknown>(path: string): Promise<T> {
    return invoke<T>("ollama_get", { baseUrl: this.baseUrl, path });
  }
}
