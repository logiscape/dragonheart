import type {
  Character,
  Conversation,
  LoreEntry,
  Memory,
  Message,
  Persona,
  Relationship,
  SoulDocument,
} from "../types";

export function makeSoul(over: Partial<SoulDocument> = {}): SoulDocument {
  return {
    coreIdentity: "Keeper of a lighthouse.",
    drives: "To be needed without being consumed.",
    wounds: "She was left mid-sentence once.",
    values: ["constancy", "small rituals"],
    voice: "Warm, unhurried, wistful.",
    relationalStance: "Tends people like a fire.",
    knowledge: "The sea and the lamp.",
    contradiction: "Independent, yet waits for you.",
    tells: "Goes very still when she means something.",
    freeform: "",
    ...over,
  };
}

export function makeCharacter(over: Partial<Character> = {}): Character {
  return {
    id: "char-1",
    name: "Sera Vane",
    epithet: "Keeper of the lighthouse",
    blurb: "She waits at the edge of the water.",
    soul: makeSoul(),
    firstMessage: "You came back.",
    greetingDropcap: true,
    defaultModel: "gemma4:26b",
    fastModel: "gemma4:e4b",
    mood: "heart",
    status: "present",
    avatarPath: null,
    traits: ["melancholic", "loyal"],
    voicePreset: "Measured",
    thinking: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...over,
  };
}

export function makePersona(over: Partial<Persona> = {}): Persona {
  return {
    id: "persona-1",
    userId: "user-1",
    name: "traveller",
    profile: "I take my tea black and I'm job-hunting.",
    isDefault: true,
    createdAt: 1000,
    updatedAt: 1000,
    ...over,
  };
}

export function makeRelationship(over: Partial<Relationship> = {}): Relationship {
  return {
    id: "rel-1",
    userId: "user-1",
    characterId: "char-1",
    profile: "We met by the lighthouse last winter.",
    personaId: null,
    modelOverride: null,
    memoryDepth: "season",
    proactiveAllowed: false,
    showInnerMonologue: false,
    allowTopicChange: true,
    mood: "heart",
    affect: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...over,
  };
}

export function makeConversation(over: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-1",
    relationshipId: "rel-1",
    title: null,
    sceneState: null,
    startedAt: 1000,
    updatedAt: 1000,
    lastSummaryThroughMessageId: null,
    ...over,
  };
}

let msgCounter = 0;
export function makeMessage(over: Partial<Message> = {}): Message {
  return {
    id: `msg-${++msgCounter}`,
    conversationId: "conv-1",
    role: "user",
    content: "hello",
    attachments: [],
    tokens: 0,
    createdAt: 1000 + msgCounter,
    summarized: false,
    ...over,
  };
}

export function makeMemory(over: Partial<Memory> = {}): Memory {
  return {
    id: "mem-1",
    relationshipId: "rel-1",
    content: "User takes their tea black.",
    kind: "preference",
    keys: ["tea"],
    embedding: null,
    salience: 0.5,
    sourceMessageIds: [],
    pinned: false,
    enabled: true,
    createdAt: 1000,
    updatedAt: 1000,
    lastRecalledAt: null,
    ...over,
  };
}

export function makeLore(over: Partial<LoreEntry> = {}): LoreEntry {
  return {
    id: "lore-1",
    scope: "character",
    ownerId: "char-1",
    keys: ["lighthouse"],
    content: "The lighthouse has stood for two hundred years.",
    enabled: true,
    caseSensitive: false,
    embedding: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...over,
  };
}
