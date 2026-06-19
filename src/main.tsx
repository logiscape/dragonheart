import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/styles.css";
import "./styles/app.css";
import { TauriDb } from "@adapters/tauriDb";
import { TauriOllama } from "@adapters/tauriOllama";
import { Engine, DEFAULT_SETTINGS } from "@engine/index";
import { AppStore, StoreContext } from "@state/store";
import { App } from "./App";

async function bootstrap(): Promise<void> {
  const db = await TauriDb.load();
  const transport = new TauriOllama(DEFAULT_SETTINGS.ollamaBaseUrl);
  const engine = await Engine.create(db, transport);
  transport.setBaseUrl(engine.getSettings().ollamaBaseUrl);

  const store = new AppStore(engine, transport);
  await store.init();

  const root = document.getElementById("root");
  if (!root) throw new Error("Root element missing");
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <StoreContext.Provider value={store}>
        <App />
      </StoreContext.Provider>
    </React.StrictMode>,
  );
}

bootstrap().catch((err) => {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<pre style="padding:2.5rem;color:#df8b75;font-family:monospace;white-space:pre-wrap;line-height:1.6">The hearth wouldn't light.\n\n${String(
      err,
    )}\n\nIs Ollama running? The app still opens — open the Studio to check the connection.</pre>`;
  }
  // eslint-disable-next-line no-console
  console.error(err);
});
