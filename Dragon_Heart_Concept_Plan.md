# Concept Plan: A Local AI Character Companion App

*A Windows desktop application for warm, persistent conversations with characters who have distinct, believable personalities — powered locally by Ollama and Gemma 4.*

Working title: Project Dragon Heart — referred to here as "the app."

---

## 1. Vision & Design Philosophy

The goal is not a better chatbot. It is a different *kind* of thing.

Tools like Open WebUI are excellent, but they are productivity surfaces: a model dropdown, a blank prompt box, a "regenerate" button, a "copy code" affordance. The implicit metaphor is *querying a system*. Everything about the interface tells the user they are operating a machine that produces output on demand.

This app inverts that metaphor. The implicit model is *being in a relationship with someone*. The user is not issuing queries; they are talking to a character who exists between sessions, remembers them, has a stable interior life, and responds out of who they are rather than out of a task specification.

Concretely, "warm and personal rather than productivity-driven" decomposes into a few design commitments:

- **The character has presence, not just output.** They greet, they initiate, they have moods and continuity. The first thing the user sees is the character, not an empty prompt box.
- **The character has interiority.** The Soul Document defines *who they are at a subconscious level* — drives, wounds, values, contradictions — not a job description ("you are a helpful assistant that…"). Behavior emerges from identity rather than from instructions.
- **The relationship persists and evolves.** What the user and a character have built up — shared history, inside references, the texture of how they relate — survives across sessions and is felt in the conversation.
- **The interface recedes.** Productivity affordances (regenerate, edit-the-model's-words, raw parameter sliders) are de-emphasized or hidden, because they break the illusion of talking to a person. Power-user controls exist but live behind a "studio" surface, not in the conversation.

The productivity-tool ecosystem is the wrong reference class for the *experience*, even though it is the right reference class for the *plumbing*. The app should borrow Open WebUI's and Ollama's technical maturity while taking its experiential cues from character-driven tools like SillyTavern and from messaging apps.

---

## 2. Reference Landscape (What to Borrow, What to Avoid)

Three existing systems define the design space. Each contributes something; none is the target.

### Ollama (the engine)
The local inference layer. Mature, cross-platform, ships a native Windows desktop app, exposes a REST API on `localhost:11434` and an OpenAI-compatible endpoint. Recent versions added a web search API, function/tool calling, and concurrent multi-session support — the last of which matters directly for the multi-character long-term vision. **Borrow:** all of it, as the backend. The app is a client of Ollama, not a reimplementation.

### Open WebUI (the technological proof-of-concept)
Demonstrates that almost everything needed at a *plumbing* level already works: model presets that bind a system prompt + tools + knowledge to a base model, a per-user "memory" feature that injects personal details, web search integration, native function calling, and — notably for the long-term vision — **collaborative spaces ("Channels")** where humans and multiple AI models participate in one shared timeline and can be @-mentioned. **Borrow:** the preset/wrapper concept, the memory-injection concept, the shared-timeline concept. **Avoid:** the productivity framing, the ChatGPT-clone UI, and the "every agent is a thin config wrapper" mindset — characters need more interiority than a system-prompt field.

Note one practical flag: Open WebUI's licensing changed in a way that matters for team/commercial redistribution. If any Open WebUI code or assets are ever used as more than conceptual reference, the current license terms need checking before distribution.

### SillyTavern (the closest experiential cousin)
This is the most important reference for *what you are actually building*. It is the dominant local-LLM frontend for character-driven conversation, and it has already solved several problems you are about to hit:

- **Character Cards** — a portable file (PNG/JSON) bundling name, description, personality, first message, scenario, and lore. This is the direct ancestor of your Soul Document, plus packaging.
- **Lorebook / World Info** — a keyword-triggered context-injection system. Entries fire into the prompt *only when their keywords appear in conversation*, so you don't front-load everything into the system prompt. Lorebooks can be bound to a specific **character, persona, or individual chat**. This is precisely the mechanism your "global vs. per-relationship info" requirement calls for.
- **Persona management** — the user's own identity, separate from the characters'.
- **Group chats** — multiple characters in one conversation. The direct precursor of your long-term vision.

The well-documented SillyTavern failure mode is instructive: a character defined *only* by a static card feels alive for ~3 messages and flat by ~30, because a fixed block of personality text doesn't surface the right detail at the right moment. The fix is layered, *triggered* context rather than one monolithic prompt. The architecture below is built around that lesson.

**Borrow:** character cards, the lorebook trigger mechanism, persona separation, group chat. **Avoid:** the punishing onboarding, the roleplay-forum aesthetic, the assumption that the user wants to manage 28 expression sprites and edit raw prompt templates. Your differentiator is making this depth feel warm and effortless.

---

## 3. Technology Foundation

### Inference: Ollama + Gemma 4

Gemma 4 (released April 2, 2026, Apache 2.0, multimodal, 140+ languages) is a strong default for this use case for three specific reasons beyond general quality:

1. **Native system-role support.** Unlike Gemma 3 — which had no system role and forced you to fold personality text into the first user turn — Gemma 4 supports `system`/`user`/`assistant` natively. A Soul-Document-driven app lives or dies on system-prompt fidelity, so this is a material fit.
2. **Configurable thinking.** Thinking is toggled by including a `<|think|>` control token at the start of the system prompt. You can keep it *off* for warm, low-latency conversational turns and switch it *on* selectively (e.g., when a character must reason about a game move or a tool call) without changing models.
3. **Native function calling.** First-class tool support is essential for the long-term game/agentic vision, and means the conversational model and the tool-using model are the same model.

**Variant selection for your hardware (RTX 5080, 16 GB VRAM, 64 GB system RAM):**

| Variant | Type | Rough footprint | Fit on your rig |
|---|---|---|---|
| `gemma4:e2b` | Effective 2B | smallest | trivially fits; too light for rich character voice |
| `gemma4:e4b` | Effective 4B (default) | ~9.6 GB | fits comfortably in 16 GB; fast; good fallback / concurrent-character model |
| `gemma4:26b` | 26B MoE (~4B active) | targets 24 GB GPU | **partial offload** on 16 GB — spills layers to your 64 GB RAM |
| `gemma4:31b` | 31B dense | largest | heaviest offload; slowest on 16 GB |

Your instinct to default to `gemma4:26b` is sound for quality, with one caveat: at Q4 it's sized for a 24 GB card, so on the 5080 it will offload some layers to system RAM. Because it's an MoE with only ~4B active parameters per token, the offload penalty is more tolerable than it would be for a dense 26B, but expect a throughput hit versus E4B. A sensible product behavior is **tiered models**: `gemma4:26b` as the default "main" character model for one-on-one depth, and `gemma4:e4b` available as a fast model for (a) low-latency casual chat and (b) running *multiple* characters concurrently in the long-term group scenarios, where VRAM becomes the binding constraint.

**The context-window gotcha, productized.** Ollama silently defaults Gemma 4 to a 4K context window despite its 128K–256K capacity. For this app that default is fatal — relationships need long memory. The app must explicitly set `num_ctx` (via Modelfile or per-request options) and should treat context length as a managed budget, not an afterthought. A practical default of 16K–32K balances memory against VRAM/RAM; expose it as an advanced setting.

Other useful Ollama capabilities to design around: the OpenAI-compatible endpoint (lets you swap in cloud models later without rewriting the client), concurrent sessions (multi-character), Flash Attention via `OLLAMA_FLASH_ATTENTION=1` (helps long-context throughput on NVIDIA), and the web search API (a character could "look something up" in-character).

### Application stack

The app is fundamentally a **client**: it assembles prompts, manages character/relationship/memory state, talks to Ollama over HTTP, and renders a warm chat UI. The heavy compute lives in Ollama. So the stack choice is about UI quality, distribution, and your own velocity.

Desktop App:

- **Tauri (Rust core + web frontend).** Lightweight binaries, modern, good Windows story, web UI skills transfer. Rust for the thin native shell is a learning cost but the surface area is small (mostly IPC + file/db access).

The pragmatic note is that *the entire "backend" of this app is HTTP calls to `localhost:11434` plus local state management*. A defensible pattern: keep the prompt-assembly/memory/character "engine" as a clean, well-typed module (TS or Rust) with no UI dependencies, so the desktop shell is swappable and the same engine could later back a different surface (web, or even a PHP-hosted service for a shared multi-user deployment). For data, **SQLite** is the right local store — characters, users, relationships, conversations, and memories are all relational and benefit from queryability over flat files.

---

## 4. Core Architecture: The Layered Context Model

This is the technical heart of the app and the thing that most distinguishes it from "system prompt = personality" tools. Every turn, the app composes the model's context from distinct, independently managed layers. This directly answers your global-vs-relationship requirement and pre-empts the SillyTavern "flat by message 30" failure.

The composed context, in order:

1. **Soul Document** *(per character, always present)* — the character's stable interior identity. Always in the system prompt.
2. **Global User Profile** *(per user, always present)* — who the user is, across all characters. Always in the system prompt.
3. **Relationship Layer** *(per user × character, present only with this character)* — facts and dynamics specific to *this* pairing: how they met, the nature of the bond, things this character knows about the user that others don't. Injected only when the user is talking to this character.
4. **Triggered Context (Lorebook)** *(keyword-activated)* — memories, world facts, backstory, and relationship details that fire into context *only when relevant*, keyed by what's being discussed. Solves token bloat and the "flatness" problem by surfacing the right detail at the right moment instead of front-loading everything.
5. **Scene / Scenario State** *(per conversation, optional)* — the current situation or setting, if the conversation has a frame ("you're catching up over coffee," or a game scene).
6. **Conversation History** — recent turns, within the `num_ctx` budget, with older history summarized into memory (see §5).
7. **Control tokens** — Gemma 4's `<|think|>` toggled per the turn's needs.

A schematic of one assembled request:

```
SYSTEM:
  [<|think|> if reasoning needed]
  <soul>            ← layer 1: the character's identity
  <about_user>      ← layer 2: global user profile
  <relationship>    ← layer 3: this specific bond
  <relevant_lore>   ← layer 4: triggered entries (memories/world facts)
  <scene>           ← layer 5: current situation (if any)

MESSAGES:
  ...summarized older history...   ← layer 6
  ...recent verbatim turns...
  user: <new message>
```

The key insight is that **layers 2, 3, and 4 are exactly your stated requirements**, formalized:
- "Information about themselves, global for all characters" = **Layer 2**.
- "Details that define the relationship between the user and a character, appended only for that character" = **Layer 3**.
- And the lorebook mechanism (**Layer 4**) is what keeps both of the above from bloating into an unwieldy wall of text — the global profile and relationship layer hold the *always-true essentials*, while situational detail lives in triggered entries.

---

## 5. Memory & Relationship Persistence

A persistent relationship requires memory beyond the context window. Two tiers:

**Short-term (in-context).** Recent conversation turns, kept verbatim within the `num_ctx` budget. Gemma 4's large window is generous here, but it is still finite and costs VRAM/RAM, so it is a managed budget, not "everything forever."

**Long-term (out-of-context, re-injected).** As conversations grow, older turns are distilled into durable **memories** and stored against the relationship. Two complementary mechanisms:

- **Summarization rollup.** Periodically (by turn count or token threshold), summarize the oldest in-context turns into a compact memory record, freeing context while preserving substance. A background pass — using the same local model — can extract salient facts ("user mentioned their sister is getting married," "we agreed to call her by a nickname").
- **Retrieval / triggered recall.** Stored memories become lorebook-style entries (keyword- or embedding-triggered) that re-enter context when relevant. For semantic recall, a local embedding model (servable via Ollama) plus a vector index over memories gives "the character remembers something from three weeks ago because it's relevant now" — the single biggest contributor to the *feeling* of a real relationship.

Memory should be **inspectable and editable** by the user (in the studio surface), both because it builds trust and because letting users curate what a character "knows" is itself a warm, ownership-building feature. It also matters for correctness — automatic extraction will make mistakes, and a user who can fix "no, my sister's wedding was *called off*" keeps the relationship coherent.

### Data model (sketch)

```
character        (id, name, soul_document, default_model, voice/avatar, created_at)
character_lore   (id, character_id, keys[], content, scope, enabled)      -- layer 4, char-bound
user             (id, display_name, global_profile)                        -- layer 2
relationship     (id, user_id, character_id, relationship_profile, ...)    -- layer 3
relationship_lore(id, relationship_id, keys[], content, enabled)           -- layer 4, relationship-bound
conversation     (id, relationship_id, scene_state, started_at)
message          (id, conversation_id, role, content, created_at, tokens)
memory           (id, relationship_id, content, embedding, salience, source_msg_ids[], created_at)
```

Note `character_lore` vs `relationship_lore`: lore can be bound at the character level (true of the character for everyone) or the relationship level (true only of this user's bond with them) — mirroring SillyTavern's character/persona/chat binding scopes, mapped onto your global/relationship distinction.

---

## 6. The Soul Document

Your Soul Document concept is the right primitive; this section formalizes it so it's authorable, portable, and consistent.

**Principle:** a Soul Document describes *who the character is*, from which behavior emerges — not *what the character should do*. The distinction is the difference between "You are warm, curious, and a little guarded because you were let down by people you trusted; you test new people before you open up" (identity → emergent behavior) and "Be friendly and ask follow-up questions" (instruction → mechanical behavior). Gemma 4 is good at the former when given rich material.

**Suggested structure** (a schema, not a straitjacket — authors write prose within it):

- **Core identity** — name, essential self-concept, the one-line truth of who they are.
- **Drives & needs** — what they want at a deep level; what they're moving toward and away from.
- **Wounds & fears** — what shaped them; what they protect; their contradictions. (This is what makes characters feel real rather than pleasant.)
- **Values** — what they will and won't do; their lines.
- **Voice** — how they actually talk: rhythm, vocabulary, humor, tics, what they're verbose vs. terse about. Concrete sample lines help enormously.
- **Relational stance** — how they treat people generally (the per-user specifics live in the relationship layer, not here).
- **Knowledge & world** — what they know and don't; the world they live in (detailed background goes to lorebook entries, not the always-on document).

**Authoring tooling.** Two on-ramps, because Soul Documents are the hardest and most valuable artifact in the app:
- A **guided creator** that interviews the author (or generates a draft from a sketch using the local model) and assembles a structured document.
- A **free-form editor** for power users, with a token budget readout (a Soul Document that's too long crowds out conversation and memory).

**Portability.** Adopt or interoperate with the existing character-card format (PNG/JSON with embedded metadata) so the large community library of characters can be imported and your characters exported. This is a significant adoption lever and costs little.

A built-in **persona test harness** (run the same probe conversations against a character after edits) would suit your hypothesis-driven style and double as the benchmark surface you already like to build — the same way you produced an obfuscated GD script as a model benchmark, a fixed battery of "soul probes" lets you measure whether an edit made a character more themselves or less.

---

## 7. User & Relationship Model

Three distinct identity surfaces, kept separate:

- **The user's global profile (Layer 2).** Authored once, applies everywhere: name/how they like to be addressed, broad context they want every character to know, tone preferences, hard boundaries. Always injected.
- **The relationship profile (Layer 3).** Per character. How this pairing works: the bond's nature, history, in-jokes, what this character uniquely knows. Injected only with that character. This is also where *asymmetry* lives — one character might know the user is job-hunting; another might not.
- **Personas (optional power feature).** The user may want to present differently to different characters (a playful persona with one, a professional one with another). Supporting multiple user personas, selectable per relationship, generalizes Layer 2 — most users use one, power users use several.

Editing surfaces for all three belong in the studio, not the chat. But changes should be *felt* immediately in conversation — if the user tells a character something important in-chat, the app should offer to promote it into the relationship profile or a memory ("Want me to remember that?"), closing the loop between talking and the persistent model without forcing the user into forms.

---

## 8. Conversational Experience Design

Where the "warmth" is actually delivered. Principles:

- **Open on the character, not a blank box.** A character's first message (authored, or generated from their soul + relationship state) greets the user. Returning to a conversation feels like resuming, not starting.
- **Messaging-app feel.** Typing indicators, natural pacing, the option for the character to send more than one message or to message *first* (proactive presence — see below). The visual language is "conversation with a person," not "console with output."
- **Demote productivity affordances.** No prominent regenerate/edit-the-character's-words/parameter sliders in the conversation. They exist in a long-press or studio menu. Every visible "operate the machine" control erodes the illusion.
- **Continuity cues.** Subtle surfacing of shared history — the character references a prior conversation, a remembered detail, an inside reference. This is the *payoff* of the memory system and should be made legible enough that the user notices the character remembered.
- **Mood & state (optional).** A character can carry a lightweight emotional state across a conversation (and faintly across sessions), nudging tone. Kept subtle to avoid gimmickry.
- **Proactive presence (later).** With permission, a character could initiate — a message when the user opens the app, an occasional check-in. This is the strongest "this is a relationship, not a tool" signal and also the easiest to make creepy or manipulative, so it must be user-controlled, transparent, and never engineered to maximize engagement. (See §11.)
- **Multimodality.** Gemma 4 is multimodal; the user can share an image and the character can react in-character. Voice (TTS for the character, STT for the user) is a high-impact warmth multiplier and a natural later addition.

---

## 9. Tooling & MCP Integration

Even though v1 is conversational, the architecture should treat tools as first-class from the start, because the long-term vision (characters acting, playing games, doing things in shared spaces) is fundamentally agentic — and because you own infrastructure that fits perfectly here.

Gemma 4 has native function calling, and Ollama exposes tool calling through its API. The clean design is to expose the app's capabilities to characters as **MCP tools**, with an MCP server acting as the tool-provider layer between characters and whatever they can do (game actions, memory operations, web search, shared-space actions). This is exactly the role you identified for `logiscape/mcp-sdk-php` in your Fallout companion concept: the SDK's `McpServer` wrapper over a Streamable HTTP transport becomes the game-/app-tool layer, and characters' function calls route through it.

Designing for this early means:
- Tool calls are part of the turn loop, not bolted on later.
- Characters have a *defined, per-character toolset* — what a character can do is part of who they are (a "game master" character has world-manipulation tools; a casual companion doesn't).
- Tool use can be made *in-character* and visible as narrative ("she pulls up the map") rather than as raw JSON, preserving warmth even when machinery runs underneath.

This also keeps the whole system within your existing competence and assets: PHP/HTTP services, MCP, and an SDK you maintain.

---

## 10. Long-Term Vision: Multi-Character & Shared Spaces

The architecture above is deliberately built so the long-term vision is an extension, not a rewrite.

**Character-to-character conversation.** Group chat is a turn-orchestration problem on top of the existing per-character context assembly: a director/orchestrator decides who "speaks" next and assembles *that* character's layered context (their soul, their relationship to the user *and* to the other characters present, relevant lore, shared scene). Each character still gets their own composed context; the orchestrator manages turn-taking, addressing, and interruption. SillyTavern's group chat and Open WebUI's shared-timeline Channels are both existence proofs that this works; the novelty here is doing it with full Soul-Document interiority per participant. The binding constraint is VRAM — running several rich characters concurrently is why tiered models (E4B for ensemble members, 26B for the focal character) and Ollama's concurrent-session support matter.

**Discord-like shared spaces.** Generalize the conversation from "user ↔ one character" to "a room with N participants (users and characters) and a shared timeline." Participants are @-addressable; characters perceive the room state and each other. This is the same orchestration engine with a room abstraction and presence on top. The relationship model extends naturally: characters now hold relationships *with each other*, not only with the user.

**Shared games & activities.** This is where MCP tooling pays off fully. A game is a set of tools and a shared state object; characters and users act on it through tool calls, and characters narrate and react in-character. Your minimal-LLM-involvement instinct from the Fallout concept (LLM as intent classifier mapping speech to predefined tool calls, preserving authored content) is the right discipline here too — let the structured game logic live in tools and state, and use the model for personality, intent, and narration rather than for simulating the whole world. That keeps it tractable on local hardware and keeps characters consistent.

**Phasing.** Build the room/orchestration abstraction's *seams* early (don't hardcode "one user, one character" assumptions into the data model or context assembler), even though v1 ships only one-on-one.

---

## 11. Phased Roadmap

**Phase 0 — Engine spine.** Ollama client (with `num_ctx` handled correctly), the layered context assembler, SQLite data model, basic Gemma 4 conversation loop. No frills. Prove that a Soul Document + global profile produces a character that holds up.

**Phase 1 — The core experience (first shippable).** One user ↔ one character. Soul Document authoring (guided + free-form, with card import/export). Global user profile + relationship layer. Short-term memory + summarization rollup. Warm messaging UI. This delivers the entire stated near-term goal.

**Phase 2 — Depth.** Long-term retrieval memory (embeddings + triggered recall), lorebook authoring, the studio surface (inspect/edit memory and relationships), persona support, voice and richer multimodality, the persona test harness.

**Phase 3 — Agency.** MCP tool integration (your PHP SDK as the tool layer), per-character toolsets, in-character tool narration. First simple tool-using behaviors.

**Phase 4 — Multiplicity.** Group chats (orchestration engine), character-to-character relationships, the room/shared-space abstraction.

**Phase 5 — Shared worlds.** Discord-like rooms and shared games on top of the room + MCP foundation.

---

## 12. Risks & Open Questions

- **Hardware ceiling for ensembles.** 16 GB VRAM comfortably runs one large character; concurrent rich characters will force model tiering, swapping, or quality trade-offs. Worth prototyping the multi-character VRAM budget before committing to Phase 4 designs.
- **Memory correctness vs. warmth.** Automatic memory extraction will be wrong sometimes, and a character "remembering" something false is worse than forgetting. User-editable, inspectable memory is the mitigation; design it in from Phase 2, not after complaints.
- **Emotional design ethics.** Proactive presence, persistent "relationships," and mood systems are powerful precisely because they create attachment. The app should be honest that characters are software, give the user full control over proactivity, and explicitly *not* optimize for engagement/time-in-app. This is both an ethical line and, longer term, a trust differentiator from manipulative companion apps.
- **Soul Document authoring is hard.** The quality of the whole experience rests on a skill (writing convincing interiority) most users don't have. The guided creator and a strong starter library are not nice-to-haves; they're load-bearing for adoption.
- **Format interoperability scope.** Adopting the character-card ecosystem brings a content library but also brings community content with assumptions (roleplay framing, embedded jailbreaks) that may clash with this app's warmer, non-adversarial framing. Decide how much to import vs. curate.
- **Model portability.** Defaulting to Gemma 4 is right, but keeping the prompt assembler model-agnostic (via Ollama's OpenAI-compatible endpoint) preserves the option to swap models — including the chat-format differences between Gemma 4 and other families — without re-architecting.

---

*Prepared as a forward-looking concept plan; specific version numbers, model variants, and library capabilities (Ollama, Gemma 4, Open WebUI, SillyTavern) reflect the state of the ecosystem as of June 2026 and should be reverified before implementation, since this space moves quickly.*
