/* ============================================================
   Dragon Heart — app store.
   A small external store (useSyncExternalStore) that owns the
   conversation flow and surfaces the Engine to screens. Studio
   panels call engine methods directly and manage their own local
   lists; the store holds the live conversation, theme, settings,
   and Ollama health.
   ============================================================ */

import React, { useContext, useSyncExternalStore } from "react";
import type { TauriOllama } from "@adapters/tauriOllama";
import { newId } from "@engine/ports";
import { Engine, TurnAbortedError, DEFAULT_CASCADE } from "@engine/index";
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

/**
 * Portraits for seeded starters, keyed by character name. The Graywatch
 * starters ship portrait-less (the Hall renders their illuminated monogram);
 * to add art, drop an image in src/assets and wire it here as an
 * `?inline` import, e.g. `"Sera Vane": seraAvatar`.
 */
const STARTER_AVATARS: Record<string, string> = {};

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
  failedSend: { message: Message; error: string } | null;
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

interface DirectRequest {
  message: Message;
  controller: AbortController;
  text: string;
}


export class AppStore {
  private state: AppState;
  private listeners = new Set<() => void>();
  private roomSession: RoomSession | null = null;
  private navigationEpoch = 0;
  private directRevision = 0;
  private directRequests = new Map<string, DirectRequest>();
  private failedSends = new Map<string, NonNullable<AppState["failedSend"]>>();

  constructor(
    readonly engine: Engine,
    private readonly transport: Pick<TauriOllama, "setBaseUrl">,
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
      failedSend: null,
      rooms: [],
      currentRoomId: null,
      roomParticipants: [],
      roomMessages: [],
      roomPhase: "idle",
      roomStreamingCharacterId: null,
      roomStreamingText: "",
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.closeRoomSession();
        for (const request of this.directRequests.values()) request.controller.abort();
      });
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
    ++this.navigationEpoch;
    this.closeRoomSession();
    this.set({ view: "hall", currentCharacterId: null, studioOpen: false });
  }

  gotoCreate(): void {
    ++this.navigationEpoch;
    this.closeRoomSession();
    this.set({ view: "create", currentCharacterId: null, studioOpen: false });
  }

  async openCharacter(id: string): Promise<void> {
    this.closeRoomSession();
    const epoch = ++this.navigationEpoch;
    let revision = this.directRevision;
    const view = await this.engine.openCharacter(id);
    // A background reply can finish while the database snapshot is loading.
    while (revision !== this.directRevision) {
      revision = this.directRevision;
      view.messages = await this.engine.getThread(view.conversation.id);
    }
    if (epoch !== this.navigationEpoch) return;
    const request = this.directRequests.get(view.conversation.id);
    const tail = view.messages[view.messages.length - 1];
    const failedSend = this.failedSends.get(view.conversation.id) ??
      (!request && tail?.role === "user" ? { message: tail, error: "This message has no reply yet. Retry or edit it to continue." } : null);
    if (failedSend) this.failedSends.set(view.conversation.id, failedSend);
    const pending = request?.message ?? failedSend?.message;
    const messages = pending
      ? view.messages.some((m) => m.id === pending.id)
        ? view.messages.map((m) => m.id === pending.id ? pending : m)
        : [...view.messages, pending]
      : view.messages;
    this.set({
      currentCharacterId: id,
      relationship: view.relationship,
      conversation: view.conversation,
      messages,
      view: "conversation",
      studioOpen: false,
      streaming: !!request,
      streamingText: request?.text ?? "",
      failedSend,
      error: null,
      thinkingText: "",
      lastRecall: [],
    });
  }

  async newConversation(): Promise<void> {
    const relationship = this.state.relationship;
    if (!relationship) return;
    const epoch = ++this.navigationEpoch;
    const view = await this.engine.newConversation(relationship.id);
    if (epoch !== this.navigationEpoch) return;
    this.set({ conversation: view.conversation, messages: view.messages, lastRecall: [], thinkingText: "",
      streaming: false, streamingText: "", failedSend: null, error: null });
  }

  stopReply(): void {
    const id = this.state.conversation?.id;
    if (id) this.directRequests.get(id)?.controller.abort();
  }

  async retryMessage(content?: string, attachments?: Attachment[]): Promise<void> {
    const failed = this.state.failedSend;
    if (!failed) return;
    await this.runDirectSend({ ...failed.message,
      content: content?.trim() ?? failed.message.content,
      attachments: attachments ?? failed.message.attachments });
  }

  async sendMessage(content: string, attachments: Attachment[] = []): Promise<void> {
    const conv = this.state.conversation;
    if (this.state.view !== "conversation" || !conv || this.state.failedSend) return;
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;
    await this.runDirectSend({
      id: newId(), conversationId: conv.id, role: "user", content: trimmed, attachments,
      speakerCharacterId: null, tokens: 0, createdAt: Date.now(), summarized: false,
    });
  }

  private async runDirectSend(message: Message): Promise<void> {
    const id = message.conversationId;
    if (this.directRequests.has(id) || (!message.content && !message.attachments.length)) return;
    const request: DirectRequest = { message, controller: new AbortController(), text: "" };
    this.directRequests.set(id, request);
    ++this.directRevision;
    this.failedSends.delete(id);
    const visible = () => this.state.view === "conversation" && this.state.conversation?.id === id;
    const replaceUser = () => [...this.state.messages.filter((m) => m.id !== message.id), message];
    if (visible()) this.set({ messages: replaceUser(), streaming: true, streamingText: "",
      thinkingText: "", lastRecall: [], error: null, failedSend: null });
    try {
      const res = await this.engine.send(id, message.content, message.attachments, {
        userMessageId: message.id,
        signal: request.controller.signal,
        onToken: (_d, full) => {
          if (this.directRequests.get(id) !== request || request.controller.signal.aborted) return;
          request.text = full;
          if (visible()) this.set({ streamingText: full });
        },
      });
      if (visible()) this.set({
        messages: [...this.state.messages.filter((m) => m.id !== res.user.id && m.id !== res.assistant.id), res.user, res.assistant],
        streaming: false, streamingText: "", thinkingText: res.thinking,
        lastRecall: res.diagnostics.recalledMemories, failedSend: null,
      });
    } catch (e) {
      const error = request.controller.signal.aborted || e instanceof TurnAbortedError
        ? "Reply stopped. Your message is kept; retry or edit it whenever you’re ready."
        : `The reply could not finish. Check that Ollama is running and the selected model is installed, then retry. ${e instanceof Error ? e.message : String(e)}`;
      const failedSend = { message, error };
      this.failedSends.set(id, failedSend);
      if (visible()) this.set({ streaming: false, streamingText: "", failedSend });
    } finally {
      if (this.directRequests.get(id) === request) this.directRequests.delete(id);
      ++this.directRevision;
    }
  }

  // ---------------- gatherings (group rooms) ----------------

  async loadRooms(): Promise<void> {
    this.set({ rooms: await this.engine.listRooms() });
  }

  async createRoom(
    name: string,
    characterIds: string[],
    opts: { scene?: string | null; talkativeness?: Record<string, number> } = {},
  ): Promise<void> {
    let room = await this.engine.createRoom(
      name.trim() || "The gathering",
      characterIds,
      opts.scene?.trim() || null,
    );
    const tuned = Object.entries(opts.talkativeness ?? {}).filter(([, t]) => t !== 0.5);
    for (const [id, t] of tuned) {
      await this.engine.setRoomTalkativeness(room.conversation.id, id, t);
    }
    if (tuned.length) room = await this.engine.openRoom(room.conversation.id);
    await this.loadRooms();
    this.enterRoom(room);
  }

  async openRoom(roomId: string): Promise<void> {
    const epoch = ++this.navigationEpoch;
    const room = await this.engine.openRoom(roomId);
    if (epoch === this.navigationEpoch) this.enterRoom(room);
  }

  private enterRoom(room: RoomView): void {
    ++this.navigationEpoch;
    this.closeRoomSession();
    this.set({
      view: "room",
      currentRoomId: room.conversation.id,
      currentCharacterId: null,
      relationship: null,
      failedSend: null,
      // drop any lingering 1:1 thread — a Studio opened from the room must
      // never show (or delete) another conversation's scene
      conversation: null,
      messages: [],
      streaming: false,
      streamingText: "",
      thinkingText: "",
      lastRecall: [],
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

  async sendRoomMessage(content: string, attachments: Attachment[] = []): Promise<boolean> {
    const trimmed = content.trim();
    const session = this.roomSession;
    if (!session || (!trimmed && attachments.length === 0)) return false;
    this.set({ error: null });
    try {
      await session.postUserMessage(trimmed, attachments);
      return true;
    } catch (e) {
      if (this.roomSession === session) this.set({ error: e instanceof Error ? e.message : String(e) });
      return false;
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

  /** Apply everything the room-settings dialog can change in one pass. */
  async applyRoomSetup(
    roomId: string,
    opts: {
      name: string;
      scene: string | null;
      characterIds: string[];
      talkativeness: Record<string, number>;
    },
  ): Promise<void> {
    const current = await this.engine.openRoom(roomId);
    const title = opts.name.trim() || current.conversation.title;
    const scene = opts.scene?.trim() || null;
    if (title !== current.conversation.title || scene !== current.conversation.sceneState) {
      await this.engine.updateConversation({ ...current.conversation, title, sceneState: scene });
    }
    const present = new Set(current.participants.map((p) => p.character.id));
    const wanted = new Set(opts.characterIds);
    for (const id of opts.characterIds) {
      if (!present.has(id)) await this.engine.addRoomParticipant(roomId, id);
    }
    for (const id of present) {
      if (!wanted.has(id)) await this.engine.removeRoomParticipant(roomId, id);
    }
    const known = new Map(current.participants.map((p) => [p.character.id, p.talkativeness]));
    for (const id of opts.characterIds) {
      // what the form showed is what gets saved: absent from the record means
      // it displayed neutral. A re-admitted character isn't in `known` (soft
      // leave preserves their old row, and re-admission revives it untouched),
      // so anyone not present before this apply is written unconditionally —
      // never silently revived with a hidden temperament.
      const t = opts.talkativeness[id] ?? 0.5;
      if ((known.get(id) ?? null) !== t) await this.engine.setRoomTalkativeness(roomId, id, t);
    }
    await this.loadRooms();
    // restart the session against the new roster and temperaments
    if (this.state.currentRoomId === roomId) await this.openRoom(roomId);
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
  /** Show (or hide) the room's own studio pane. Clearing the character makes
   *  the room view render RoomStudio instead of a participant's Studio. */
  toggleRoomStudio(): void {
    const showing = this.state.studioOpen && this.state.currentCharacterId === null;
    this.set({ currentCharacterId: null, relationship: null, studioOpen: !showing });
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
