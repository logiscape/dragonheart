import React, { useEffect, useRef, useState } from "react";
import {
  MessageBubble,
  PresenceIndicator,
  Avatar,
  IconButton,
  Tooltip,
  Ornament,
  Textarea,
  Icons,
} from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import type { Attachment, Message } from "@engine/index";
import { pickOpenPath, readBase64, mimeFromPath } from "@adapters/tauriFiles";

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

export function Conversation() {
  const store = useStore();
  const s = useAppState();
  const character = store.currentCharacter();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  const firstName = character ? character.name.split(" ")[0] ?? character.name : "";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [s.messages, s.streamingText, s.streaming]);

  if (!character) return <main className="dh-conv" />;

  const send = () => {
    const text = draft.trim();
    if ((!text && pending.length === 0) || s.streaming) return;
    setDraft("");
    const atts = pending;
    setPending([]);
    void store.sendMessage(text, atts);
  };

  const attachImage = async () => {
    const path = await pickOpenPath([
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
    ]);
    if (!path) return;
    const data = await readBase64(path);
    setPending((p) => [...p, { kind: "image", data, mime: mimeFromPath(path) }]);
  };

  const renderMessage = (m: Message, isGreeting: boolean) => {
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
    return (
      <MessageBubble
        key={m.id}
        from="character"
        name={character.name}
        dropcap={isGreeting && character.greetingDropcap}
        avatar={<Avatar name={character.name} size="sm" mood={character.mood} ring breathing />}
      >
        {m.content}
      </MessageBubble>
    );
  };

  const firstCharacterIdx = s.messages.findIndex((m) => m.role === "assistant");

  return (
    <main className="dh-conv">
      <header className="dh-conv__bar">
        <div className="dh-conv__who">
          <Avatar name={character.name} size="md" mood={character.mood} ring breathing status="present" />
          <div>
            <h1 className="dh-conv__name">{character.name}</h1>
            <PresenceIndicator
              name={firstName}
              state={s.streaming ? "thinking" : "present"}
              mood={character.mood}
            />
          </div>
        </div>
        <div className="dh-conv__tools">
          <Tooltip label="Begin a new evening">
            <IconButton label="New evening" variant="ghost" onClick={() => void store.newConversation()}>
              <Icons.Plus />
            </IconButton>
          </Tooltip>
          <Tooltip label="The Soul Document">
            <IconButton label="Soul" variant="ghost" onClick={() => store.toggleStudio()}>
              <Icons.Studio />
            </IconButton>
          </Tooltip>
        </div>
      </header>

      <div className="dh-conv__thread">
        <div className="dh-conv__column">
          <Ornament label={character.thinking ? "This evening" : (s.conversation?.sceneState || "This evening")} />

          {s.messages.map((m, i) => renderMessage(m, i === firstCharacterIdx))}

          {s.streaming && s.streamingText ? (
            <MessageBubble
              from="character"
              name={character.name}
              avatar={<Avatar name={character.name} size="sm" mood={character.mood} ring breathing />}
            >
              {s.streamingText}
            </MessageBubble>
          ) : null}

          {s.streaming && !s.streamingText ? (
            <div className="dh-conv__thinking">
              <PresenceIndicator name={firstName} state="thinking" mood={character.mood} />
            </div>
          ) : null}

          {!s.streaming && s.thinkingText && s.relationship?.showInnerMonologue ? (
            <p className="dh-inline-note">({s.thinkingText.trim()})</p>
          ) : null}

          {!s.streaming && s.lastRecall.length ? (
            <span className="dh-conv__recall">
              <Icons.Sparkle /> {firstName} drew on {s.lastRecall.length}{" "}
              {s.lastRecall.length === 1 ? "memory" : "memories"} just now
            </span>
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
              placeholder={`Say something to ${firstName}…`}
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
          <IconButton label="Send" variant="ember" round onClick={send} disabled={s.streaming}>
            <Icons.Send />
          </IconButton>
        </div>
        <p className="dh-composer__hint">
          {firstName} will remember this conversation. Press Enter to speak.
        </p>
      </div>
    </main>
  );
}
