import React, { useState } from "react";
import { Avatar, IconButton, Tooltip, Icons } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import { RoomSetup } from "./RoomSetup";
import logoMark from "@assets/logo-mark.svg";

export function Sidebar() {
  const store = useStore();
  const s = useAppState();
  const [gatherOpen, setGatherOpen] = useState(false);
  const currentId = s.view === "conversation" ? s.currentCharacterId : null;
  const currentRoomId = s.view === "room" ? s.currentRoomId : null;

  return (
    <aside className="dh-rail">
      <div className="dh-rail__top">
        <img className="dh-rail__logo" src={logoMark} width={34} height={34} alt="Dragon Heart" />
        <Tooltip label="Begin a new bond" placement="bottom">
          <IconButton label="New" variant="ghost" onClick={() => store.gotoCreate()}>
            <Icons.Plus />
          </IconButton>
        </Tooltip>
      </div>

      <button
        className="dh-rail__label"
        style={{ background: "transparent", border: "none", textAlign: "left", cursor: "pointer" }}
        onClick={() => store.gotoHall()}
      >
        Your circle
      </button>

      <nav className="dh-rail__list">
        {s.characters.length === 0 ? (
          <p className="dh-rail__empty">No one here yet. Begin a bond.</p>
        ) : (
          s.characters.map((c) => (
            <button
              key={c.id}
              className={"dh-railitem" + (c.id === currentId ? " is-active" : "")}
              onClick={() => void store.openCharacter(c.id)}
            >
              <Avatar
                src={c.avatarPath}
                name={c.name}
                size="sm"
                status={c.status}
                mood={c.mood}
                ring={c.id === currentId}
                breathing={c.id === currentId}
              />
              <span className="dh-railitem__text">
                <span className="dh-railitem__name">{c.name}</span>
                <span className="dh-railitem__epithet">{c.epithet}</span>
              </span>
            </button>
          ))
        )}
      </nav>

      <span className="dh-rail__label">Gatherings</span>

      <nav className="dh-rail__list" style={{ flex: "0 0 auto" }}>
        {s.rooms.map((r) => (
          <button
            key={r.id}
            className={"dh-railitem" + (r.id === currentRoomId ? " is-active" : "")}
            onClick={() => void store.openRoom(r.id)}
          >
            <Avatar
              name={r.title ?? "Gathering"}
              size="sm"
              mood="ember"
              ring={r.id === currentRoomId}
              breathing={r.id === currentRoomId}
            />
            <span className="dh-railitem__text">
              <span className="dh-railitem__name">{r.title ?? "A gathering"}</span>
              <span className="dh-railitem__epithet">a shared fire</span>
            </span>
          </button>
        ))}
        <button className="dh-railitem" onClick={() => setGatherOpen(true)}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "2rem",
              height: "2rem",
              color: "var(--text-muted)",
            }}
          >
            <Icons.Flame />
          </span>
          <span className="dh-railitem__text">
            <span className="dh-railitem__name">New gathering</span>
            <span className="dh-railitem__epithet">bring souls together</span>
          </span>
        </button>
      </nav>

      <RoomSetup open={gatherOpen} onClose={() => setGatherOpen(false)} />

      <div className="dh-rail__foot">
        <Tooltip label="The Hall" placement="top">
          <IconButton label="The Hall" variant="ghost" onClick={() => store.gotoHall()}>
            <Icons.Book />
          </IconButton>
        </Tooltip>
        <Tooltip
          label={s.theme === "light" ? "Return to the hearth" : "Cross into the Luminous Realm"}
          placement="top"
        >
          <IconButton
            label="Toggle realm"
            variant="ghost"
            onClick={() => void store.setTheme(s.theme === "light" ? "dark" : "light")}
          >
            {s.theme === "light" ? <Icons.Moon /> : <Icons.Sun />}
          </IconButton>
        </Tooltip>
        <Tooltip label="The Studio" placement="top">
          <IconButton
            label="Studio"
            variant="ghost"
            onClick={() => {
              if (s.view === "conversation") store.toggleStudio();
            }}
          >
            <Icons.Studio />
          </IconButton>
        </Tooltip>
      </div>
    </aside>
  );
}
