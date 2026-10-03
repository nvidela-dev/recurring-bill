import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseSettings, parseState, type AppState } from "./domain";
const key = "recurring-bill-state-v2";
export async function loadState(): Promise<AppState> {
  const raw = isTauri()
    ? await invoke<string | null>("load_state")
    : localStorage.getItem(key);
  return parseState(raw);
}
export async function saveState(state: AppState): Promise<void> {
  parseSettings(state.settings);
  const json = JSON.stringify(state, null, 2);
  if (isTauri()) await invoke("save_state", { json });
  else localStorage.setItem(key, json);
}
export async function savePDF(
  bytes: Uint8Array,
  filename: string,
): Promise<boolean> {
  if (isTauri())
    return invoke<boolean>("save_pdf", { bytes: Array.from(bytes), filename });
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
