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
import { Engine, DEFAULT_CASCADE } from "@engine/index";
import type {
  AppSettings,
  Attachment,
  CascadeConfig,
  Character,
  Conversation,
  Memory,
  Message,
  Relationship,
  RoomParticipantView,
  RoomPhase,
  RoomView,
  User,
} from "@engine/index";
import { RoomSession, type Visibility } from "./roomSession";

export type View = "welcome" | "hall" | "conversation" | "create" | "room";

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
  /* -------- gatherings (group rooms) --------
     deliberately separate from the 1:1 streaming fields: the room composer
     stays enabled while characters speak — posting mid-cascade is designed */
  rooms: Conversation[];
  currentRoomId: string | null;
  roomParticipants: RoomParticipantView[];
  roomMessages: Message[];
  roomPhase: RoomPhase;
  roomStreamingCharacterId: string | null;
  roomStreamingText: string;
}

function applyTheme(theme: "dark" | "light"): void {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", theme);
}

let tempCounter = 0;

export class AppStore {
  private state: AppState;
  private listeners = new Set<() => void>();
  private roomSession: RoomSession | null = null;

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
      rooms: [],
      currentRoomId: null,
      roomParticipants: [],
      roomMessages: [],
      roomPhase: "idle",
      roomStreamingCharacterId: null,
      roomStreamingText: "",
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.closeRoomSession());
    }
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
    let rooms: Conversation[] = [];
    if (onboarded) {
      await this.engine.seedStartersIfEmpty(STARTER_AVATARS);
      characters = await this.engine.listCharacters();
      rooms = await this.engine.listRooms();
    }

    this.set({
      ready: true,
      settings,
      theme: settings.theme,
      user: this.engine.getUser(),
      view: onboarded ? "hall" : "welcome",
      characters,
      rooms,
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
    this.closeRoomSession();
    this.set({ view: "hall", currentCharacterId: null, studioOpen: false });
  }

  gotoCreate(): void {
    this.closeRoomSession();
    this.set({ view: "create", currentCharacterId: null, studioOpen: false });
  }

  async openCharacter(id: string): Promise<void> {
    this.closeRoomSession();
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
      speakerCharacterId: null,
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

  // ---------------- gatherings (group rooms) ----------------

  async loadRooms(): Promise<void> {
    this.set({ rooms: await this.engine.listRooms() });
  }

  async createRoom(name: string, characterIds: string[]): Promise<void> {
    const room = await this.engine.createRoom(name.trim() || "The gathering", characterIds);
    await this.loadRooms();
    this.enterRoom(room);
  }

  async openRoom(roomId: string): Promise<void> {
    const room = await this.engine.openRoom(roomId);
    this.enterRoom(room);
  }

  private enterRoom(room: RoomView): void {
    this.closeRoomSession();
    this.set({
      view: "room",
      currentRoomId: room.conversation.id,
      currentCharacterId: null,
      relationship: null,
      studioOpen: false,
      roomParticipants: room.participants,
      roomMessages: room.messages,
      roomPhase: "idle",
      roomStreamingCharacterId: null,
      roomStreamingText: "",
      error: null,
    });
    const s = this.state.settings;
    const cfg: CascadeConfig = {
      ...DEFAULT_CASCADE,
      followUpBase: s.roomFollowUpBase,
      idleMs: s.roomIdleSeconds * 1000,
      idleCapMessages: s.roomIdleCapMessages,
    };
    this.roomSession = new RoomSession(room, cfg, {
      engine: this.engine,
      scheduler: {
        set: (fn, ms) => window.setTimeout(fn, ms),
        clear: (id) => window.clearTimeout(id),
      },
      visibility: domVisibility(),
      rng: Math.random,
      callbacks: {
        onPhase: (phase) => this.set({ roomPhase: phase }),
        onMessage: (message) => {
          if (message.conversationId !== this.state.currentRoomId) return;
          this.set({ roomMessages: [...this.state.roomMessages, message] });
        },
        onStreaming: (characterId, text) =>
          this.set({ roomStreamingCharacterId: characterId, roomStreamingText: text }),
        onError: (message) => this.set({ error: message }),
      },
    });
  }

  async sendRoomMessage(content: string, attachments: Attachment[] = []): Promise<void> {
    const trimmed = content.trim();
    if (!this.roomSession || (!trimmed && attachments.length === 0)) return;
    try {
      await this.roomSession.postUserMessage(trimmed, attachments);
    } catch (e) {
      this.set({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  /** Stop timers and streams; called on any navigation away from the room. */
  closeRoomSession(): void {
    this.roomSession?.dispose();
    this.roomSession = null;
    if (this.state.currentRoomId) {
      this.set({
        currentRoomId: null,
        roomParticipants: [],
        roomMessages: [],
        roomPhase: "idle",
        roomStreamingCharacterId: null,
        roomStreamingText: "",
      });
    }
  }

  async updateRoomParticipants(roomId: string, characterIds: string[]): Promise<void> {
    const current = await this.engine.openRoom(roomId);
    const present = new Set(current.participants.map((p) => p.character.id));
    const wanted = new Set(characterIds);
    for (const id of characterIds) {
      if (!present.has(id)) await this.engine.addRoomParticipant(roomId, id);
    }
    for (const id of present) {
      if (!wanted.has(id)) await this.engine.removeRoomParticipant(roomId, id);
    }
    await this.loadRooms();
    // restart the session against the new roster
    if (this.state.currentRoomId === roomId) await this.openRoom(roomId);
  }

  async renameRoom(roomId: string, name: string): Promise<void> {
    const room = await this.engine.openRoom(roomId);
    await this.engine.updateConversation({ ...room.conversation, title: name.trim() || room.conversation.title });
    await this.loadRooms();
  }

  async deleteRoom(roomId: string): Promise<void> {
    if (this.state.currentRoomId === roomId) {
      this.closeRoomSession();
      this.set({ view: "hall" });
    }
    await this.engine.deleteConversation(roomId);
    await this.loadRooms();
  }

  /** Open a participant's Studio from inside the room. */
  async openStudioFor(characterId: string): Promise<void> {
    const relationship = await this.engine.repos.ensureRelationship(
      this.state.user.id,
      characterId,
    );
    this.set({ currentCharacterId: characterId, relationship, studioOpen: true });
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

/** Visible ⇔ the document is visible AND the window has focus — in a Tauri
 *  webview, minimizing fires visibilitychange but mere focus loss does not,
 *  and the idle timer should pause for both. */
function domVisibility(): Visibility {
  let focused = typeof document !== "undefined" ? document.hasFocus() : true;
  const isVisible = () =>
    typeof document === "undefined" || (document.visibilityState === "visible" && focused);
  return {
    isVisible,
    subscribe(cb) {
      const notify = () => cb(isVisible());
      const onFocus = () => {
        focused = true;
        notify();
      };
      const onBlur = () => {
        focused = false;
        notify();
      };
      document.addEventListener("visibilitychange", notify);
      window.addEventListener("focus", onFocus);
      window.addEventListener("blur", onBlur);
      return () => {
        document.removeEventListener("visibilitychange", notify);
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("blur", onBlur);
      };
    },
  };
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
