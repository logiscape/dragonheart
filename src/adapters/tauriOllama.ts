/* OllamaTransport port → the Rust reqwest proxy. Streaming chat arrives
   over a Tauri Channel (one event per NDJSON chunk); everything else is a
   plain invoke. Going through Rust avoids CORS and gives real streaming. */
import { invoke, Channel } from "@tauri-apps/api/core";
import type { OllamaTransport } from "@engine/ports";
import type { OllamaChatRequest, OllamaChatChunk } from "@engine/types";

export class TauriOllama implements OllamaTransport {
  constructor(private baseUrl: string) {}

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  async chatStream(
    req: OllamaChatRequest,
    onChunk: (chunk: OllamaChatChunk) => void,
  ): Promise<void> {
    const channel = new Channel<OllamaChatChunk>();
    channel.onmessage = (msg) => onChunk(msg);
    await invoke("ollama_chat_stream", { baseUrl: this.baseUrl, body: req, onEvent: channel });
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return invoke<T>("ollama_post", { baseUrl: this.baseUrl, path, body });
  }

  async get<T = unknown>(path: string): Promise<T> {
    return invoke<T>("ollama_get", { baseUrl: this.baseUrl, path });
  }
}
