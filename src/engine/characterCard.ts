/* ============================================================
   Dragon Heart — character card interop (plan §6 portability).
   Import/export the community character-card format (TavernAI /
   SillyTavern V2): a JSON document, optionally embedded in a PNG
   `tEXt` chunk under the "chara" keyword as base64. This is a big
   adoption lever — the large existing library can be imported, and
   our characters exported back out.
   ============================================================ */

import type { SoulDocument } from "./types";
import { blankSoul } from "./soul";
import { uniqueStrings } from "./util";

export interface CardBookEntry {
  keys?: string[];
  content?: string;
  enabled?: boolean;
  case_sensitive?: boolean;
}
export interface CardData {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  tags?: string[];
  character_book?: { entries?: CardBookEntry[] };
  [k: string]: unknown;
}
export interface CardV2 {
  spec?: string;
  spec_version?: string;
  data: CardData;
}

export interface LoreDraft {
  keys: string[];
  content: string;
  enabled: boolean;
  caseSensitive: boolean;
}
export interface CharacterDraft {
  name: string;
  epithet: string;
  blurb: string;
  soul: SoulDocument;
  firstMessage: string;
  greetingDropcap: boolean;
  traits: string[];
  scenario: string;
  loreDrafts: LoreDraft[];
}

// ---------- base64 (cross-env) ----------

// atob/btoa are present in WebView2 and in Node 18+, so no Buffer fallback.
function b64decodeToString(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function b64encodeFromString(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

// ---------- PNG tEXt parsing ----------

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIG.every((b, i) => bytes[i] === b);
}

function readUint32(bytes: Uint8Array, off: number): number {
  return (
    ((bytes[off]! << 24) | (bytes[off + 1]! << 16) | (bytes[off + 2]! << 8) | bytes[off + 3]!) >>> 0
  );
}

interface Chunk {
  type: string;
  start: number; // index of length field
  dataStart: number;
  dataLen: number;
}

function readChunks(bytes: Uint8Array): Chunk[] {
  const chunks: Chunk[] = [];
  let off = 8;
  while (off + 8 <= bytes.length) {
    const len = readUint32(bytes, off);
    const type = String.fromCharCode(bytes[off + 4]!, bytes[off + 5]!, bytes[off + 6]!, bytes[off + 7]!);
    chunks.push({ type, start: off, dataStart: off + 8, dataLen: len });
    off += 12 + len; // len(4)+type(4)+data+crc(4)
    if (type === "IEND") break;
  }
  return chunks;
}

/** Extract the embedded card JSON text from a PNG's tEXt chunks, if any. */
export function extractPngCardText(bytes: Uint8Array): string | null {
  if (!isPng(bytes)) return null;
  for (const c of readChunks(bytes)) {
    if (c.type !== "tEXt") continue;
    const data = bytes.subarray(c.dataStart, c.dataStart + c.dataLen);
    const nul = data.indexOf(0);
    if (nul < 0) continue;
    const keyword = new TextDecoder().decode(data.subarray(0, nul));
    const value = new TextDecoder().decode(data.subarray(nul + 1));
    if (keyword === "chara" || keyword === "ccv3") {
      try {
        return b64decodeToString(value.trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ---------- parse ----------

function normalizeCard(obj: unknown): CardV2 | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (o.data && typeof o.data === "object") {
    return { spec: o.spec as string, spec_version: o.spec_version as string, data: o.data as CardData };
  }
  if (typeof o.name === "string") {
    return { data: o as CardData };
  }
  return null;
}

export function parseCardText(text: string): CardV2 | null {
  try {
    return normalizeCard(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Parse a card from raw file bytes (PNG-embedded or JSON). */
export function parseCardBytes(bytes: Uint8Array): CardV2 | null {
  if (isPng(bytes)) {
    const text = extractPngCardText(bytes);
    return text ? parseCardText(text) : null;
  }
  try {
    return parseCardText(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

// ---------- map card → draft ----------

export function cardToDraft(card: CardV2): CharacterDraft {
  const d = card.data;
  const soul = blankSoul();
  const parts: string[] = [];
  if (d.description?.trim()) parts.push(d.description.trim());
  if (d.personality?.trim()) parts.push(`Personality: ${d.personality.trim()}`);
  if (d.mes_example?.trim()) parts.push(`Example dialogue:\n${d.mes_example.trim()}`);
  soul.freeform = parts.join("\n\n");
  if (d.personality?.trim()) soul.voice = d.personality.trim();

  const loreDrafts: LoreDraft[] = (d.character_book?.entries ?? [])
    .map((e) => ({
      keys: uniqueStrings(e.keys ?? []),
      content: (e.content ?? "").trim(),
      enabled: e.enabled !== false,
      caseSensitive: !!e.case_sensitive,
    }))
    .filter((e) => e.content);

  const blurb = (d.creator_notes?.trim() || d.description?.trim() || "").slice(0, 240);

  return {
    name: (d.name ?? "Unnamed").trim(),
    epithet: "",
    blurb,
    soul,
    firstMessage: (d.first_mes ?? "").trim(),
    greetingDropcap: true,
    traits: uniqueStrings(d.tags ?? []),
    scenario: (d.scenario ?? "").trim(),
    loreDrafts,
  };
}

// ---------- map character → card ----------

export interface ExportSource {
  name: string;
  epithet: string;
  blurb: string;
  soulText: string; // rendered soul or freeform
  voice: string;
  firstMessage: string;
  scenario: string;
  traits: string[];
  lore: Array<{ keys: string[]; content: string; enabled: boolean; caseSensitive: boolean }>;
}

export function characterToCard(src: ExportSource): CardV2 {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: src.name,
      description: src.soulText,
      personality: src.voice,
      scenario: src.scenario,
      first_mes: src.firstMessage,
      mes_example: "",
      creator_notes: src.epithet ? `${src.epithet}. ${src.blurb}` : src.blurb,
      tags: src.traits,
      character_book: {
        entries: src.lore.map((l) => ({
          keys: l.keys,
          content: l.content,
          enabled: l.enabled,
          case_sensitive: l.caseSensitive,
        })),
      },
    },
  };
}

export function cardToJsonBytes(card: CardV2): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(card, null, 2));
}

// ---------- embed card into an existing PNG (export) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeTextChunk(keyword: string, text: string): Uint8Array {
  const body = new TextEncoder().encode(`${keyword}\0${text}`);
  const typeAndBody = new Uint8Array(4 + body.length);
  typeAndBody.set(new TextEncoder().encode("tEXt"), 0);
  typeAndBody.set(body, 4);
  const out = new Uint8Array(4 + typeAndBody.length + 4);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, body.length);
  out.set(typeAndBody, 4);
  dv.setUint32(4 + typeAndBody.length, crc32(typeAndBody));
  return out;
}

/**
 * Embed a card into a base PNG (typically the character avatar) so the exported
 * file is a portable, viewable character card. Returns a new PNG byte array.
 */
export function embedCardInPng(card: CardV2, basePng: Uint8Array): Uint8Array {
  if (!isPng(basePng)) throw new Error("Base image is not a PNG");
  const chunks = readChunks(basePng);
  const iend = chunks.find((c) => c.type === "IEND");
  const insertAt = iend ? iend.start : basePng.length;
  const textChunk = makeTextChunk("chara", b64encodeFromString(JSON.stringify(card)));
  const out = new Uint8Array(basePng.length + textChunk.length);
  out.set(basePng.subarray(0, insertAt), 0);
  out.set(textChunk, insertAt);
  out.set(basePng.subarray(insertAt), insertAt + textChunk.length);
  return out;
}
