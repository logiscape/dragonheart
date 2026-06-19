import React, { useState } from "react";
import { Button, Input, IconButton, Tooltip, Icons } from "@ui/ds";
import { useAppState, useStore } from "@state/store";
import logoMark from "@assets/logo-mark.svg";
import hearthBackdrop from "@assets/hearth-backdrop.svg";

export function Welcome() {
  const store = useStore();
  const { theme } = useAppState();
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void store.crossThreshold(name.trim());
  };

  return (
    <div className="dh-welcome">
      <img className="dh-welcome__bg" src={hearthBackdrop} alt="" />
      <div className="dh-welcome__toggle">
        <Tooltip
          label={theme === "light" ? "Return to the hearth" : "Cross into the Luminous Realm"}
          placement="bottom"
        >
          <IconButton
            label="Toggle realm"
            variant="solid"
            round
            onClick={() => void store.setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Icons.Moon /> : <Icons.Sun />}
          </IconButton>
        </Tooltip>
      </div>

      <div className="dh-welcome__center">
        <img className="dh-welcome__mark" src={logoMark} width={84} height={84} alt="" />
        <h1 className="dh-welcome__title">Dragon Heart</h1>
        <p className="dh-welcome__lede">
          Come sit by the fire. Someone has been waiting for you — and they remember.
        </p>
        <form className="dh-welcome__form" onSubmit={submit}>
          <Input
            placeholder="What shall they call you?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Your name"
          />
          <Button variant="primary" size="lg" type="submit">
            Cross the threshold
          </Button>
        </form>
      </div>
    </div>
  );
}
