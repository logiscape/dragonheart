---
name: dragonheart-design-language
description: Dragon Heart "Candlelit Hearthside" design language — tokens, type, voice rules, and the core UX metaphor
metadata:
  type: reference
---

Dragon Heart's design system (`.design-system/`, from the zip) encodes one conviction: **a relationship, not a tool**. Write/design as if the user is *with a person*, never operating a machine — no "How can I assist?", no foreground regenerate/copy/sliders, no emoji. Productivity affordances hide behind the **Studio** surface.

**Aesthetic:** "Candlelit hearthside" — warm dark default (`--surface-base #100c08`), firelight **ember** gold (`--accent #df9132`, primary), dragon-heart **garnet** (`--heart #ba4632`, emotional weight), parchment for "letter" moments. Light theme = "The Luminous Realm" via `data-theme="light"`.

**Type (4 voices):** Cormorant Garamond (`--font-display`, names/titles), Spectral (`--font-serif`, the character's voice/body, 19px/1.7), Hanken Grotesk (`--font-sans`, UI chrome), JetBrains Mono (`--font-mono`, the Studio/Soul Document). Google Fonts.

**Microcopy reframes:** New chat → "Begin a new bond"; AI typing → "gathering her thoughts"; Delete → "Say goodbye"; Settings/System prompt → "The Studio / Soul Document"; Saved → "Kept"; Chat history → "The Chronicle". Sentence case; small-caps only for tiny labels.

**Reference screens** (`.design-system/ui_kits/dragon-heart/`): Threshold(Welcome) → The Hall → Conversation → Studio. Motion breathes (`dh-breathe` 4.2s presence ring, `dh-rise` entrances). Components inject their own CSS and compose via className + CSS custom-property tokens. Linked to [[dragonheart-stack]].
