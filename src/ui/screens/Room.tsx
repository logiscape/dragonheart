import React, { useEffect, useRef, useState } from "react";
import {
  Avatar,
  IconButton,
  Icons,
  MessageBubble,
  Ornament,
  PresenceIndicator,
  Textarea,
  Tooltip,
} from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import type { Attachment, Character, Message } from "@engine/index";
import { pickOpenPath, readBase64, mimeFromPath } from "@adapters/tauriFiles";
import { findMentionToken, mentionMatches, applyMention, type MentionToken } from "@ui/mentions";

function Attachments({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="dh-msg__attachments">
      {attachments.map((a, i) => (
        <img key={i} src={`data:${a.mime};base64,${a.data}`} alt="shared" />
      ))}
    </div>
  );
}

export function Room() {
  const store = useStore();
  const s = useAppState();
  const room = s.rooms.find((r) => r.id === s.currentRoomId) ?? null;
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [posting, setPosting] = useState(false);
  const postingRef = useRef(false);
  const [mention, setMention] = useState<MentionToken | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [s.roomMessages, s.roomStreamingText, s.roomPhase]);

  const mentionQuery = mention?.query;
  useEffect(() => setMentionIndex(0), [mentionQuery]);

  if (!room) return <main className="dh-conv" />;

  const speakerOf = (id: string | null): Character | null => {
    if (!id) return null;
    return (
      s.roomParticipants.find((p) => p.character.id === id)?.character ??
      s.characters.find((c) => c.id === id) ??
      null
    );
  };

  const liveSpeaker = speakerOf(s.roomStreamingCharacterId);
  const generating = s.roomPhase === "generating" && !!liveSpeaker;

  const send = async () => {
    const text = draft.trim();
    if (postingRef.current || (!text && pending.length === 0)) return;
    postingRef.current = true;
    setPosting(true);
    try {
      if (await store.sendRoomMessage(text, pending)) {
        setDraft(""); setMention(null); setPending([]);
      }
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  };

  const mentionCandidates = mention
    ? s.roomParticipants.filter((p) => mentionMatches(mention.query, p.character.name))
    : [];
  const activeMention = mentionCandidates.length ? mentionIndex % mentionCandidates.length : 0;

  const refreshMention = (el: HTMLTextAreaElement) => {
    setMention(findMentionToken(el.value, el.selectionStart ?? el.value.length));
  };

  const pickMention = (name: string) => {
    if (!mention) return;
    const el = draftRef.current;
    const caret = el?.selectionStart ?? draft.length;
    const next = applyMention(draft, caret, mention, name);
    setDraft(next.text);
    setMention(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };

  const attachImage = async () => {
    const path = await pickOpenPath([
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
    ]);
    if (!path) return;
    const data = await readBase64(path);
    setPending((p) => [...p, { kind: "image", data, mime: mimeFromPath(path) }]);
  };

  const renderMessage = (m: Message) => {
    if (m.role === "user") {
      return (
        <MessageBubble key={m.id} from="user">
          {m.attachments.length ? (
            <React.Fragment>
              {m.content}
              <Attachments attachments={m.attachments} />
            </React.Fragment>
          ) : (
            m.content
          )}
        </MessageBubble>
      );
    }
    const speaker = speakerOf(m.speakerCharacterId);
    return (
      <MessageBubble
        key={m.id}
        from="character"
        name={speaker?.name ?? "Someone"}
        avatar={
          <Avatar
            src={speaker?.avatarPath ?? null}
            name={speaker?.name ?? "Someone"}
            size="sm"
            mood={speaker?.mood ?? "ember"}
            ring
          />
        }
      >
        {m.content}
      </MessageBubble>
    );
  };

  return (
    <main className="dh-conv">
      <header className="dh-conv__bar">
        <div className="dh-conv__who">
          <div>
            <h1 className="dh-conv__name">{room.title ?? "The gathering"}</h1>
            <span className="dh-presence">
              <span className="dh-presence__label">
                {s.roomParticipants.length + 1} of you by the fire
              </span>
            </span>
          </div>
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginLeft: "auto" }}
        >
          {s.roomParticipants.map((p) => (
            <Tooltip key={p.character.id} label={`${p.character.name} — the Studio`}>
              <button
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                onClick={() => void store.openStudioFor(p.character.id)}
              >
                <Avatar
                  src={p.character.avatarPath}
                  name={p.character.name}
                  size="sm"
                  mood={p.character.mood}
                  ring={p.character.id === s.roomStreamingCharacterId}
                  breathing={p.character.id === s.roomStreamingCharacterId}
                  status="present"
                />
              </button>
            </Tooltip>
          ))}
        </div>
        <div className="dh-conv__tools">
          <Tooltip label="Tend the gathering">
            <IconButton label="Tend the gathering" variant="ghost" onClick={() => store.toggleRoomStudio()}>
              <Icons.Plus />
            </IconButton>
          </Tooltip>
        </div>
      </header>

      <div className="dh-conv__thread">
        <div className="dh-conv__column">
          <Ornament label={room.sceneState || "Around the fire"} />

          {s.roomMessages.map(renderMessage)}

          {s.roomPhase === "selecting" ? (
            <p className="dh-inline-note">(The room stirs…)</p>
          ) : null}

          {generating && !s.roomStreamingText ? (
            <div className="dh-conv__thinking">
              <PresenceIndicator
                name={liveSpeaker.name.split(" ")[0] ?? liveSpeaker.name}
                state="thinking"
                mood={liveSpeaker.mood}
              />
            </div>
          ) : null}

          {generating && s.roomStreamingText ? (
            <MessageBubble
              from="character"
              name={liveSpeaker.name}
              avatar={
                <Avatar
                  src={liveSpeaker.avatarPath}
                  name={liveSpeaker.name}
                  size="sm"
                  mood={liveSpeaker.mood}
                  ring
                  breathing
                />
              }
            >
              {s.roomStreamingText}
            </MessageBubble>
          ) : null}

          {s.roomPhase === "quiet" ? (
            <p className="dh-inline-note">(The conversation settles. They're waiting for you.)</p>
          ) : null}

          <div ref={endRef} />
        </div>
      </div>

      <div className="dh-conv__composer">
        {s.error ? <p role="alert" className="dh-inline-note">{s.error} Check the connection in Studio. {draft || pending.length ? "Your unsent draft is kept; try sending again when ready." : "You can send another message when ready."}</p> : null}
        {pending.length ? (
          <div className="dh-composer__images">
            {pending.map((a, i) => (
              <div className="dh-composer__thumb" key={i}>
                <img src={`data:${a.mime};base64,${a.data}`} alt="attachment" />
                <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="dh-composer">
          <Icons.Quill />
          <div className="dh-composer__field">
            {mention && mentionCandidates.length > 0 ? (
              <div className="dh-mention-pop" role="listbox" aria-label="Call on someone">
                {mentionCandidates.map((p, i) => (
                  <button
                    key={p.character.id}
                    type="button"
                    role="option"
                    aria-selected={i === activeMention}
                    className={`dh-mention-pop__item${i === activeMention ? " is-active" : ""}`}
                    onMouseDown={(e) => {
                      // mousedown, not click, so the textarea never loses focus
                      e.preventDefault();
                      pickMention(p.character.name);
                    }}
                    onMouseEnter={() => setMentionIndex(i)}
                  >
                    <Avatar
                      src={p.character.avatarPath}
                      name={p.character.name}
                      size="xs"
                      mood={p.character.mood}
                    />
                    <span className="dh-mention-pop__name">{p.character.name}</span>
                    {p.character.epithet ? (
                      <span className="dh-mention-pop__epithet">{p.character.epithet}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            <Textarea
              ref={draftRef}
              seamless
              autoGrow
              maxRows={3}
              rows={1}
              placeholder="Say something to the room…"
              value={draft}
              disabled={posting}
              onChange={(e) => {
                setDraft(e.target.value);
                refreshMention(e.target);
              }}
              onSelect={(e) => refreshMention(e.currentTarget)}
              onBlur={() => setMention(null)}
              onKeyDown={(e) => {
                if (mention && mentionCandidates.length > 0) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const delta = e.key === "ArrowDown" ? 1 : -1;
                    setMentionIndex(
                      (activeMention + delta + mentionCandidates.length) % mentionCandidates.length,
                    );
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    pickMention(mentionCandidates[activeMention]!.character.name);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setMention(null);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
          </div>
          <div className="dh-composer__attach">
            <Tooltip label="Share an image">
              <IconButton label="Attach image" variant="ghost" disabled={posting} onClick={() => void attachImage()}>
                <Icons.Image />
              </IconButton>
            </Tooltip>
          </div>
          <IconButton label="Send" variant="ember" round disabled={posting} onClick={() => void send()}>
            <Icons.Send />
          </IconButton>
        </div>
        <p className="dh-composer__hint">
          They'll talk among themselves if you let them. Press Enter to speak, @ to call on someone.
        </p>
      </div>

    </main>
  );
}
