/* ============================================================
   Dragon Heart — app store.
   A small external store (useSyncExternalStore) that owns the
   conversation flow and surfaces the Engine to screens. Studio
   panels call engine methods directly and manage their own local
   lists; the store holds the live conversation, theme, settings,
   and Ollama health.
   ============================================================ */

import React, { useContext, useSyncExternalStore } from "react";
import elaraAvatar from "@assets/elara.jpg?inline";
import jaxAvatar from "@assets/jax.jpg?inline";
import silasAvatar from "@assets/silas.jpg?inline";
import miraAvatar from "@assets/mira.jpg?inline";
import leoAvatar from "@assets/leo.jpg?inline";
import type { TauriOllama } from "@adapters/tauriOllama";
import { Engine } from "@engine/index";
import type {
  AppSettings,
  Attachment,
  Character,
  Conversation,
  Memory,
  Message,
  Relationship,
  User,
} from "@engine/index";

export type View = "welcome" | "hall" | "conversation" | "create";

/** Portraits for seeded starters, inlined as data URLs so they survive rebuilds. */
const STARTER_AVATARS: Record<string, string> = {
  "Elara Vance": elaraAvatar,
  "Jax Sterling": jaxAvatar,
  "Silas Thorne": silasAvatar,
  "Mira Chen": miraAvatar,
  "Leo Aris": leoAvatar,
};

export interface AppState {
  ready: boolean;
  view: View;
  theme: "dark" | "light";
  settings: AppSettings;
  user: User;
  characters: Character[];
  currentCharacterId: string | null;
  relationship: Relationship | null;
  conversation: Conversation | null;
  messages: Message[];
  streaming: boolean;
  streamingText: string;
  thinkingText: string;
  lastRecall: Memory[];
  studioOpen: boolean;
  ollamaOnline: boolean;
  models: string[];
  error: string | null;
}

function applyTheme(theme: "dark" | "light"): void {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", theme);
}

let tempCounter = 0;

export class AppStore {
  private state: AppState;
  private listeners = new Set<() => void>();

  constructor(
    readonly engine: Engine,
    private readonly transport: TauriOllama,
  ) {
    this.state = {
      ready: false,
      view: "welcome",
      theme: engine.getSettings().theme,
      settings: engine.getSettings(),
      user: engine.getUser(),
      characters: [],
      currentCharacterId: null,
      relationship: null,
      conversation: null,
      messages: [],
      streaming: false,
      streamingText: "",
      thinkingText: "",
      lastRecall: [],
      studioOpen: false,
      ollamaOnline: false,
      models: [],
      error: null,
    };
  }

  getState = (): AppState => this.state;
  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  currentCharacter(): Character | null {
    const id = this.state.currentCharacterId;
    return id ? this.state.characters.find((c) => c.id === id) ?? null : null;
  }

  async init(): Promise<void> {
    const settings = this.engine.getSettings();
    applyTheme(settings.theme);
    const onboarded = await this.engine.isOnboarded();

    const version = await this.engine.ollamaVersion();
    const online = !!version;
    let models: string[] = [];
    if (online) {
      try {
        models = (await this.engine.listModels()).map((m) => m.name);
      } catch {
        /* ignore */
      }
    }

    let characters: Character[] = [];
    if (onboarded) {
      await this.engine.seedStartersIfEmpty(STARTER_AVATARS);
      characters = await this.engine.listCharacters();
    }

    this.set({
      ready: true,
      settings,
      theme: settings.theme,
      user: this.engine.getUser(),
      view: onboarded ? "hall" : "welcome",
      characters,
      ollamaOnline: online,
      models,
    });
  }

  async refreshHealth(): Promise<void> {
    const version = await this.engine.ollamaVersion();
    const online = !!version;
    let models = this.state.models;
    if (online) {
      try {
        models = (await this.engine.listModels()).map((m) => m.name);
      } catch {
        /* ignore */
      }
    }
    this.set({ ollamaOnline: online, models });
  }

  async crossThreshold(name: string): Promise<void> {
    await this.engine.setUserName(name || "traveller");
    await this.engine.markOnboarded();
    await this.engine.seedStartersIfEmpty(STARTER_AVATARS);
    const characters = await this.engine.listCharacters();
    this.set({ user: this.engine.getUser(), characters, view: "hall" });
  }

  gotoHall(): void {
    this.set({ view: "hall", currentCharacterId: null, studioOpen: false });
  }

  gotoCreate(): void {
    this.set({ view: "create", currentCharacterId: null, studioOpen: false });
  }

  async openCharacter(id: string): Promise<void> {
    const view = await this.engine.openCharacter(id);
    this.set({
      currentCharacterId: id,
      relationship: view.relationship,
      conversation: view.conversation,
      messages: view.messages,
      view: "conversation",
      studioOpen: false,
      streaming: false,
      streamingText: "",
      thinkingText: "",
      lastRecall: [],
    });
  }

  async newConversation(): Promise<void> {
    if (!this.state.relationship) return;
    const view = await this.engine.newConversation(this.state.relationship.id);
    this.set({ conversation: view.conversation, messages: view.messages, lastRecall: [], thinkingText: "" });
  }

  async sendMessage(content: string, attachments: Attachment[] = []): Promise<void> {
    const conv = this.state.conversation;
    if (!conv || this.state.streaming) return;
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;

    const tempUser: Message = {
      id: `temp-${++tempCounter}`,
      conversationId: conv.id,
      role: "user",
      content: trimmed,
      attachments,
      tokens: 0,
      createdAt: Date.now(),
      summarized: false,
    };
    this.set({
      messages: [...this.state.messages, tempUser],
      streaming: true,
      streamingText: "",
      thinkingText: "",
      lastRecall: [],
      error: null,
    });

    try {
      const res = await this.engine.send(conv.id, trimmed, attachments, {
        onToken: (_d, full) => this.set({ streamingText: full }),
      });
      const base = this.state.messages.filter((m) => m.id !== tempUser.id);
      this.set({
        messages: [...base, res.user, res.assistant],
        streaming: false,
        streamingText: "",
        thinkingText: res.thinking,
        lastRecall: res.diagnostics.recalledMemories,
      });
    } catch (e) {
      this.set({
        streaming: false,
        streamingText: "",
        messages: this.state.messages.filter((m) => m.id !== tempUser.id),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  toggleStudio(): void {
    this.set({ studioOpen: !this.state.studioOpen });
  }
  setStudioOpen(v: boolean): void {
    this.set({ studioOpen: v });
  }

  async setTheme(theme: "dark" | "light"): Promise<void> {
    applyTheme(theme);
    this.set({ theme });
    await this.engine.updateSettings({ theme });
    this.set({ settings: this.engine.getSettings() });
  }

  async refreshCharacters(): Promise<void> {
    this.set({ characters: await this.engine.listCharacters() });
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<void> {
    const s = await this.engine.updateSettings(patch);
    if (patch.ollamaBaseUrl) this.transport.setBaseUrl(s.ollamaBaseUrl);
    this.set({ settings: s });
    if (patch.theme) {
      applyTheme(s.theme);
      this.set({ theme: s.theme });
    }
  }

  /** Re-pull the current relationship after a Studio edit. */
  async refreshRelationship(): Promise<void> {
    if (!this.state.relationship) return;
    const r = await this.engine.getRelationship(this.state.relationship.id);
    if (r) this.set({ relationship: r });
  }

  /** Update the current conversation in state after a Studio edit. */
  setConversation(conversation: Conversation): void {
    this.set({ conversation });
  }

  async setUserName(name: string): Promise<void> {
    await this.engine.setUserName(name);
    this.set({ user: this.engine.getUser() });
  }

  /** Create a character, refresh the circle, and step into the conversation. */
  async createAndOpen(characterId: string): Promise<void> {
    await this.refreshCharacters();
    await this.openCharacter(characterId);
  }

  clearError(): void {
    this.set({ error: null });
  }
}

// ---------------- React glue ----------------

export const StoreContext = React.createContext<AppStore | null>(null);

export function useStore(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("AppStore not provided");
  return store;
}

export function useAppState(): AppState {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}
