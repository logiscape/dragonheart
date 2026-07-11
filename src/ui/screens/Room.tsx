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
import { RoomSetup } from "./RoomSetup";

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
  const [setupOpen, setSetupOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [s.roomMessages, s.roomStreamingText, s.roomPhase]);

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

  const send = () => {
    const text = draft.trim();
    if (!text && pending.length === 0) return;
    setDraft("");
    const atts = pending;
    setPending([]);
    // the room composer is never locked — posting mid-cascade is designed
    void store.sendRoomMessage(text, atts);
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
          <Tooltip label="Invite or rearrange">
            <IconButton label="Invite or rearrange" variant="ghost" onClick={() => setSetupOpen(true)}>
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
            <Textarea
              seamless
              autoGrow
              maxRows={3}
              rows={1}
              placeholder="Say something to the room…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
          </div>
          <div className="dh-composer__attach">
            <Tooltip label="Share an image">
              <IconButton label="Attach image" variant="ghost" onClick={() => void attachImage()}>
                <Icons.Image />
              </IconButton>
            </Tooltip>
          </div>
          <IconButton label="Send" variant="ember" round onClick={send}>
            <Icons.Send />
          </IconButton>
        </div>
        <p className="dh-composer__hint">
          They'll talk among themselves if you let them. Press Enter to speak.
        </p>
      </div>

      <RoomSetup open={setupOpen} onClose={() => setSetupOpen(false)} roomId={room.id} />
    </main>
  );
}
