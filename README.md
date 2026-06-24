# Dragon Heart 🐉

*A warm, private space for being **with** an AI character who remembers you — not querying a chatbot.*

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6.svg)](#what-youll-need)
[![Runs locally](https://img.shields.io/badge/Runs-100%25%20on%20your%20PC-7B4D91.svg)](#your-conversations-never-leave-your-pc)

Dragon Heart is a Windows desktop app for having an ongoing, personal relationship with an AI character — one who has a stable personality, remembers your past conversations, and greets you when you come back. Everything runs **entirely on your own computer**. No accounts, no subscription, no internet required after setup, and nothing you say is ever sent to a company's servers.

If you've only ever used something like ChatGPT, think of Dragon Heart as the opposite idea. ChatGPT is a tool you operate to get answers. Dragon Heart is a *someone* you talk to — a character with an inner life who exists between sessions and responds out of who they are.

---

## Why you might like this

- **They remember you.** Dragon Heart keeps a long-term memory of your conversations, so the relationship grows over time instead of resetting every time you close the app.
- **They have a real personality.** Each character is defined by a **Soul Document** — their drives, values, moods, and contradictions — not a one-line "you are a helpful assistant" instruction. They feel like a person, not a search box.
- **It's a place, not a prompt box.** You open the app into a *conversation*, not a blank text field. Replies stream in, the character "gathers their thoughts," and the interface gets out of the way. There's a cozy candlelit dark theme and a brighter "Luminous Realm" light theme.
- **It's completely private and free.** The AI lives on your PC. After the one-time download, you can unplug the internet and keep talking forever. Never worry about a company shutting down a service, or changing your character's personality with an update.
- **You're in control.** A **Studio** menu lets you peek inside and edit anything — the character's personality, their memories of you, the world they live in — whenever you want.

---

## Your conversations never leave your PC

This is the whole point, so it's worth being clear: Dragon Heart runs the AI model **locally** using a free tool called [Ollama](https://ollama.com). When you send a message, your PC's own processor and graphics card generate the reply. Nothing is uploaded, logged, or shared. Your conversations are yours alone.

---

## What you'll need

Dragon Heart runs the AI on your own hardware, so a reasonably capable machine makes a big difference — a gaming PC is ideal.

| | Recommended |
|---|---|
| **Operating system** | Windows 10 or 11 (64-bit) |
| **Graphics card (GPU)** | A dedicated NVIDIA or AMD GPU with **8 GB+ of video memory (VRAM)**. 16 GB of VRAM is recommended, more is better. |
| **Memory (RAM)** | **16 GB** minimum; 32 GB+ recommended if you want to run the larger, smarter models. |
| **Disk space** | ~10–20 GB free for the AI model files. |

The app was developed and tested using a NVIDIA RTX 5080 GPU and 64 GB of system RAM.

You should still be able to run Dragon Heart on a machine without a strong graphics card — it will just think more slowly. If replies feel sluggish, the [model guide below](#step-2-download-an-ai-brain) shows how to pick a lighter, faster model.

---

## Getting started

There are three short steps: **install Ollama**, **download an AI model**, then **run Dragon Heart**. The first two are point-and-click. You only need the terminal briefly to download a model — every command is copy-paste, and we explain what each one does.

### Step 1: Install Ollama (the engine that runs the AI)

[Ollama](https://ollama.com) is a free, open-source app that runs AI models on your PC. Dragon Heart uses it under the hood.

1. Go to **[ollama.com/download/windows](https://ollama.com/download/windows)** and download the installer.
2. Run `OllamaSetup.exe` and click through the short wizard (no administrator password needed).
3. That's it. Ollama starts automatically and tucks itself into your system tray (the little icons near the clock). You'll see a small llama icon — that means it's running in the background, ready for Dragon Heart to talk to.

You don't need to open or configure Ollama yourself. Just leave it running.

### Step 2: Download an AI brain (the model)

The "personality" of your character is brought to life by an AI model called **Gemma 4** — Google's free, open model (released April 2026), which Dragon Heart is built around. You download it once through Ollama.

Open the **Start menu**, type `cmd`, and press **Enter** to open a black terminal window. Then copy-paste the commands below and press Enter after each one. The first download is a few gigabytes, so it may take a while on a slower connection.

**Pick the model that matches your PC:**

| Your PC | Run this command | Notes |
|---|---|---|
| Typical gaming PCs (8–12 GB VRAM) | `ollama pull gemma4:e4b` | Fast, lightweight, and warm enough for great conversation. |
| Powerful PC (16 GB+ VRAM) | `ollama pull gemma4:26b` | A richer, most nuanced character voice. This is Dragon Heart's built-in default. |
| High-end PC (32 GB VRAM) | `ollama pull gemma4:31b` | The most creative model for deep meaningful conversations. |
| Modest / older PC | `ollama pull gemma4:e2b` | The smallest, fastest option for when everything else feels slow. |

**Then add the memory helper** (a tiny model that powers Dragon Heart's long-term memory of you):

```
ollama pull nomic-embed-text
```

> 💡 **Tip:** If you're not sure, start with `gemma4:e4b` plus `nomic-embed-text`. You can always download a bigger model later and switch to it inside the app.

### Step 3: Run Dragon Heart

> 📦 **Looking for a one-click installer?** Check this project's **Releases** page on GitHub for a prebuilt installer if one is available — if so, just download and run it, and you can skip the rest of this step.

If there's no installer yet, you can build Dragon Heart yourself. It sounds technical, but it's mostly installing two free tools and running a couple of commands. One-time setup:

1. **Install Node.js** — download the "LTS" version from **[nodejs.org](https://nodejs.org)** and run the installer (accept the defaults).
2. **Install Rust** — download from **[rustup.rs](https://rustup.rs)** and run the installer. If it mentions needing "Microsoft C++ Build Tools" or "WebView2," follow its prompt to install them too.
3. **Get the code** — on this project's GitHub page, click the green **Code** button → **Download ZIP**, then unzip it somewhere like your Documents folder. (If you know Git, `git clone` works too.)
4. **Launch it** — open a terminal *in that unzipped folder* (in File Explorer, type `cmd` in the address bar and press Enter), then run:

   ```
   npm install
   npm run tauri dev
   ```

The first launch takes a few minutes to build. After that, Dragon Heart opens in its own window and you're ready to talk. 🎉

---

## Your first conversation

When Dragon Heart opens, you'll meet a small circle of starter characters. Pick one and start typing — they'll respond in their own voice, and they'll remember what you tell them next time.

A few things worth knowing:

- **Memory builds quietly.** As you talk, Dragon Heart notices things worth remembering and saves them. You stay in charge: you can review or edit every memory in the **Studio**.
- **The Studio is your backstage pass.** Open it to inspect or rewrite a character's Soul Document, browse their memories of you, build out the world they know about (the **Lorebook**), set up your own **persona** (who *you* are to them), and switch which AI model they use.
- **You can change models anytime.** In the Studio's **Voice** settings, pick the model you downloaded. If replies feel slow, switch to a lighter one like `gemma4:e4b`; if you want more depth and have the hardware, try `gemma4:26b`.
- **Import characters.** Dragon Heart reads the popular community **character card** format (PNG/JSON), so you can bring in characters from elsewhere — or export your own to share.

---

## Troubleshooting

**The character won't respond / I get a connection error.**
Make sure Ollama is running — look for the llama icon in your system tray near the clock. If it's not there, open it from the Start menu. Dragon Heart talks to Ollama at `http://localhost:11434`; if you've changed that, update it in the Studio settings.

**Replies are very slow.**
You're likely running a model that's too large for your hardware. Download a lighter one (`ollama pull gemma4:e4b` or `gemma4:e2b`) and select it in the Studio's Voice settings.

**"Model not found" or the character mentions a missing model.**
The app expects the model named in its settings to be downloaded. Run the matching `ollama pull …` command from [Step 2](#step-2-download-an-ai-brain), or change the selected model in the Studio to one you do have.

**Memory isn't working.**
Long-term recall needs the `nomic-embed-text` helper model. Run `ollama pull nomic-embed-text`, then make sure semantic recall is enabled in the Studio settings.

---

## For developers

Dragon Heart is built with Tauri v2, React 18, and TypeScript, with a pure, UI-free engine at its core. If you'd like to contribute or understand the internals:

```bash
npm install
npm run tauri dev    # launch the desktop app
npm test             # engine unit tests
npm run build        # typecheck + bundle the frontend
npm run tauri build  # produce a distributable desktop installer
```

The architecture, conventions, and design intent are documented in **[AGENTS.md](AGENTS.md)** and the **[Dragon Heart Concept Plan](Dragon_Heart_Concept_Plan.md)**. In short: all logic lives in a dependency-injected engine (`src/engine/`) that never imports UI or Tauri; the desktop shell, adapters, and React screens are thin layers around it.

---

## About the project

Project Dragon Heart began with developer [Josh Abbott](https://joshabbott.com) experimenting with the latest local language models. The release of Gemma 4 showed a substantial capability for conversational skills when roleplaying various characters, both in the depth and creativity of their personalities, as well as faster response times and performance compared to previous generations of similar model sizes.

The initial step was generating a [plan file](./Dragon_Heart_Concept_Plan.md) from deep research into the latest trends in local AI models. We want to acknowledge two community-driven projects that helped inspire this research and planning phase: [Open WebUI](https://github.com/open-webui/open-webui) demonstrated a more traditional AI chat interface that can run locally with Ollama integration, and [SillyTavern](https://github.com/SillyTavern/SillyTavern) showcased a character management and lorebook system.

The plan file was then fed into Claude Design to build the Dragon Heart Design System. From there, the initial working prototype was built in a single Claude Code ultracode session using the Claude Opus 4.8 model.

---

## License

Dragon Heart is open source under the [MIT License](LICENSE) — free to use, modify, and share.

It builds on excellent open tools: [Ollama](https://ollama.com) (MIT) for local inference and Google's [Gemma 4](https://ollama.com/library/gemma4) (Apache 2.0) as the default character model. See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for the full list.

---

*Powered by Ollama + Gemma 4. Built on the "candlelit hearthside" design system — because talking to someone should feel like sitting by a fire, not operating a machine.*
