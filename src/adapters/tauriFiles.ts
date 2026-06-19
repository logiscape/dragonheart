/* File picking + raw read/write for character-card import/export and shared
   images. Paths come from a user dialog selection, then bytes move through the
   Rust file commands. */
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface DialogFilter {
  name: string;
  extensions: string[];
}

export async function pickOpenPath(filters: DialogFilter[]): Promise<string | null> {
  const res = await open({ multiple: false, directory: false, filters });
  return typeof res === "string" ? res : null;
}

export async function pickSavePath(defaultName: string, filters: DialogFilter[]): Promise<string | null> {
  const res = await save({ defaultPath: defaultName, filters });
  return typeof res === "string" ? res : null;
}

export async function readBytes(path: string): Promise<Uint8Array> {
  const arr = await invoke<number[]>("read_file_bytes", { path });
  return new Uint8Array(arr);
}

export async function readBase64(path: string): Promise<string> {
  return invoke<string>("read_file_base64", { path });
}

export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  await invoke("write_file_bytes", { path, contents: Array.from(bytes) });
}

/** Guess an image mime from a file path extension. */
export function mimeFromPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    default: return "application/octet-stream";
  }
}
