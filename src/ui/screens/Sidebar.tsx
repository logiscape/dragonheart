import React from "react";
import { Avatar, IconButton, Tooltip, Icons } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import logoMark from "@assets/logo-mark.svg";

export function Sidebar() {
  const store = useStore();
  const s = useAppState();
  const currentId = s.view === "conversation" ? s.currentCharacterId : null;

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
