# Third-Party Licenses & Notices

Dragon Heart is distributed under the [MIT License](./LICENSE). It is built on open-source
components from the npm and Rust/Cargo ecosystems and interoperates with a community
character-card format. This document lists those components, records their licenses, and
explains what each means for redistribution under MIT. It is provided as a reference for
users, redistributors, and contributors.

License identifiers below are SPDX expressions taken from each component's own published
metadata.

**Scope**

- **npm / JavaScript** — 161 packages, taken from the repository's lockfile
  (`package-lock.json`). This includes platform-specific optional binaries for every operating
  system (e.g. the per-OS `esbuild`, `rollup`, and Tauri CLI builds, and macOS `fsevents`), so
  the inventory is complete regardless of which platform you build on — not just the subset
  installed into `node_modules` on one machine.
- **Rust / Cargo** — 546 crates, resolved via `cargo metadata` across the full dependency
  graph for all target platforms (this includes Linux- and macOS-only crates that are not
  compiled into the Windows build).
- **Runtime dependencies & external components** — software the app requires at runtime but
  does not bundle (the Ollama server, language/embedding models, web fonts, and the system
  webview). See [Runtime dependencies](#runtime-dependencies--external-components).
- **Referenced, not bundled** — the SillyTavern-compatible character-card format and design
  influences that contribute no code. See
  [Referenced components](#referenced-components--character-card-format).

*Last verified: 2026-06-22, against the component versions pinned in this repository's lockfiles.*

---

## Summary

Every bundled dependency is available under a permissive or weak-copyleft license that is
compatible with distribution under MIT. The dependency trees contain no strong or network
copyleft (no GPL, AGPL, LGPL-only, SSPL, or EUPL) and no proprietary or unspecified licenses.

For these bundled dependencies, obligations on redistributors are limited to standard
attribution — retaining the upstream license texts and any `NOTICE` files for the components
listed below. The categories that warrant attention are documented in the sections that follow.

Separately, the app relies at runtime on external components it does not bundle — the Ollama
server, the **Gemma 4** model (Apache-2.0), embedding model, web fonts, and the system
**WebView2** runtime on Windows (Microsoft's proprietary redistributable). These do not affect
the MIT licensing of Dragon Heart's own code, but distributors should be aware of them; see
[Runtime dependencies & external components](#runtime-dependencies--external-components).

### License categories

The appendix tables classify each component with one of the following labels (the **Flag**
column). They describe redistribution implications under MIT and are specific to this document.

| Label | Meaning | What it requires |
|---|---|---|
| **OK** | Permissive (MIT, BSD, ISC, Zlib, Unicode-3.0, Apache-or-MIT duals, etc.). | Standard attribution only. |
| **NOTE** | Permissive but not MIT, with no MIT option (Apache-2.0-only, BSL-1.0, CC-BY-4.0). Compatible with an MIT project; simply cannot be relabeled as MIT. | Preserve the upstream license and any `NOTICE` file. (Apache-2.0 additionally grants explicit patent rights.) |
| **REVIEW** | Weak, file-level copyleft (MPL-2.0). Compatible with an MIT project and free to redistribute. | Preserve the license; if a covered source file is *modified*, that modified file must be made available under MPL-2.0. |
| **BLOCK** | Strong or network copyleft, or proprietary — incompatible with an MIT release. | None present in this project. |

### Weak-copyleft components (MPL-2.0)

Five Rust crates are licensed under MPL-2.0. All are transitive dependencies pulled in by
Tauri's webview/CSS stack and by `dirs`; none are direct dependencies and none are modified
by this project. MPL-2.0 is file-scoped copyleft, so redistributing them unmodified inside an
MIT-licensed application is permitted.

| Crate | Version | Pulled in via |
|---|---|---|
| `cssparser` | 0.36.0 | Tauri (Servo CSS stack) |
| `cssparser-macros` | 0.6.1 | Tauri (Servo CSS stack) |
| `selectors` | 0.36.1 | Tauri (Servo `stylo`) |
| `dtoa-short` | 0.3.5 | Tauri (Servo CSS stack) |
| `option-ext` | 0.2.0 | `dirs` → `dirs-sys` (config-path lookup) |

### Permissive, non-MIT components (preserve upstream license text)

- **Rust (Apache-2.0-only):** `borsh-derive` 1.7.0, `openssl` 0.10.81, `sync_wrapper` 1.0.2,
  `tao` 0.35.3; `target-lexicon` 0.12.16 (Apache-2.0 *WITH LLVM-exception*); `ryu` 1.0.23
  (Apache-2.0 *OR* BSL-1.0 — both permissive, with no MIT option).
- **npm (Apache-2.0):** `typescript` 5.9.3, `expect-type` 1.3.0, `baseline-browser-mapping`
  2.10.38 — all build/test-time only.
- **npm (CC-BY-4.0):** `caniuse-lite` 1.0.30001799 — a build-time browser-support **dataset**
  used via Browserslist. The CC-BY attribution applies to the data; it is not linked into the
  shipped application. Build-time only.

### Dual licenses that include a copyleft option

- `r-efi` 5.3.0 / 6.0.0 are offered as `MIT OR Apache-2.0 OR LGPL-2.1-or-later`. Because this
  is an `OR` expression, the MIT term applies and the LGPL option is never invoked. (These are
  UEFI-target crates and are not compiled into the Windows desktop build.)

---

## Runtime dependencies & external components

The following components are **not** part of the npm or Cargo dependency trees and are not
bundled in this repository, but the application requires or fetches them at runtime. Anyone
building, packaging, or redistributing Dragon Heart should be aware of each — both for the
end-user setup they imply and for their licensing terms.

| Component | Role | License / terms | Bundled? |
|---|---|---|---|
| [Ollama](https://ollama.com) | Local LLM server the app talks to over HTTP (`localhost:11434`) | MIT | No — user installs separately |
| **Gemma 4** model (default `gemma4:26b`, fast `gemma4:e4b`) | Default chat model | Apache-2.0 | No — pulled via Ollama |
| `nomic-embed-text` | Embedding model for semantic memory recall (optional) | Apache-2.0 | No — pulled via Ollama |
| Cormorant Garamond, Spectral, Hanken Grotesk, JetBrains Mono | UI web fonts | OFL-1.1 (SIL Open Font License) | No — loaded at runtime from Google Fonts |
| Microsoft Edge **WebView2** Runtime (Windows) | System webview Tauri renders into | Microsoft proprietary redistributable terms | No — uses the system/evergreen runtime |

Points worth highlighting for redistributors:

- **Gemma 4 is released under the Apache-2.0 license** —
  Google's first Gemma release to use a standard permissive license rather than the custom
  "Gemma Terms of Use" that governed Gemma 1–3. It permits commercial use, fine-tuning,
  modification, and redistribution. Dragon Heart does not bundle the model weights in any case
  (they are downloaded by the user through Ollama), and the app can be pointed at any other
  Ollama model.
- **Fonts are fetched at runtime from `fonts.googleapis.com`** (`src/styles/tokens/fonts.css`);
  the binaries are not committed to this repository. This means (a) the app makes a network
  request to Google for fonts and falls back to system serifs when offline, and (b) a
  distributor who chooses to self-host the fonts must include them under OFL-1.1. On other
  platforms Tauri uses WebKitGTK (Linux) or WKWebView (macOS) in place of WebView2.

### Conceptual references with no code or assets

These influenced Dragon Heart's design but contribute **no source code, assets, or runtime
dependency**, and therefore impose no obligations on an MIT release:

- **Open WebUI** — cited in `Dragon_Heart_Concept_Plan.md` as a technical proof-of-concept.
  No Open WebUI code or assets are used. (The concept plan itself notes that Open WebUI's
  license would need to be checked *if* any of its code or assets were ever adopted as more
  than conceptual reference.)

---

## Referenced components — character-card format

Dragon Heart can import and export community **character cards** and draws design inspiration
from [SillyTavern](https://github.com/SillyTavern/SillyTavern), which is licensed under
**AGPL-3.0**. No SillyTavern source code is included in this project. This section documents the
relationship so that the AGPL reference is not mistaken for a licensing constraint on Dragon
Heart.

SillyTavern's influence on Dragon Heart falls into three categories, none of which carry its
source-code license:

| Reference | Where in Dragon Heart | Nature |
|---|---|---|
| Design inspiration, including the "personality goes flat by message 30" failure mode | `Dragon_Heart_Concept_Plan.md`; comments in `src/engine/lorebook.ts` | Design concept — not a copyrightable element |
| Character-card V2 import/export (PNG-embedded JSON) | `src/engine/characterCard.ts` | Published, community file format — formats and the field names required to interoperate are not copyrightable |
| Lorebook / "World Info"-style keyword triggering | `src/engine/lorebook.ts` | General technique, implemented independently (~70 lines: keyword matching plus cosine-similarity fill) |

Dragon Heart's character-card support is an independent implementation:

- It is built on Dragon Heart's own types (`SoulDocument`, `blankSoul`, `CharacterDraft`).
- The PNG `tEXt` chunk reader and writer are implemented from scratch against the PNG
  specification, using a standard CRC32 (the `0xedb88320` polynomial table). They do **not**
  use SillyTavern's `png-chunks-extract`, `png-chunk-text`, or `character-card-parser` modules.
- The only format-specific identifiers used (`first_mes`, `mes_example`, `character_book`, and
  the `chara` / `ccv3` PNG keywords) are the interoperability tokens defined by the card format.

No SillyTavern assets are bundled — there are no default character cards, preset images, or
prompt presets. All shipped PNG files are Tauri-generated application icons, and test fixtures
use original sample characters.

### Independent-implementation comparison

Dragon Heart's `src/engine/characterCard.ts` was compared against SillyTavern's card-parsing
source (`src/character-card-parser.js`). The two implementations differ across language,
dependencies, I/O model, and feature set; their only overlap is the sequence the card format
itself prescribes — base64-encoded JSON stored in a PNG `tEXt` chunk keyed `chara` / `ccv3` —
which is common to every conforming implementation.

| Aspect | SillyTavern (AGPL-3.0) | Dragon Heart (MIT) |
|---|---|---|
| Language / runtime | Node.js JavaScript (`fs`, `buffer`) | Browser TypeScript (`atob`/`btoa`, `TextDecoder`, `Uint8Array`) |
| PNG handling | npm `png-chunks-extract`, `png-chunk-text`, `png-chunks-encode` | Implemented from scratch — own chunk reader and CRC32; no dependencies |
| Input model | File paths, async `parse()` | In-memory bytes, synchronous |
| Read precedence | `ccv3` first, then `chara` | Matches in chunk order; no v3-precedence logic |
| Write behavior | Strips existing chunks, writes both v2 `chara` and v3 `ccv3` | Inserts a single `chara` chunk before `IEND`; v2 only |

A repository-wide search for SillyTavern-specific identifiers — including `charaFormatData`,
`writeCharacterData`, `getRegexedString`, the `{{char}}` / `{{user}}` template macros, and
extended card fields such as `alternate_greetings`, `post_history_instructions`,
`system_prompt`, and `depth_prompt` — returned no matches. Dragon Heart implements only a
minimal subset of the card format, consistent with an independent implementation.

---

## License distribution (Rust, 546 crates)

| Count | License expression |
|---|---|
| 260 | MIT OR Apache-2.0 |
| 126 | MIT |
| 46 | Apache-2.0 OR MIT |
| 29 | MIT/Apache-2.0 |
| 18 | Unicode-3.0 |
| 17 | Zlib OR Apache-2.0 OR MIT |
| 5 | **MPL-2.0** (weak copyleft — REVIEW) |
| 5 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| 4 | Unlicense OR MIT |
| 4 | Apache-2.0 (only) |
| 4 | Apache-2.0/MIT |
| 3 | BSD-3-Clause |
| 2 each | Zlib · BSD-3-Clause OR MIT OR Apache-2.0 · MIT OR Apache-2.0 OR LGPL-2.1-or-later · MIT OR Apache-2.0 OR Zlib · Unlicense/MIT · Apache-2.0 OR BSL-1.0 OR MIT · BSD-2-Clause OR Apache-2.0 OR MIT |
| 1 each | 0BSD OR MIT OR Apache-2.0 · BSD-3-Clause AND MIT · BSD-3-Clause/MIT · Apache-2.0 AND MIT · CC0-1.0 OR MIT-0 OR Apache-2.0 · Apache-2.0 / MIT · ISC · MIT OR Zlib OR Apache-2.0 · Apache-2.0 OR BSL-1.0 · Apache-2.0 WITH LLVM-exception · (MIT OR Apache-2.0) AND Unicode-3.0 |

## License distribution (npm, 161 packages)

| Count | License | Notes |
|---|---|---|
| 135 | MIT | — |
| 13 | Apache-2.0 OR MIT | dual; MIT applies |
| 6 | ISC | permissive |
| 3 | Apache-2.0 | only — NOTE (`typescript`, `expect-type`, `baseline-browser-mapping`) |
| 2 | MIT OR Apache-2.0 | dual; MIT applies |
| 1 | BSD-3-Clause | `source-map-js` |
| 1 | CC-BY-4.0 | `caniuse-lite` (data — NOTE) |

---

## Appendix A — Full npm dependency list (161)

| License | Flag | Package | Version | Source |
|---|---|---|---|---|
| MIT | OK | `@babel/code-frame` | 7.29.7 | https://www.npmjs.com/package/@babel/code-frame |
| MIT | OK | `@babel/compat-data` | 7.29.7 | https://www.npmjs.com/package/@babel/compat-data |
| MIT | OK | `@babel/core` | 7.29.7 | https://www.npmjs.com/package/@babel/core |
| MIT | OK | `@babel/generator` | 7.29.7 | https://www.npmjs.com/package/@babel/generator |
| MIT | OK | `@babel/helper-compilation-targets` | 7.29.7 | https://www.npmjs.com/package/@babel/helper-compilation-targets |
| MIT | OK | `@babel/helper-globals` | 7.29.7 | https://www.npmjs.com/package/@babel/helper-globals |
| MIT | OK | `@babel/helper-module-imports` | 7.29.7 | https://www.npmjs.com/package/@babel/helper-module-imports |
| MIT | OK | `@babel/helper-module-transforms` | 7.29.7 | https://www.npmjs.com/package/@babel/helper-module-transforms |
| MIT | OK | `@babel/helper-plugin-utils` | 7.29.7 | https://www.npmjs.com/package/@babel/helper-plugin-utils |
| MIT | OK | `@babel/helper-string-parser` | 7.29.7 | https://www.npmjs.com/package/@babel/helper-string-parser |
| MIT | OK | `@babel/helper-validator-identifier` | 7.29.7 | https://www.npmjs.com/package/@babel/helper-validator-identifier |
| MIT | OK | `@babel/helper-validator-option` | 7.29.7 | https://www.npmjs.com/package/@babel/helper-validator-option |
| MIT | OK | `@babel/helpers` | 7.29.7 | https://www.npmjs.com/package/@babel/helpers |
| MIT | OK | `@babel/parser` | 7.29.7 | https://www.npmjs.com/package/@babel/parser |
| MIT | OK | `@babel/plugin-transform-react-jsx-self` | 7.29.7 | https://www.npmjs.com/package/@babel/plugin-transform-react-jsx-self |
| MIT | OK | `@babel/plugin-transform-react-jsx-source` | 7.29.7 | https://www.npmjs.com/package/@babel/plugin-transform-react-jsx-source |
| MIT | OK | `@babel/template` | 7.29.7 | https://www.npmjs.com/package/@babel/template |
| MIT | OK | `@babel/traverse` | 7.29.7 | https://www.npmjs.com/package/@babel/traverse |
| MIT | OK | `@babel/types` | 7.29.7 | https://www.npmjs.com/package/@babel/types |
| MIT | OK | `@esbuild/aix-ppc64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/aix-ppc64 |
| MIT | OK | `@esbuild/android-arm` | 0.21.5 | https://www.npmjs.com/package/@esbuild/android-arm |
| MIT | OK | `@esbuild/android-arm64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/android-arm64 |
| MIT | OK | `@esbuild/android-x64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/android-x64 |
| MIT | OK | `@esbuild/darwin-arm64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/darwin-arm64 |
| MIT | OK | `@esbuild/darwin-x64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/darwin-x64 |
| MIT | OK | `@esbuild/freebsd-arm64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/freebsd-arm64 |
| MIT | OK | `@esbuild/freebsd-x64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/freebsd-x64 |
| MIT | OK | `@esbuild/linux-arm` | 0.21.5 | https://www.npmjs.com/package/@esbuild/linux-arm |
| MIT | OK | `@esbuild/linux-arm64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/linux-arm64 |
| MIT | OK | `@esbuild/linux-ia32` | 0.21.5 | https://www.npmjs.com/package/@esbuild/linux-ia32 |
| MIT | OK | `@esbuild/linux-loong64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/linux-loong64 |
| MIT | OK | `@esbuild/linux-mips64el` | 0.21.5 | https://www.npmjs.com/package/@esbuild/linux-mips64el |
| MIT | OK | `@esbuild/linux-ppc64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/linux-ppc64 |
| MIT | OK | `@esbuild/linux-riscv64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/linux-riscv64 |
| MIT | OK | `@esbuild/linux-s390x` | 0.21.5 | https://www.npmjs.com/package/@esbuild/linux-s390x |
| MIT | OK | `@esbuild/linux-x64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/linux-x64 |
| MIT | OK | `@esbuild/netbsd-x64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/netbsd-x64 |
| MIT | OK | `@esbuild/openbsd-x64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/openbsd-x64 |
| MIT | OK | `@esbuild/sunos-x64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/sunos-x64 |
| MIT | OK | `@esbuild/win32-arm64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/win32-arm64 |
| MIT | OK | `@esbuild/win32-ia32` | 0.21.5 | https://www.npmjs.com/package/@esbuild/win32-ia32 |
| MIT | OK | `@esbuild/win32-x64` | 0.21.5 | https://www.npmjs.com/package/@esbuild/win32-x64 |
| MIT | OK | `@jridgewell/gen-mapping` | 0.3.13 | https://www.npmjs.com/package/@jridgewell/gen-mapping |
| MIT | OK | `@jridgewell/remapping` | 2.3.5 | https://www.npmjs.com/package/@jridgewell/remapping |
| MIT | OK | `@jridgewell/resolve-uri` | 3.1.2 | https://www.npmjs.com/package/@jridgewell/resolve-uri |
| MIT | OK | `@jridgewell/sourcemap-codec` | 1.5.5 | https://www.npmjs.com/package/@jridgewell/sourcemap-codec |
| MIT | OK | `@jridgewell/trace-mapping` | 0.3.31 | https://www.npmjs.com/package/@jridgewell/trace-mapping |
| MIT | OK | `@rolldown/pluginutils` | 1.0.0-beta.27 | https://www.npmjs.com/package/@rolldown/pluginutils |
| MIT | OK | `@rollup/rollup-android-arm-eabi` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-android-arm-eabi |
| MIT | OK | `@rollup/rollup-android-arm64` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-android-arm64 |
| MIT | OK | `@rollup/rollup-darwin-arm64` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-darwin-arm64 |
| MIT | OK | `@rollup/rollup-darwin-x64` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-darwin-x64 |
| MIT | OK | `@rollup/rollup-freebsd-arm64` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-freebsd-arm64 |
| MIT | OK | `@rollup/rollup-freebsd-x64` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-freebsd-x64 |
| MIT | OK | `@rollup/rollup-linux-arm-gnueabihf` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-arm-gnueabihf |
| MIT | OK | `@rollup/rollup-linux-arm-musleabihf` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-arm-musleabihf |
| MIT | OK | `@rollup/rollup-linux-arm64-gnu` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-arm64-gnu |
| MIT | OK | `@rollup/rollup-linux-arm64-musl` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-arm64-musl |
| MIT | OK | `@rollup/rollup-linux-loong64-gnu` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-loong64-gnu |
| MIT | OK | `@rollup/rollup-linux-loong64-musl` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-loong64-musl |
| MIT | OK | `@rollup/rollup-linux-ppc64-gnu` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-ppc64-gnu |
| MIT | OK | `@rollup/rollup-linux-ppc64-musl` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-ppc64-musl |
| MIT | OK | `@rollup/rollup-linux-riscv64-gnu` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-riscv64-gnu |
| MIT | OK | `@rollup/rollup-linux-riscv64-musl` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-riscv64-musl |
| MIT | OK | `@rollup/rollup-linux-s390x-gnu` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-s390x-gnu |
| MIT | OK | `@rollup/rollup-linux-x64-gnu` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-x64-gnu |
| MIT | OK | `@rollup/rollup-linux-x64-musl` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-linux-x64-musl |
| MIT | OK | `@rollup/rollup-openbsd-x64` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-openbsd-x64 |
| MIT | OK | `@rollup/rollup-openharmony-arm64` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-openharmony-arm64 |
| MIT | OK | `@rollup/rollup-win32-arm64-msvc` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-win32-arm64-msvc |
| MIT | OK | `@rollup/rollup-win32-ia32-msvc` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-win32-ia32-msvc |
| MIT | OK | `@rollup/rollup-win32-x64-gnu` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-win32-x64-gnu |
| MIT | OK | `@rollup/rollup-win32-x64-msvc` | 4.62.0 | https://www.npmjs.com/package/@rollup/rollup-win32-x64-msvc |
| Apache-2.0 OR MIT | OK | `@tauri-apps/api` | 2.11.1 | https://www.npmjs.com/package/@tauri-apps/api |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli-darwin-arm64` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli-darwin-arm64 |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli-darwin-x64` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli-darwin-x64 |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli-linux-arm-gnueabihf` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli-linux-arm-gnueabihf |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli-linux-arm64-gnu` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli-linux-arm64-gnu |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli-linux-arm64-musl` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli-linux-arm64-musl |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli-linux-riscv64-gnu` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli-linux-riscv64-gnu |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli-linux-x64-gnu` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli-linux-x64-gnu |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli-linux-x64-musl` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli-linux-x64-musl |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli-win32-arm64-msvc` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli-win32-arm64-msvc |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli-win32-ia32-msvc` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli-win32-ia32-msvc |
| Apache-2.0 OR MIT | OK | `@tauri-apps/cli-win32-x64-msvc` | 2.11.2 | https://www.npmjs.com/package/@tauri-apps/cli-win32-x64-msvc |
| MIT OR Apache-2.0 | OK | `@tauri-apps/plugin-dialog` | 2.7.1 | https://www.npmjs.com/package/@tauri-apps/plugin-dialog |
| MIT OR Apache-2.0 | OK | `@tauri-apps/plugin-sql` | 2.4.0 | https://www.npmjs.com/package/@tauri-apps/plugin-sql |
| MIT | OK | `@types/babel__core` | 7.20.5 | https://www.npmjs.com/package/@types/babel__core |
| MIT | OK | `@types/babel__generator` | 7.27.0 | https://www.npmjs.com/package/@types/babel__generator |
| MIT | OK | `@types/babel__template` | 7.4.4 | https://www.npmjs.com/package/@types/babel__template |
| MIT | OK | `@types/babel__traverse` | 7.28.0 | https://www.npmjs.com/package/@types/babel__traverse |
| MIT | OK | `@types/estree` | 1.0.9 | https://www.npmjs.com/package/@types/estree |
| MIT | OK | `@types/node` | 22.19.21 | https://www.npmjs.com/package/@types/node |
| MIT | OK | `@types/prop-types` | 15.7.15 | https://www.npmjs.com/package/@types/prop-types |
| MIT | OK | `@types/react` | 18.3.31 | https://www.npmjs.com/package/@types/react |
| MIT | OK | `@types/react-dom` | 18.3.7 | https://www.npmjs.com/package/@types/react-dom |
| MIT | OK | `@vitejs/plugin-react` | 4.7.0 | https://www.npmjs.com/package/@vitejs/plugin-react |
| MIT | OK | `@vitest/expect` | 2.1.9 | https://www.npmjs.com/package/@vitest/expect |
| MIT | OK | `@vitest/mocker` | 2.1.9 | https://www.npmjs.com/package/@vitest/mocker |
| MIT | OK | `@vitest/pretty-format` | 2.1.9 | https://www.npmjs.com/package/@vitest/pretty-format |
| MIT | OK | `@vitest/runner` | 2.1.9 | https://www.npmjs.com/package/@vitest/runner |
| MIT | OK | `@vitest/snapshot` | 2.1.9 | https://www.npmjs.com/package/@vitest/snapshot |
| MIT | OK | `@vitest/spy` | 2.1.9 | https://www.npmjs.com/package/@vitest/spy |
| MIT | OK | `@vitest/utils` | 2.1.9 | https://www.npmjs.com/package/@vitest/utils |
| MIT | OK | `assertion-error` | 2.0.1 | https://www.npmjs.com/package/assertion-error |
| Apache-2.0 | NOTE | `baseline-browser-mapping` | 2.10.38 | https://www.npmjs.com/package/baseline-browser-mapping |
| MIT | OK | `browserslist` | 4.28.2 | https://www.npmjs.com/package/browserslist |
| MIT | OK | `cac` | 6.7.14 | https://www.npmjs.com/package/cac |
| CC-BY-4.0 | NOTE | `caniuse-lite` | 1.0.30001799 | https://www.npmjs.com/package/caniuse-lite |
| MIT | OK | `chai` | 5.3.3 | https://www.npmjs.com/package/chai |
| MIT | OK | `check-error` | 2.1.3 | https://www.npmjs.com/package/check-error |
| MIT | OK | `convert-source-map` | 2.0.0 | https://www.npmjs.com/package/convert-source-map |
| MIT | OK | `csstype` | 3.2.3 | https://www.npmjs.com/package/csstype |
| MIT | OK | `debug` | 4.4.3 | https://www.npmjs.com/package/debug |
| MIT | OK | `deep-eql` | 5.0.2 | https://www.npmjs.com/package/deep-eql |
| ISC | OK | `electron-to-chromium` | 1.5.375 | https://www.npmjs.com/package/electron-to-chromium |
| MIT | OK | `es-module-lexer` | 1.7.0 | https://www.npmjs.com/package/es-module-lexer |
| MIT | OK | `esbuild` | 0.21.5 | https://www.npmjs.com/package/esbuild |
| MIT | OK | `escalade` | 3.2.0 | https://www.npmjs.com/package/escalade |
| MIT | OK | `estree-walker` | 3.0.3 | https://www.npmjs.com/package/estree-walker |
| Apache-2.0 | NOTE | `expect-type` | 1.3.0 | https://www.npmjs.com/package/expect-type |
| MIT | OK | `fsevents` | 2.3.3 | https://www.npmjs.com/package/fsevents |
| MIT | OK | `gensync` | 1.0.0-beta.2 | https://www.npmjs.com/package/gensync |
| MIT | OK | `js-tokens` | 4.0.0 | https://www.npmjs.com/package/js-tokens |
| MIT | OK | `jsesc` | 3.1.0 | https://www.npmjs.com/package/jsesc |
| MIT | OK | `json5` | 2.2.3 | https://www.npmjs.com/package/json5 |
| MIT | OK | `loose-envify` | 1.4.0 | https://www.npmjs.com/package/loose-envify |
| MIT | OK | `loupe` | 3.2.1 | https://www.npmjs.com/package/loupe |
| ISC | OK | `lru-cache` | 5.1.1 | https://www.npmjs.com/package/lru-cache |
| MIT | OK | `magic-string` | 0.30.21 | https://www.npmjs.com/package/magic-string |
| MIT | OK | `ms` | 2.1.3 | https://www.npmjs.com/package/ms |
| MIT | OK | `nanoid` | 3.3.13 | https://www.npmjs.com/package/nanoid |
| MIT | OK | `node-releases` | 2.0.48 | https://www.npmjs.com/package/node-releases |
| MIT | OK | `pathe` | 1.1.2 | https://www.npmjs.com/package/pathe |
| MIT | OK | `pathval` | 2.0.1 | https://www.npmjs.com/package/pathval |
| ISC | OK | `picocolors` | 1.1.1 | https://www.npmjs.com/package/picocolors |
| MIT | OK | `postcss` | 8.5.15 | https://www.npmjs.com/package/postcss |
| MIT | OK | `react` | 18.3.1 | https://www.npmjs.com/package/react |
| MIT | OK | `react-dom` | 18.3.1 | https://www.npmjs.com/package/react-dom |
| MIT | OK | `react-refresh` | 0.17.0 | https://www.npmjs.com/package/react-refresh |
| MIT | OK | `rollup` | 4.62.0 | https://www.npmjs.com/package/rollup |
| MIT | OK | `scheduler` | 0.23.2 | https://www.npmjs.com/package/scheduler |
| ISC | OK | `semver` | 6.3.1 | https://www.npmjs.com/package/semver |
| ISC | OK | `siginfo` | 2.0.0 | https://www.npmjs.com/package/siginfo |
| BSD-3-Clause | OK | `source-map-js` | 1.2.1 | https://www.npmjs.com/package/source-map-js |
| MIT | OK | `stackback` | 0.0.2 | https://www.npmjs.com/package/stackback |
| MIT | OK | `std-env` | 3.10.0 | https://www.npmjs.com/package/std-env |
| MIT | OK | `tinybench` | 2.9.0 | https://www.npmjs.com/package/tinybench |
| MIT | OK | `tinyexec` | 0.3.2 | https://www.npmjs.com/package/tinyexec |
| MIT | OK | `tinypool` | 1.1.1 | https://www.npmjs.com/package/tinypool |
| MIT | OK | `tinyrainbow` | 1.2.0 | https://www.npmjs.com/package/tinyrainbow |
| MIT | OK | `tinyspy` | 3.0.2 | https://www.npmjs.com/package/tinyspy |
| Apache-2.0 | NOTE | `typescript` | 5.9.3 | https://www.npmjs.com/package/typescript |
| MIT | OK | `undici-types` | 6.21.0 | https://www.npmjs.com/package/undici-types |
| MIT | OK | `update-browserslist-db` | 1.2.3 | https://www.npmjs.com/package/update-browserslist-db |
| MIT | OK | `vite` | 5.4.21 | https://www.npmjs.com/package/vite |
| MIT | OK | `vite-node` | 2.1.9 | https://www.npmjs.com/package/vite-node |
| MIT | OK | `vitest` | 2.1.9 | https://www.npmjs.com/package/vitest |
| MIT | OK | `why-is-node-running` | 2.3.0 | https://www.npmjs.com/package/why-is-node-running |
| ISC | OK | `yallist` | 3.1.1 | https://www.npmjs.com/package/yallist |

## Appendix B — Full Rust crate list (546)

| License | Flag | Package | Version | Source |
|---|---|---|---|---|
| 0BSD OR MIT OR Apache-2.0 | OK | `adler2` | 2.0.1 | https://github.com/oyvindln/adler2 |
| MIT OR Apache-2.0 | OK | `ahash` | 0.7.8 | https://github.com/tkaitchuck/ahash |
| Unlicense OR MIT | OK | `aho-corasick` | 1.1.4 | https://github.com/BurntSushi/aho-corasick |
| BSD-3-Clause | OK | `alloc-no-stdlib` | 2.0.4 | https://github.com/dropbox/rust-alloc-no-stdlib |
| BSD-3-Clause | OK | `alloc-stdlib` | 0.2.4 | https://github.com/dropbox/rust-alloc-no-stdlib |
| MIT OR Apache-2.0 | OK | `allocator-api2` | 0.2.21 | https://github.com/zakarumych/allocator-api2 |
| MIT/Apache-2.0 | OK | `android_system_properties` | 0.1.5 | https://github.com/nical/android_system_properties |
| MIT OR Apache-2.0 | OK | `anyhow` | 1.0.102 | https://github.com/dtolnay/anyhow |
| MIT OR Apache-2.0 | OK | `arrayvec` | 0.7.6 | https://github.com/bluss/arrayvec |
| MIT | OK | `atk` | 0.18.2 | https://github.com/gtk-rs/gtk3-rs |
| MIT | OK | `atk-sys` | 0.18.2 | https://github.com/gtk-rs/gtk3-rs |
| MIT | OK | `atoi` | 2.0.0 | https://github.com/pacman82/atoi-rs |
| Apache-2.0 OR MIT | OK | `atomic-waker` | 1.1.2 | https://github.com/smol-rs/atomic-waker |
| Apache-2.0 OR MIT | OK | `autocfg` | 1.5.1 | https://github.com/cuviper/autocfg |
| MIT OR Apache-2.0 | OK | `base64` | 0.21.7 | https://github.com/marshallpierce/rust-base64 |
| MIT OR Apache-2.0 | OK | `base64` | 0.22.1 | https://github.com/marshallpierce/rust-base64 |
| Apache-2.0 OR MIT | OK | `base64ct` | 1.8.3 | https://github.com/RustCrypto/formats |
| Apache-2.0 OR MIT | OK | `bit-set` | 0.8.0 | https://github.com/contain-rs/bit-set |
| Apache-2.0 OR MIT | OK | `bit-vec` | 0.8.0 | https://github.com/contain-rs/bit-vec |
| MIT/Apache-2.0 | OK | `bitflags` | 1.3.2 | https://github.com/bitflags/bitflags |
| MIT OR Apache-2.0 | OK | `bitflags` | 2.13.0 | https://github.com/bitflags/bitflags |
| MIT | OK | `bitvec` | 1.1.1 | https://github.com/bitvecto-rs/bitvec |
| MIT OR Apache-2.0 | OK | `block-buffer` | 0.10.4 | https://github.com/RustCrypto/utils |
| MIT | OK | `block2` | 0.6.2 | https://github.com/madsmtm/objc2 |
| MIT OR Apache-2.0 | OK | `borsh` | 1.7.0 | https://github.com/near/borsh-rs |
| Apache-2.0 | NOTE | `borsh-derive` | 1.7.0 | https://github.com/near/borsh-rs |
| BSD-3-Clause AND MIT | OK | `brotli` | 8.0.4 | https://github.com/dropbox/rust-brotli |
| BSD-3-Clause/MIT | OK | `brotli-decompressor` | 5.0.3 | https://github.com/dropbox/rust-brotli-decompressor |
| MIT/Apache-2.0 | OK | `bs58` | 0.5.1 | https://github.com/Nullus157/bs58-rs |
| MIT OR Apache-2.0 | OK | `bumpalo` | 3.20.3 | https://github.com/fitzgen/bumpalo |
| MIT | OK | `bytecheck` | 0.6.12 | https://github.com/djkoloski/bytecheck |
| MIT | OK | `bytecheck_derive` | 0.6.12 | https://github.com/djkoloski/bytecheck |
| Zlib OR Apache-2.0 OR MIT | OK | `bytemuck` | 1.25.0 | https://github.com/Lokathor/bytemuck |
| Unlicense OR MIT | OK | `byteorder` | 1.5.0 | https://github.com/BurntSushi/byteorder |
| MIT | OK | `bytes` | 1.12.0 | https://github.com/tokio-rs/bytes |
| MIT | OK | `cairo-rs` | 0.18.5 | https://github.com/gtk-rs/gtk-rs-core |
| MIT | OK | `cairo-sys-rs` | 0.18.2 | https://github.com/gtk-rs/gtk-rs-core |
| MIT OR Apache-2.0 | OK | `camino` | 1.2.3 | https://github.com/camino-rs/camino |
| MIT | OK | `cargo_metadata` | 0.19.2 | https://github.com/oli-obk/cargo_metadata |
| Apache-2.0 OR MIT | OK | `cargo_toml` | 0.22.3 | https://gitlab.com/lib.rs/cargo_toml |
| MIT OR Apache-2.0 | OK | `cargo-platform` | 0.1.9 | https://github.com/rust-lang/cargo |
| MIT OR Apache-2.0 | OK | `cc` | 1.2.64 | https://github.com/rust-lang/cc-rs |
| Apache-2.0/MIT | OK | `cesu8` | 1.1.0 | https://github.com/emk/cesu8-rs |
| MIT | OK | `cfb` | 0.7.3 | https://github.com/mdsteele/rust-cfb |
| MIT | OK | `cfg_aliases` | 0.2.1 | https://github.com/katharostech/cfg_aliases |
| MIT OR Apache-2.0 | OK | `cfg-expr` | 0.15.8 | https://github.com/EmbarkStudios/cfg-expr |
| MIT OR Apache-2.0 | OK | `cfg-if` | 1.0.4 | https://github.com/rust-lang/cfg-if |
| MIT OR Apache-2.0 | OK | `chrono` | 0.4.45 | https://github.com/chronotope/chrono |
| MIT | OK | `combine` | 4.6.7 | https://github.com/Marwes/combine |
| Apache-2.0 OR MIT | OK | `concurrent-queue` | 2.5.0 | https://github.com/smol-rs/concurrent-queue |
| Apache-2.0 OR MIT | OK | `const-oid` | 0.9.6 | https://github.com/RustCrypto/formats/tree/master/const-oid |
| MIT OR Apache-2.0 | OK | `cookie` | 0.18.1 | https://github.com/SergioBenitez/cookie-rs |
| MIT OR Apache-2.0 | OK | `core-foundation` | 0.10.1 | https://github.com/servo/core-foundation-rs |
| MIT OR Apache-2.0 | OK | `core-foundation-sys` | 0.8.7 | https://github.com/servo/core-foundation-rs |
| MIT OR Apache-2.0 | OK | `core-graphics` | 0.25.0 | https://github.com/servo/core-foundation-rs |
| MIT OR Apache-2.0 | OK | `core-graphics-types` | 0.2.0 | https://github.com/servo/core-foundation-rs |
| MIT OR Apache-2.0 | OK | `cpufeatures` | 0.2.17 | https://github.com/RustCrypto/utils |
| MIT OR Apache-2.0 | OK | `crc` | 3.4.0 | https://github.com/mrhooray/crc-rs |
| MIT OR Apache-2.0 | OK | `crc-catalog` | 2.5.0 | https://github.com/akhilles/crc-catalog |
| MIT OR Apache-2.0 | OK | `crc32fast` | 1.5.0 | https://github.com/srijs/rust-crc32fast |
| MIT OR Apache-2.0 | OK | `crossbeam-channel` | 0.5.15 | https://github.com/crossbeam-rs/crossbeam |
| MIT OR Apache-2.0 | OK | `crossbeam-queue` | 0.3.12 | https://github.com/crossbeam-rs/crossbeam |
| MIT OR Apache-2.0 | OK | `crossbeam-utils` | 0.8.21 | https://github.com/crossbeam-rs/crossbeam |
| MIT OR Apache-2.0 | OK | `crypto-common` | 0.1.7 | https://github.com/RustCrypto/traits |
| MPL-2.0 | REVIEW | `cssparser` | 0.36.0 | https://github.com/servo/rust-cssparser |
| MPL-2.0 | REVIEW | `cssparser-macros` | 0.6.1 | https://github.com/servo/rust-cssparser |
| Apache-2.0 OR MIT | OK | `ctor` | 0.8.0 | https://github.com/mmastrac/rust-ctor |
| Apache-2.0 OR MIT | OK | `ctor-proc-macro` | 0.0.7 | https://github.com/mmastrac/rust-ctor |
| MIT | OK | `darling` | 0.23.0 | https://github.com/TedDriggs/darling |
| MIT | OK | `darling_core` | 0.23.0 | https://github.com/TedDriggs/darling |
| MIT | OK | `darling_macro` | 0.23.0 | https://github.com/TedDriggs/darling |
| Apache-2.0/MIT | OK | `dbus` | 0.9.11 | https://github.com/diwic/dbus-rs |
| Apache-2.0 OR MIT | OK | `der` | 0.7.10 | https://github.com/RustCrypto/formats/tree/master/der |
| MIT OR Apache-2.0 | OK | `deranged` | 0.5.8 | https://github.com/jhpratt/deranged |
| MIT | OK | `derive_more` | 2.1.1 | https://github.com/JelteF/derive_more |
| MIT | OK | `derive_more-impl` | 2.1.1 | https://github.com/JelteF/derive_more |
| MIT OR Apache-2.0 | OK | `digest` | 0.10.7 | https://github.com/RustCrypto/traits |
| MIT OR Apache-2.0 | OK | `dirs` | 6.0.0 | https://github.com/soc/dirs-rs |
| MIT OR Apache-2.0 | OK | `dirs-sys` | 0.5.0 | https://github.com/dirs-dev/dirs-sys-rs |
| Zlib OR Apache-2.0 OR MIT | OK | `dispatch2` | 0.3.1 | https://github.com/madsmtm/objc2 |
| MIT OR Apache-2.0 | OK | `displaydoc` | 0.2.6 | https://github.com/yaahc/displaydoc |
| MIT | OK | `dlopen2` | 0.8.2 | https://github.com/OpenByteDev/dlopen2 |
| MIT | OK | `dlopen2_derive` | 0.4.3 | https://github.com/OpenByteDev/dlopen2 |
| MIT | OK | `dom_query` | 0.27.0 | https://github.com/niklak/dom_query |
| MIT | OK | `dotenvy` | 0.15.7 | https://github.com/allan2/dotenvy |
| Apache-2.0 AND MIT | OK | `dpi` | 0.1.2 | https://github.com/rust-windowing/winit |
| MIT OR Apache-2.0 | OK | `dtoa` | 1.0.11 | https://github.com/dtolnay/dtoa |
| MPL-2.0 | REVIEW | `dtoa-short` | 0.3.5 | https://github.com/upsuper/dtoa-short |
| Apache-2.0 OR MIT | OK | `dtor` | 0.3.0 | https://github.com/mmastrac/rust-ctor |
| Apache-2.0 OR MIT | OK | `dtor-proc-macro` | 0.0.6 | https://github.com/mmastrac/rust-ctor |
| CC0-1.0 OR MIT-0 OR Apache-2.0 | OK | `dunce` | 1.0.5 | https://gitlab.com/kornelski/dunce |
| MIT OR Apache-2.0 | OK | `dyn-clone` | 1.0.20 | https://github.com/dtolnay/dyn-clone |
| MIT OR Apache-2.0 | OK | `either` | 1.16.0 | https://github.com/rayon-rs/either |
| MIT OR Apache-2.0 | OK | `embed_plist` | 1.2.2 | https://github.com/nvzqz/embed-plist-rs |
| MIT | OK | `embed-resource` | 3.0.9 | https://github.com/nabijaczleweli/rust-embed-resource |
| Apache-2.0 OR MIT | OK | `equivalent` | 1.0.2 | https://github.com/indexmap-rs/equivalent |
| MIT OR Apache-2.0 | OK | `erased-serde` | 0.4.10 | https://github.com/dtolnay/erased-serde |
| MIT OR Apache-2.0 | OK | `errno` | 0.3.14 | https://github.com/lambda-fairy/rust-errno |
| MIT OR Apache-2.0 | OK | `etcetera` | 0.8.0 | https://github.com/lunacookies/etcetera |
| Apache-2.0 OR MIT | OK | `event-listener` | 5.4.1 | https://github.com/smol-rs/event-listener |
| Apache-2.0 OR MIT | OK | `fastrand` | 2.4.1 | https://github.com/smol-rs/fastrand |
| MIT OR Apache-2.0 | OK | `fdeflate` | 0.3.7 | https://github.com/image-rs/fdeflate |
| MIT OR Apache-2.0 | OK | `field-offset` | 0.3.6 | https://github.com/Diggsey/rust-field-offset |
| MIT OR Apache-2.0 | OK | `find-msvc-tools` | 0.1.9 | https://github.com/rust-lang/cc-rs |
| MIT OR Apache-2.0 | OK | `flate2` | 1.1.9 | https://github.com/rust-lang/flate2-rs |
| Apache-2.0/MIT | OK | `flume` | 0.11.1 | https://github.com/zesterer/flume |
| Apache-2.0 / MIT | OK | `fnv` | 1.0.7 | https://github.com/servo/rust-fnv |
| Zlib | OK | `foldhash` | 0.1.5 | https://github.com/orlp/foldhash |
| Zlib | OK | `foldhash` | 0.2.0 | https://github.com/orlp/foldhash |
| MIT/Apache-2.0 | OK | `foreign-types` | 0.3.2 | https://github.com/sfackler/foreign-types |
| MIT/Apache-2.0 | OK | `foreign-types` | 0.5.0 | https://github.com/sfackler/foreign-types |
| MIT/Apache-2.0 | OK | `foreign-types-macros` | 0.2.3 | https://github.com/sfackler/foreign-types |
| MIT/Apache-2.0 | OK | `foreign-types-shared` | 0.1.1 | https://github.com/sfackler/foreign-types |
| MIT/Apache-2.0 | OK | `foreign-types-shared` | 0.3.1 | https://github.com/sfackler/foreign-types |
| MIT OR Apache-2.0 | OK | `form_urlencoded` | 1.2.2 | https://github.com/servo/rust-url |
| MIT | OK | `funty` | 2.0.0 | https://github.com/myrrlyn/funty |
| MIT OR Apache-2.0 | OK | `futures-channel` | 0.3.32 | https://github.com/rust-lang/futures-rs |
| MIT OR Apache-2.0 | OK | `futures-core` | 0.3.32 | https://github.com/rust-lang/futures-rs |
| MIT OR Apache-2.0 | OK | `futures-executor` | 0.3.32 | https://github.com/rust-lang/futures-rs |
| MIT OR Apache-2.0 | OK | `futures-intrusive` | 0.5.0 | https://github.com/Matthias247/futures-intrusive |
| MIT OR Apache-2.0 | OK | `futures-io` | 0.3.32 | https://github.com/rust-lang/futures-rs |
| MIT OR Apache-2.0 | OK | `futures-macro` | 0.3.32 | https://github.com/rust-lang/futures-rs |
| MIT OR Apache-2.0 | OK | `futures-sink` | 0.3.32 | https://github.com/rust-lang/futures-rs |
| MIT OR Apache-2.0 | OK | `futures-task` | 0.3.32 | https://github.com/rust-lang/futures-rs |
| MIT OR Apache-2.0 | OK | `futures-util` | 0.3.32 | https://github.com/rust-lang/futures-rs |
| MIT | OK | `gdk` | 0.18.2 | https://github.com/gtk-rs/gtk3-rs |
| MIT | OK | `gdk-pixbuf` | 0.18.5 | https://github.com/gtk-rs/gtk-rs-core |
| MIT | OK | `gdk-pixbuf-sys` | 0.18.0 | https://github.com/gtk-rs/gtk-rs-core |
| MIT | OK | `gdk-sys` | 0.18.2 | https://github.com/gtk-rs/gtk3-rs |
| MIT | OK | `gdkwayland-sys` | 0.18.2 | https://github.com/gtk-rs/gtk3-rs |
| MIT | OK | `gdkx11` | 0.18.2 | https://github.com/gtk-rs/gtk3-rs |
| MIT | OK | `gdkx11-sys` | 0.18.2 | https://github.com/gtk-rs/gtk3-rs |
| MIT | OK | `generic-array` | 0.14.7 | https://github.com/fizyk20/generic-array |
| MIT OR Apache-2.0 | OK | `getrandom` | 0.2.17 | https://github.com/rust-random/getrandom |
| MIT OR Apache-2.0 | OK | `getrandom` | 0.3.4 | https://github.com/rust-random/getrandom |
| MIT OR Apache-2.0 | OK | `getrandom` | 0.4.3 | https://github.com/rust-random/getrandom |
| MIT | OK | `gio` | 0.18.4 | https://github.com/gtk-rs/gtk-rs-core |
| MIT | OK | `gio-sys` | 0.18.1 | https://github.com/gtk-rs/gtk-rs-core |
| MIT | OK | `glib` | 0.18.5 | https://github.com/gtk-rs/gtk-rs-core |
| MIT | OK | `glib-macros` | 0.18.5 | https://github.com/gtk-rs/gtk-rs-core |
| MIT | OK | `glib-sys` | 0.18.1 | https://github.com/gtk-rs/gtk-rs-core |
| MIT OR Apache-2.0 | OK | `glob` | 0.3.3 | https://github.com/rust-lang/glob |
| MIT | OK | `gobject-sys` | 0.18.0 | https://github.com/gtk-rs/gtk-rs-core |
| MIT | OK | `gtk` | 0.18.2 | https://github.com/gtk-rs/gtk3-rs |
| MIT | OK | `gtk-sys` | 0.18.2 | https://github.com/gtk-rs/gtk3-rs |
| MIT | OK | `gtk3-macros` | 0.18.2 | https://github.com/gtk-rs/gtk3-rs |
| MIT OR Apache-2.0 | OK | `hashbrown` | 0.12.3 | https://github.com/rust-lang/hashbrown |
| MIT OR Apache-2.0 | OK | `hashbrown` | 0.15.5 | https://github.com/rust-lang/hashbrown |
| MIT OR Apache-2.0 | OK | `hashbrown` | 0.17.1 | https://github.com/rust-lang/hashbrown |
| MIT OR Apache-2.0 | OK | `hashlink` | 0.10.0 | https://github.com/kyren/hashlink |
| MIT OR Apache-2.0 | OK | `heck` | 0.4.1 | https://github.com/withoutboats/heck |
| MIT OR Apache-2.0 | OK | `heck` | 0.5.0 | https://github.com/withoutboats/heck |
| MIT OR Apache-2.0 | OK | `hex` | 0.4.3 | https://github.com/KokaKiwi/rust-hex |
| MIT OR Apache-2.0 | OK | `hkdf` | 0.12.4 | https://github.com/RustCrypto/KDFs/ |
| MIT OR Apache-2.0 | OK | `hmac` | 0.12.1 | https://github.com/RustCrypto/MACs |
| MIT OR Apache-2.0 | OK | `home` | 0.5.12 | https://github.com/rust-lang/cargo |
| MIT OR Apache-2.0 | OK | `html5ever` | 0.38.0 | https://github.com/servo/html5ever |
| MIT OR Apache-2.0 | OK | `http` | 1.4.2 | https://github.com/hyperium/http |
| MIT | OK | `http-body` | 1.0.1 | https://github.com/hyperium/http-body |
| MIT | OK | `http-body-util` | 0.1.3 | https://github.com/hyperium/http-body |
| MIT OR Apache-2.0 | OK | `httparse` | 1.10.1 | https://github.com/seanmonstar/httparse |
| MIT | OK | `hyper` | 1.10.1 | https://github.com/hyperium/hyper |
| MIT/Apache-2.0 | OK | `hyper-tls` | 0.6.0 | https://github.com/hyperium/hyper-tls |
| MIT | OK | `hyper-util` | 0.1.20 | https://github.com/hyperium/hyper-util |
| MIT OR Apache-2.0 | OK | `iana-time-zone` | 0.1.65 | https://github.com/strawlab/iana-time-zone |
| MIT OR Apache-2.0 | OK | `iana-time-zone-haiku` | 0.1.2 | https://github.com/strawlab/iana-time-zone |
| MIT | OK | `ico` | 0.5.0 | https://github.com/mdsteele/rust-ico |
| Unicode-3.0 | OK | `icu_collections` | 2.2.0 | https://github.com/unicode-org/icu4x |
| Unicode-3.0 | OK | `icu_locale_core` | 2.2.0 | https://github.com/unicode-org/icu4x |
| Unicode-3.0 | OK | `icu_normalizer` | 2.2.0 | https://github.com/unicode-org/icu4x |
| Unicode-3.0 | OK | `icu_normalizer_data` | 2.2.0 | https://github.com/unicode-org/icu4x |
| Unicode-3.0 | OK | `icu_properties` | 2.2.0 | https://github.com/unicode-org/icu4x |
| Unicode-3.0 | OK | `icu_properties_data` | 2.2.0 | https://github.com/unicode-org/icu4x |
| Unicode-3.0 | OK | `icu_provider` | 2.2.0 | https://github.com/unicode-org/icu4x |
| MIT/Apache-2.0 | OK | `ident_case` | 1.0.1 | https://github.com/TedDriggs/ident_case |
| MIT OR Apache-2.0 | OK | `idna` | 1.1.0 | https://github.com/servo/rust-url/ |
| Apache-2.0 OR MIT | OK | `idna_adapter` | 1.2.2 | https://github.com/hsivonen/idna_adapter |
| Apache-2.0 OR MIT | OK | `indexmap` | 1.9.3 | https://github.com/bluss/indexmap |
| Apache-2.0 OR MIT | OK | `indexmap` | 2.14.0 | https://github.com/indexmap-rs/indexmap |
| MIT | OK | `infer` | 0.19.0 | https://github.com/bojand/infer |
| MIT OR Apache-2.0 | OK | `ipnet` | 2.12.0 | https://github.com/krisprice/ipnet |
| MIT OR Apache-2.0 | OK | `itoa` | 1.0.18 | https://github.com/dtolnay/itoa |
| MIT | OK | `javascriptcore-rs` | 1.1.2 | https://github.com/tauri-apps/javascriptcore-rs |
| MIT | OK | `javascriptcore-rs-sys` | 1.1.1 | https://github.com/tauri-apps/javascriptcore-rs |
| MIT/Apache-2.0 | OK | `jni` | 0.21.1 | https://github.com/jni-rs/jni-rs |
| MIT OR Apache-2.0 | OK | `jni-sys` | 0.3.1 | https://github.com/jni-rs/jni-sys |
| MIT OR Apache-2.0 | OK | `jni-sys` | 0.4.1 | https://github.com/jni-rs/jni-sys |
| MIT OR Apache-2.0 | OK | `jni-sys-macros` | 0.4.1 | https://github.com/jni-rs/jni-sys |
| MIT OR Apache-2.0 | OK | `js-sys` | 0.3.102 | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/js-sys |
| MIT/Apache-2.0 | OK | `json-patch` | 3.0.1 | https://github.com/idubrov/json-patch |
| MIT OR Apache-2.0 | OK | `jsonptr` | 0.6.3 | https://github.com/chanced/jsonptr |
| MIT OR Apache-2.0 | OK | `keyboard-types` | 0.7.0 | https://github.com/pyfisch/keyboard-types |
| MIT OR Apache-2.0 | OK | `lazy_static` | 1.5.0 | https://github.com/rust-lang-nursery/lazy-static.rs |
| Apache-2.0 OR MIT | OK | `libappindicator` | 0.9.0 |  |
| Apache-2.0 OR MIT | OK | `libappindicator-sys` | 0.9.0 |  |
| MIT OR Apache-2.0 | OK | `libc` | 0.2.186 | https://github.com/rust-lang/libc |
| Apache-2.0/MIT | OK | `libdbus-sys` | 0.2.7 | https://github.com/diwic/dbus-rs |
| ISC | OK | `libloading` | 0.7.4 | https://github.com/nagisa/rust_libloading/ |
| MIT | OK | `libm` | 0.2.16 | https://github.com/rust-lang/compiler-builtins |
| MIT | OK | `libredox` | 0.1.17 | https://gitlab.redox-os.org/redox-os/libredox |
| MIT | OK | `libsqlite3-sys` | 0.30.1 | https://github.com/rusqlite/rusqlite |
| Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | OK | `linux-raw-sys` | 0.12.1 | https://github.com/sunfishcode/linux-raw-sys |
| Unicode-3.0 | OK | `litemap` | 0.8.2 | https://github.com/unicode-org/icu4x |
| MIT OR Apache-2.0 | OK | `lock_api` | 0.4.14 | https://github.com/Amanieu/parking_lot |
| MIT OR Apache-2.0 | OK | `log` | 0.4.32 | https://github.com/rust-lang/log |
| MIT OR Apache-2.0 | OK | `markup5ever` | 0.38.0 | https://github.com/servo/html5ever |
| MIT OR Apache-2.0 | OK | `md-5` | 0.10.6 | https://github.com/RustCrypto/hashes |
| Unlicense OR MIT | OK | `memchr` | 2.8.2 | https://github.com/BurntSushi/memchr |
| MIT | OK | `memoffset` | 0.9.1 | https://github.com/Gilnaa/memoffset |
| MIT OR Apache-2.0 | OK | `mime` | 0.3.17 | https://github.com/hyperium/mime |
| MIT OR Zlib OR Apache-2.0 | OK | `miniz_oxide` | 0.8.9 | https://github.com/Frommi/miniz_oxide/tree/master/miniz_oxide |
| MIT | OK | `mio` | 1.2.1 | https://github.com/tokio-rs/mio |
| Apache-2.0 OR MIT | OK | `muda` | 0.19.3 | https://github.com/tauri-apps/muda |
| MIT OR Apache-2.0 | OK | `native-tls` | 0.2.18 | https://github.com/rust-native-tls/rust-native-tls |
| MIT OR Apache-2.0 | OK | `ndk` | 0.9.0 | https://github.com/rust-mobile/ndk |
| MIT OR Apache-2.0 | OK | `ndk-sys` | 0.6.0+11769913 | https://github.com/rust-mobile/ndk |
| MIT | OK | `new_debug_unreachable` | 1.0.6 | https://github.com/mbrubeck/rust-debug-unreachable |
| BSD-3-Clause OR MIT OR Apache-2.0 | OK | `num_enum` | 0.7.6 | https://github.com/illicitonion/num_enum |
| BSD-3-Clause OR MIT OR Apache-2.0 | OK | `num_enum_derive` | 0.7.6 | https://github.com/illicitonion/num_enum |
| MIT/Apache-2.0 | OK | `num-bigint-dig` | 0.8.6 | https://github.com/dignifiedquire/num-bigint |
| MIT OR Apache-2.0 | OK | `num-conv` | 0.2.2 | https://github.com/jhpratt/num-conv |
| MIT OR Apache-2.0 | OK | `num-integer` | 0.1.46 | https://github.com/rust-num/num-integer |
| MIT OR Apache-2.0 | OK | `num-iter` | 0.1.45 | https://github.com/rust-num/num-iter |
| MIT OR Apache-2.0 | OK | `num-traits` | 0.2.19 | https://github.com/rust-num/num-traits |
| MIT | OK | `objc2` | 0.6.4 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-app-kit` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-cloud-kit` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-core-data` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-core-foundation` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-core-graphics` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-core-image` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-core-location` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-core-text` | 0.3.2 | https://github.com/madsmtm/objc2 |
| MIT | OK | `objc2-encode` | 4.1.0 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-exception-helper` | 0.1.1 | https://github.com/madsmtm/objc2 |
| MIT | OK | `objc2-foundation` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-io-surface` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-quartz-core` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-ui-kit` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-user-notifications` | 0.3.2 | https://github.com/madsmtm/objc2 |
| Zlib OR Apache-2.0 OR MIT | OK | `objc2-web-kit` | 0.3.2 | https://github.com/madsmtm/objc2 |
| MIT OR Apache-2.0 | OK | `once_cell` | 1.21.4 | https://github.com/matklad/once_cell |
| Apache-2.0 | NOTE | `openssl` | 0.10.81 | https://github.com/rust-openssl/rust-openssl |
| MIT/Apache-2.0 | OK | `openssl-macros` | 0.1.1 |  |
| MIT OR Apache-2.0 | OK | `openssl-probe` | 0.2.1 | https://github.com/rustls/openssl-probe |
| MIT | OK | `openssl-sys` | 0.9.117 | https://github.com/rust-openssl/rust-openssl |
| MPL-2.0 | REVIEW | `option-ext` | 0.2.0 | https://github.com/soc/option-ext |
| MIT | OK | `pango` | 0.18.3 | https://github.com/gtk-rs/gtk-rs-core |
| MIT | OK | `pango-sys` | 0.18.0 | https://github.com/gtk-rs/gtk-rs-core |
| Apache-2.0 OR MIT | OK | `parking` | 2.2.1 | https://github.com/smol-rs/parking |
| MIT OR Apache-2.0 | OK | `parking_lot` | 0.12.5 | https://github.com/Amanieu/parking_lot |
| MIT OR Apache-2.0 | OK | `parking_lot_core` | 0.9.12 | https://github.com/Amanieu/parking_lot |
| Apache-2.0 OR MIT | OK | `pem-rfc7468` | 0.7.0 | https://github.com/RustCrypto/formats/tree/master/pem-rfc7468 |
| MIT OR Apache-2.0 | OK | `percent-encoding` | 2.3.2 | https://github.com/servo/rust-url/ |
| MIT | OK | `phf` | 0.13.1 | https://github.com/rust-phf/rust-phf |
| MIT | OK | `phf_codegen` | 0.13.1 | https://github.com/rust-phf/rust-phf |
| MIT | OK | `phf_generator` | 0.13.1 | https://github.com/rust-phf/rust-phf |
| MIT | OK | `phf_macros` | 0.13.1 | https://github.com/rust-phf/rust-phf |
| MIT | OK | `phf_shared` | 0.13.1 | https://github.com/rust-phf/rust-phf |
| Apache-2.0 OR MIT | OK | `pin-project-lite` | 0.2.17 | https://github.com/taiki-e/pin-project-lite |
| Apache-2.0 OR MIT | OK | `pkcs1` | 0.7.5 | https://github.com/RustCrypto/formats/tree/master/pkcs1 |
| Apache-2.0 OR MIT | OK | `pkcs8` | 0.10.2 | https://github.com/RustCrypto/formats/tree/master/pkcs8 |
| MIT OR Apache-2.0 | OK | `pkg-config` | 0.3.33 | https://github.com/rust-lang/pkg-config-rs |
| MIT/Apache-2.0 | OK | `plain` | 0.2.3 | https://github.com/randomites/plain |
| MIT | OK | `plist` | 1.9.0 | https://github.com/ebarnard/rust-plist/ |
| MIT OR Apache-2.0 | OK | `png` | 0.17.16 | https://github.com/image-rs/image-png |
| MIT OR Apache-2.0 | OK | `png` | 0.18.1 | https://github.com/image-rs/image-png |
| Unicode-3.0 | OK | `potential_utf` | 0.1.5 | https://github.com/unicode-org/icu4x |
| MIT OR Apache-2.0 | OK | `powerfmt` | 0.2.0 | https://github.com/jhpratt/powerfmt |
| MIT OR Apache-2.0 | OK | `ppv-lite86` | 0.2.21 | https://github.com/cryptocorrosion/cryptocorrosion |
| MIT | OK | `precomputed-hash` | 0.1.1 | https://github.com/emilio/precomputed-hash |
| MIT OR Apache-2.0 | OK | `proc-macro-crate` | 1.3.1 | https://github.com/bkchr/proc-macro-crate |
| MIT OR Apache-2.0 | OK | `proc-macro-crate` | 2.0.2 | https://github.com/bkchr/proc-macro-crate |
| MIT OR Apache-2.0 | OK | `proc-macro-crate` | 3.5.0 | https://github.com/bkchr/proc-macro-crate |
| MIT OR Apache-2.0 | OK | `proc-macro-error` | 1.0.4 | https://gitlab.com/CreepySkeleton/proc-macro-error |
| MIT OR Apache-2.0 | OK | `proc-macro-error-attr` | 1.0.4 | https://gitlab.com/CreepySkeleton/proc-macro-error |
| MIT OR Apache-2.0 | OK | `proc-macro2` | 1.0.106 | https://github.com/dtolnay/proc-macro2 |
| MIT | OK | `ptr_meta` | 0.1.4 | https://github.com/djkoloski/ptr_meta |
| MIT | OK | `ptr_meta_derive` | 0.1.4 | https://github.com/djkoloski/ptr_meta |
| MIT | OK | `quick-xml` | 0.39.4 | https://github.com/tafia/quick-xml |
| MIT OR Apache-2.0 | OK | `quote` | 1.0.45 | https://github.com/dtolnay/quote |
| MIT OR Apache-2.0 OR LGPL-2.1-or-later | OK | `r-efi` | 5.3.0 | https://github.com/r-efi/r-efi |
| MIT OR Apache-2.0 OR LGPL-2.1-or-later | OK | `r-efi` | 6.0.0 | https://github.com/r-efi/r-efi |
| MIT | OK | `radium` | 0.7.0 | https://github.com/bitvecto-rs/radium |
| MIT OR Apache-2.0 | OK | `rand` | 0.8.6 | https://github.com/rust-random/rand |
| MIT OR Apache-2.0 | OK | `rand_chacha` | 0.3.1 | https://github.com/rust-random/rand |
| MIT OR Apache-2.0 | OK | `rand_core` | 0.6.4 | https://github.com/rust-random/rand |
| MIT OR Apache-2.0 OR Zlib | OK | `raw-window-handle` | 0.6.2 | https://github.com/rust-windowing/raw-window-handle |
| MIT | OK | `redox_syscall` | 0.5.18 | https://gitlab.redox-os.org/redox-os/syscall |
| MIT | OK | `redox_syscall` | 0.8.1 | https://gitlab.redox-os.org/redox-os/syscall |
| MIT | OK | `redox_users` | 0.5.2 | https://gitlab.redox-os.org/redox-os/users |
| MIT OR Apache-2.0 | OK | `ref-cast` | 1.0.25 | https://github.com/dtolnay/ref-cast |
| MIT OR Apache-2.0 | OK | `ref-cast-impl` | 1.0.25 | https://github.com/dtolnay/ref-cast |
| MIT OR Apache-2.0 | OK | `regex` | 1.12.4 | https://github.com/rust-lang/regex |
| MIT OR Apache-2.0 | OK | `regex-automata` | 0.4.14 | https://github.com/rust-lang/regex |
| MIT OR Apache-2.0 | OK | `regex-syntax` | 0.8.11 | https://github.com/rust-lang/regex |
| MIT | OK | `rend` | 0.4.2 | https://github.com/djkoloski/rend |
| MIT OR Apache-2.0 | OK | `reqwest` | 0.12.28 | https://github.com/seanmonstar/reqwest |
| MIT OR Apache-2.0 | OK | `reqwest` | 0.13.4 | https://github.com/seanmonstar/reqwest |
| MIT | OK | `rfd` | 0.16.0 | https://github.com/PolyMeilex/rfd |
| MIT | OK | `rkyv` | 0.7.46 | https://github.com/rkyv/rkyv |
| MIT | OK | `rkyv_derive` | 0.7.46 | https://github.com/rkyv/rkyv |
| MIT OR Apache-2.0 | OK | `rsa` | 0.9.10 | https://github.com/RustCrypto/RSA |
| MIT | OK | `rust_decimal` | 1.42.1 | https://github.com/paupino/rust-decimal |
| MIT OR Apache-2.0 | OK | `rustc_version` | 0.4.1 | https://github.com/djc/rustc-version-rs |
| Apache-2.0 OR MIT | OK | `rustc-hash` | 2.1.2 | https://github.com/rust-lang/rustc-hash |
| Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | OK | `rustix` | 1.1.4 | https://github.com/bytecodealliance/rustix |
| MIT OR Apache-2.0 | OK | `rustls-pki-types` | 1.14.1 | https://github.com/rustls/pki-types |
| MIT OR Apache-2.0 | OK | `rustversion` | 1.0.22 | https://github.com/dtolnay/rustversion |
| Apache-2.0 OR BSL-1.0 | NOTE | `ryu` | 1.0.23 | https://github.com/dtolnay/ryu |
| Unlicense/MIT | OK | `same-file` | 1.0.6 | https://github.com/BurntSushi/same-file |
| MIT | OK | `schannel` | 0.1.29 | https://github.com/steffengy/schannel-rs |
| MIT | OK | `schemars` | 0.8.22 | https://github.com/GREsau/schemars |
| MIT | OK | `schemars` | 0.9.0 | https://github.com/GREsau/schemars |
| MIT | OK | `schemars` | 1.2.1 | https://github.com/GREsau/schemars |
| MIT | OK | `schemars_derive` | 0.8.22 | https://github.com/GREsau/schemars |
| MIT OR Apache-2.0 | OK | `scopeguard` | 1.2.0 | https://github.com/bluss/scopeguard |
| MIT | OK | `seahash` | 4.1.0 | https://gitlab.redox-os.org/redox-os/seahash |
| MIT OR Apache-2.0 | OK | `security-framework` | 3.7.0 | https://github.com/kornelski/rust-security-framework |
| MIT OR Apache-2.0 | OK | `security-framework-sys` | 2.17.0 | https://github.com/kornelski/rust-security-framework |
| MPL-2.0 | REVIEW | `selectors` | 0.36.1 | https://github.com/servo/stylo |
| MIT OR Apache-2.0 | OK | `semver` | 1.0.28 | https://github.com/dtolnay/semver |
| MIT OR Apache-2.0 | OK | `serde` | 1.0.228 | https://github.com/serde-rs/serde |
| MIT OR Apache-2.0 | OK | `serde_core` | 1.0.228 | https://github.com/serde-rs/serde |
| MIT OR Apache-2.0 | OK | `serde_derive` | 1.0.228 | https://github.com/serde-rs/serde |
| MIT OR Apache-2.0 | OK | `serde_derive_internals` | 0.29.1 | https://github.com/serde-rs/serde |
| MIT OR Apache-2.0 | OK | `serde_json` | 1.0.150 | https://github.com/serde-rs/json |
| MIT OR Apache-2.0 | OK | `serde_repr` | 0.1.20 | https://github.com/dtolnay/serde-repr |
| MIT OR Apache-2.0 | OK | `serde_spanned` | 0.6.9 | https://github.com/toml-rs/toml |
| MIT OR Apache-2.0 | OK | `serde_spanned` | 1.1.1 | https://github.com/toml-rs/toml |
| MIT/Apache-2.0 | OK | `serde_urlencoded` | 0.7.1 | https://github.com/nox/serde_urlencoded |
| MIT OR Apache-2.0 | OK | `serde_with` | 3.21.0 | https://github.com/jonasbb/serde_with/ |
| MIT OR Apache-2.0 | OK | `serde_with_macros` | 3.21.0 | https://github.com/jonasbb/serde_with/ |
| MIT OR Apache-2.0 | OK | `serde-untagged` | 0.1.9 | https://github.com/dtolnay/serde-untagged |
| MIT OR Apache-2.0 | OK | `serialize-to-javascript` | 0.1.2 | https://github.com/chippers/serialize-to-javascript |
| MIT OR Apache-2.0 | OK | `serialize-to-javascript-impl` | 0.1.2 | https://github.com/chippers/serialize-to-javascript |
| MIT OR Apache-2.0 | OK | `servo_arc` | 0.4.3 | https://github.com/servo/stylo |
| MIT OR Apache-2.0 | OK | `sha1` | 0.10.6 | https://github.com/RustCrypto/hashes |
| MIT OR Apache-2.0 | OK | `sha2` | 0.10.9 | https://github.com/RustCrypto/hashes |
| MIT OR Apache-2.0 | OK | `shlex` | 2.0.1 | https://github.com/comex/rust-shlex |
| Apache-2.0 OR MIT | OK | `signature` | 2.2.0 | https://github.com/RustCrypto/traits/tree/master/signature |
| MIT | OK | `simd-adler32` | 0.3.9 | https://github.com/mcountryman/simd-adler32 |
| MIT OR Apache-2.0 | OK | `simdutf8` | 0.1.5 | https://github.com/rusticstuff/simdutf8 |
| MIT/Apache-2.0 | OK | `siphasher` | 1.0.3 | https://github.com/jedisct1/rust-siphash |
| MIT | OK | `slab` | 0.4.12 | https://github.com/tokio-rs/slab |
| MIT OR Apache-2.0 | OK | `smallvec` | 1.15.2 | https://github.com/servo/rust-smallvec |
| MIT OR Apache-2.0 | OK | `socket2` | 0.6.4 | https://github.com/rust-lang/socket2 |
| MIT OR Apache-2.0 | OK | `softbuffer` | 0.4.8 | https://github.com/rust-windowing/softbuffer |
| MIT | OK | `soup3` | 0.5.0 | https://gitlab.gnome.org/World/Rust/soup3-rs |
| MIT | OK | `soup3-sys` | 0.5.0 | https://gitlab.gnome.org/World/Rust/soup3-rs |
| MIT | OK | `spin` | 0.9.8 | https://github.com/mvdnes/spin-rs |
| Apache-2.0 OR MIT | OK | `spki` | 0.7.3 | https://github.com/RustCrypto/formats/tree/master/spki |
| MIT OR Apache-2.0 | OK | `sqlx` | 0.8.6 | https://github.com/launchbadge/sqlx |
| MIT OR Apache-2.0 | OK | `sqlx-core` | 0.8.6 | https://github.com/launchbadge/sqlx |
| MIT OR Apache-2.0 | OK | `sqlx-macros` | 0.8.6 | https://github.com/launchbadge/sqlx |
| MIT OR Apache-2.0 | OK | `sqlx-macros-core` | 0.8.6 | https://github.com/launchbadge/sqlx |
| MIT OR Apache-2.0 | OK | `sqlx-mysql` | 0.8.6 | https://github.com/launchbadge/sqlx |
| MIT OR Apache-2.0 | OK | `sqlx-postgres` | 0.8.6 | https://github.com/launchbadge/sqlx |
| MIT OR Apache-2.0 | OK | `sqlx-sqlite` | 0.8.6 | https://github.com/launchbadge/sqlx |
| MIT OR Apache-2.0 | OK | `stable_deref_trait` | 1.2.1 | https://github.com/storyyeller/stable_deref_trait |
| MIT OR Apache-2.0 | OK | `string_cache` | 0.9.0 | https://github.com/servo/string-cache |
| MIT OR Apache-2.0 | OK | `string_cache_codegen` | 0.6.1 | https://github.com/servo/string-cache |
| MIT/Apache-2.0 | OK | `stringprep` | 0.1.5 | https://github.com/sfackler/rust-stringprep |
| MIT | OK | `strsim` | 0.11.1 | https://github.com/rapidfuzz/strsim-rs |
| BSD-3-Clause | OK | `subtle` | 2.6.1 | https://github.com/dalek-cryptography/subtle |
| MIT OR Apache-2.0 | OK | `swift-rs` | 1.0.7 | https://github.com/Brendonovich/swift-rs |
| MIT OR Apache-2.0 | OK | `syn` | 1.0.109 | https://github.com/dtolnay/syn |
| MIT OR Apache-2.0 | OK | `syn` | 2.0.118 | https://github.com/dtolnay/syn |
| Apache-2.0 | NOTE | `sync_wrapper` | 1.0.2 | https://github.com/Actyx/sync_wrapper |
| MIT | OK | `synstructure` | 0.13.2 | https://github.com/mystor/synstructure |
| MIT OR Apache-2.0 | OK | `system-deps` | 6.2.2 | https://github.com/gdesmott/system-deps |
| Apache-2.0 | NOTE | `tao` | 0.35.3 | https://github.com/tauri-apps/tao |
| MIT OR Apache-2.0 | OK | `tao-macros` | 0.1.3 | https://github.com/tauri-apps/tao |
| MIT | OK | `tap` | 1.0.1 | https://github.com/myrrlyn/tap |
| Apache-2.0 WITH LLVM-exception | NOTE | `target-lexicon` | 0.12.16 | https://github.com/bytecodealliance/target-lexicon |
| Apache-2.0 OR MIT | OK | `tauri` | 2.11.3 | https://github.com/tauri-apps/tauri |
| Apache-2.0 OR MIT | OK | `tauri-build` | 2.6.3 | https://github.com/tauri-apps/tauri |
| Apache-2.0 OR MIT | OK | `tauri-codegen` | 2.6.3 | https://github.com/tauri-apps/tauri |
| Apache-2.0 OR MIT | OK | `tauri-macros` | 2.6.3 | https://github.com/tauri-apps/tauri |
| Apache-2.0 OR MIT | OK | `tauri-plugin` | 2.6.3 | https://github.com/tauri-apps/tauri |
| Apache-2.0 OR MIT | OK | `tauri-plugin-dialog` | 2.7.1 | https://github.com/tauri-apps/plugins-workspace |
| Apache-2.0 OR MIT | OK | `tauri-plugin-fs` | 2.5.1 | https://github.com/tauri-apps/plugins-workspace |
| Apache-2.0 OR MIT | OK | `tauri-plugin-sql` | 2.4.0 | https://github.com/tauri-apps/plugins-workspace |
| Apache-2.0 OR MIT | OK | `tauri-runtime` | 2.11.3 | https://github.com/tauri-apps/tauri |
| Apache-2.0 OR MIT | OK | `tauri-runtime-wry` | 2.11.3 | https://github.com/tauri-apps/tauri |
| Apache-2.0 OR MIT | OK | `tauri-utils` | 2.9.3 | https://github.com/tauri-apps/tauri |
| MIT | OK | `tauri-winres` | 0.3.6 | https://github.com/tauri-apps/winres |
| MIT OR Apache-2.0 | OK | `tempfile` | 3.27.0 | https://github.com/Stebalien/tempfile |
| MIT OR Apache-2.0 | OK | `tendril` | 0.5.0 | https://github.com/servo/html5ever |
| MIT OR Apache-2.0 | OK | `thiserror` | 1.0.69 | https://github.com/dtolnay/thiserror |
| MIT OR Apache-2.0 | OK | `thiserror` | 2.0.18 | https://github.com/dtolnay/thiserror |
| MIT OR Apache-2.0 | OK | `thiserror-impl` | 1.0.69 | https://github.com/dtolnay/thiserror |
| MIT OR Apache-2.0 | OK | `thiserror-impl` | 2.0.18 | https://github.com/dtolnay/thiserror |
| MIT OR Apache-2.0 | OK | `time` | 0.3.49 | https://github.com/time-rs/time |
| MIT OR Apache-2.0 | OK | `time-core` | 0.1.9 | https://github.com/time-rs/time |
| MIT OR Apache-2.0 | OK | `time-macros` | 0.2.29 | https://github.com/time-rs/time |
| Unicode-3.0 | OK | `tinystr` | 0.8.3 | https://github.com/unicode-org/icu4x |
| Zlib OR Apache-2.0 OR MIT | OK | `tinyvec` | 1.11.0 | https://github.com/Lokathor/tinyvec |
| MIT OR Apache-2.0 OR Zlib | OK | `tinyvec_macros` | 0.1.1 | https://github.com/Soveu/tinyvec_macros |
| MIT | OK | `tokio` | 1.52.3 | https://github.com/tokio-rs/tokio |
| MIT | OK | `tokio-native-tls` | 0.3.1 | https://github.com/tokio-rs/tls |
| MIT | OK | `tokio-stream` | 0.1.18 | https://github.com/tokio-rs/tokio |
| MIT | OK | `tokio-util` | 0.7.18 | https://github.com/tokio-rs/tokio |
| MIT OR Apache-2.0 | OK | `toml` | 0.8.2 | https://github.com/toml-rs/toml |
| MIT OR Apache-2.0 | OK | `toml` | 0.9.12+spec-1.1.0 | https://github.com/toml-rs/toml |
| MIT OR Apache-2.0 | OK | `toml` | 1.1.2+spec-1.1.0 | https://github.com/toml-rs/toml |
| MIT OR Apache-2.0 | OK | `toml_datetime` | 0.6.3 | https://github.com/toml-rs/toml |
| MIT OR Apache-2.0 | OK | `toml_datetime` | 0.7.5+spec-1.1.0 | https://github.com/toml-rs/toml |
| MIT OR Apache-2.0 | OK | `toml_datetime` | 1.1.1+spec-1.1.0 | https://github.com/toml-rs/toml |
| MIT OR Apache-2.0 | OK | `toml_edit` | 0.19.15 | https://github.com/toml-rs/toml |
| MIT OR Apache-2.0 | OK | `toml_edit` | 0.20.2 | https://github.com/toml-rs/toml |
| MIT OR Apache-2.0 | OK | `toml_edit` | 0.25.12+spec-1.1.0 | https://github.com/toml-rs/toml |
| MIT OR Apache-2.0 | OK | `toml_parser` | 1.1.2+spec-1.1.0 | https://github.com/toml-rs/toml |
| MIT OR Apache-2.0 | OK | `toml_writer` | 1.1.1+spec-1.1.0 | https://github.com/toml-rs/toml |
| MIT | OK | `tower` | 0.5.3 | https://github.com/tower-rs/tower |
| MIT | OK | `tower-http` | 0.6.11 | https://github.com/tower-rs/tower-http |
| MIT | OK | `tower-layer` | 0.3.3 | https://github.com/tower-rs/tower |
| MIT | OK | `tower-service` | 0.3.3 | https://github.com/tower-rs/tower |
| MIT | OK | `tracing` | 0.1.44 | https://github.com/tokio-rs/tracing |
| MIT | OK | `tracing-attributes` | 0.1.31 | https://github.com/tokio-rs/tracing |
| MIT | OK | `tracing-core` | 0.1.36 | https://github.com/tokio-rs/tracing |
| MIT OR Apache-2.0 | OK | `tray-icon` | 0.24.1 | https://github.com/tauri-apps/tray-icon |
| MIT | OK | `try-lock` | 0.2.5 | https://github.com/seanmonstar/try-lock |
| MIT OR Apache-2.0 | OK | `typeid` | 1.0.3 | https://github.com/dtolnay/typeid |
| MIT OR Apache-2.0 | OK | `typenum` | 1.20.1 | https://github.com/paholg/typenum |
| MIT/Apache-2.0 | OK | `unic-char-property` | 0.9.0 | https://github.com/open-i18n/rust-unic/ |
| MIT/Apache-2.0 | OK | `unic-char-range` | 0.9.0 | https://github.com/open-i18n/rust-unic/ |
| MIT/Apache-2.0 | OK | `unic-common` | 0.9.0 | https://github.com/open-i18n/rust-unic/ |
| MIT/Apache-2.0 | OK | `unic-ucd-ident` | 0.9.0 | https://github.com/open-i18n/rust-unic/ |
| MIT/Apache-2.0 | OK | `unic-ucd-version` | 0.9.0 | https://github.com/open-i18n/rust-unic/ |
| MIT OR Apache-2.0 | OK | `unicode-bidi` | 0.3.18 | https://github.com/servo/unicode-bidi |
| (MIT OR Apache-2.0) AND Unicode-3.0 | OK | `unicode-ident` | 1.0.24 | https://github.com/dtolnay/unicode-ident |
| MIT OR Apache-2.0 | OK | `unicode-normalization` | 0.1.25 | https://github.com/unicode-rs/unicode-normalization |
| MIT/Apache-2.0 | OK | `unicode-properties` | 0.1.4 | https://github.com/unicode-rs/unicode-properties |
| MIT OR Apache-2.0 | OK | `unicode-segmentation` | 1.13.3 | https://github.com/unicode-rs/unicode-segmentation |
| MIT OR Apache-2.0 | OK | `url` | 2.5.8 | https://github.com/servo/rust-url |
| MIT | OK | `urlpattern` | 0.3.0 | https://github.com/denoland/rust-urlpattern |
| MIT OR Apache-2.0 | OK | `utf-8` | 0.7.6 | https://github.com/SimonSapin/rust-utf8 |
| Apache-2.0 OR MIT | OK | `utf8_iter` | 1.0.4 | https://github.com/hsivonen/utf8_iter |
| Apache-2.0 OR MIT | OK | `uuid` | 1.23.3 | https://github.com/uuid-rs/uuid |
| MIT/Apache-2.0 | OK | `vcpkg` | 0.2.15 | https://github.com/mcgoo/vcpkg-rs |
| MIT/Apache-2.0 | OK | `version_check` | 0.9.5 | https://github.com/SergioBenitez/version_check |
| MIT | OK | `version-compare` | 0.2.1 | https://gitlab.com/timvisee/version-compare |
| MIT | OK | `vswhom` | 0.1.0 | https://github.com/nabijaczleweli/vswhom.rs |
| MIT | OK | `vswhom-sys` | 0.1.3 | https://github.com/nabijaczleweli/vswhom-sys.rs |
| Unlicense/MIT | OK | `walkdir` | 2.5.0 | https://github.com/BurntSushi/walkdir |
| MIT | OK | `want` | 0.3.1 | https://github.com/seanmonstar/want |
| Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | OK | `wasi` | 0.11.1+wasi-snapshot-preview1 | https://github.com/bytecodealliance/wasi |
| Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | OK | `wasip2` | 1.0.4+wasi-0.2.12 | https://github.com/bytecodealliance/wasi-rs |
| Apache-2.0 OR BSL-1.0 OR MIT | OK | `wasite` | 0.1.0 | https://github.com/ardaku/wasite |
| MIT OR Apache-2.0 | OK | `wasm-bindgen` | 0.2.125 | https://github.com/wasm-bindgen/wasm-bindgen |
| MIT OR Apache-2.0 | OK | `wasm-bindgen-futures` | 0.4.75 | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/futures |
| MIT OR Apache-2.0 | OK | `wasm-bindgen-macro` | 0.2.125 | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/macro |
| MIT OR Apache-2.0 | OK | `wasm-bindgen-macro-support` | 0.2.125 | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/macro-support |
| MIT OR Apache-2.0 | OK | `wasm-bindgen-shared` | 0.2.125 | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/shared |
| MIT OR Apache-2.0 | OK | `wasm-streams` | 0.4.2 | https://github.com/MattiasBuelens/wasm-streams/ |
| MIT OR Apache-2.0 | OK | `wasm-streams` | 0.5.0 | https://github.com/MattiasBuelens/wasm-streams/ |
| MIT OR Apache-2.0 | OK | `web_atoms` | 0.2.5 | https://github.com/servo/html5ever |
| MIT OR Apache-2.0 | OK | `web-sys` | 0.3.102 | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/web-sys |
| MIT | OK | `webkit2gtk` | 2.0.2 | https://github.com/tauri-apps/webkit2gtk-rs |
| MIT | OK | `webkit2gtk-sys` | 2.0.2 | https://github.com/tauri-apps/webkit2gtk-rs |
| MIT | OK | `webview2-com` | 0.38.2 | https://github.com/wravery/webview2-rs |
| MIT | OK | `webview2-com-macros` | 0.8.1 | https://github.com/wravery/webview2-rs |
| MIT | OK | `webview2-com-sys` | 0.38.2 | https://github.com/wravery/webview2-rs |
| Apache-2.0 OR BSL-1.0 OR MIT | OK | `whoami` | 1.6.1 | https://github.com/ardaku/whoami |
| MIT/Apache-2.0 | OK | `winapi` | 0.3.9 | https://github.com/retep998/winapi-rs |
| MIT/Apache-2.0 | OK | `winapi-i686-pc-windows-gnu` | 0.4.0 | https://github.com/retep998/winapi-rs |
| Unlicense OR MIT | OK | `winapi-util` | 0.1.11 | https://github.com/BurntSushi/winapi-util |
| MIT/Apache-2.0 | OK | `winapi-x86_64-pc-windows-gnu` | 0.4.0 | https://github.com/retep998/winapi-rs |
| Apache-2.0 OR MIT | OK | `window-vibrancy` | 0.6.0 | https://github.com/tauri-apps/tauri-plugin-vibrancy |
| MIT OR Apache-2.0 | OK | `windows` | 0.61.3 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_aarch64_gnullvm` | 0.42.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_aarch64_gnullvm` | 0.48.5 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_aarch64_gnullvm` | 0.52.6 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_aarch64_gnullvm` | 0.53.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_aarch64_msvc` | 0.42.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_aarch64_msvc` | 0.48.5 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_aarch64_msvc` | 0.52.6 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_aarch64_msvc` | 0.53.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_i686_gnu` | 0.42.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_i686_gnu` | 0.48.5 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_i686_gnu` | 0.52.6 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_i686_gnu` | 0.53.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_i686_gnullvm` | 0.52.6 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_i686_gnullvm` | 0.53.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_i686_msvc` | 0.42.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_i686_msvc` | 0.48.5 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_i686_msvc` | 0.52.6 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_i686_msvc` | 0.53.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_gnu` | 0.42.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_gnu` | 0.48.5 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_gnu` | 0.52.6 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_gnu` | 0.53.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_gnullvm` | 0.42.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_gnullvm` | 0.48.5 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_gnullvm` | 0.52.6 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_gnullvm` | 0.53.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_msvc` | 0.42.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_msvc` | 0.48.5 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_msvc` | 0.52.6 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows_x86_64_msvc` | 0.53.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-collections` | 0.2.0 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-core` | 0.61.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-core` | 0.62.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-future` | 0.2.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-implement` | 0.60.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-interface` | 0.59.3 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-link` | 0.1.3 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-link` | 0.2.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-numerics` | 0.2.0 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-result` | 0.3.4 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-result` | 0.4.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-strings` | 0.4.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-strings` | 0.5.1 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-sys` | 0.45.0 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-sys` | 0.48.0 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-sys` | 0.59.0 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-sys` | 0.60.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-sys` | 0.61.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-targets` | 0.42.2 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-targets` | 0.48.5 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-targets` | 0.52.6 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-targets` | 0.53.5 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-threading` | 0.1.0 | https://github.com/microsoft/windows-rs |
| MIT OR Apache-2.0 | OK | `windows-version` | 0.1.7 | https://github.com/microsoft/windows-rs |
| MIT | OK | `winnow` | 0.5.40 | https://github.com/winnow-rs/winnow |
| MIT | OK | `winnow` | 0.7.15 | https://github.com/winnow-rs/winnow |
| MIT | OK | `winnow` | 1.0.3 | https://github.com/winnow-rs/winnow |
| MIT | OK | `winreg` | 0.55.0 | https://github.com/gentoo90/winreg-rs |
| Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | OK | `wit-bindgen` | 0.57.1 | https://github.com/bytecodealliance/wit-bindgen |
| Unicode-3.0 | OK | `writeable` | 0.6.3 | https://github.com/unicode-org/icu4x |
| Apache-2.0 OR MIT | OK | `wry` | 0.55.1 | https://github.com/tauri-apps/wry |
| MIT | OK | `wyz` | 0.5.1 | https://github.com/myrrlyn/wyz |
| MIT | OK | `x11` | 2.21.0 | https://github.com/AltF02/x11-rs |
| MIT | OK | `x11-dl` | 2.21.0 | https://github.com/AltF02/x11-rs |
| Unicode-3.0 | OK | `yoke` | 0.8.3 | https://github.com/unicode-org/icu4x |
| Unicode-3.0 | OK | `yoke-derive` | 0.8.2 | https://github.com/unicode-org/icu4x |
| BSD-2-Clause OR Apache-2.0 OR MIT | OK | `zerocopy` | 0.8.52 | https://github.com/google/zerocopy |
| BSD-2-Clause OR Apache-2.0 OR MIT | OK | `zerocopy-derive` | 0.8.52 | https://github.com/google/zerocopy |
| Unicode-3.0 | OK | `zerofrom` | 0.1.8 | https://github.com/unicode-org/icu4x |
| Unicode-3.0 | OK | `zerofrom-derive` | 0.1.7 | https://github.com/unicode-org/icu4x |
| Apache-2.0 OR MIT | OK | `zeroize` | 1.9.0 | https://github.com/RustCrypto/utils |
| Unicode-3.0 | OK | `zerotrie` | 0.2.4 | https://github.com/unicode-org/icu4x |
| Unicode-3.0 | OK | `zerovec` | 0.11.6 | https://github.com/unicode-org/icu4x |
| Unicode-3.0 | OK | `zerovec-derive` | 0.11.3 | https://github.com/unicode-org/icu4x |
| MIT | OK | `zmij` | 1.0.21 | https://github.com/dtolnay/zmij |
