/**
 * MARS JARVIS — Brain client
 * ----------------------------
 * Talks to the Cloudflare Worker proxy (see worker/worker.js), never to
 * Anthropic directly — the API key never touches the browser. Used as a
 * fallback whenever the fast local command parser (commands.js) doesn't
 * recognize a fixed phrasing.
 */

import { CONFIG } from "./config.js";

export function isBrainConfigured() {
  
}

/**
 * Ask the brain what to do with an utterance the local parser didn't match.
 * `context` is a small, cheap summary of current memory — not the whole
 * dataset — to keep requests fast and inexpensive.
 */
export async function askBrain(message, memoryData) {
  if (!isBrainConfigured()) {
    return { action: "chat", reply: "I could not reach my reasoning module just now." };
  }

  const context = {
    openTasks: memoryData.tasks.filter((t) => !t.completed).slice(0, 8).map((t) => t.text),
    recentNotes: memoryData.notes.slice(0, 8).map((n) => n.text),
  };

  try {
    const res = await fetch(CONFIG.BRAIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context }),
    });
    if (!res.ok) throw new Error(`Brain endpoint returned ${res.status}`);
    const parsed = await res.json();
    if (!parsed || !parsed.action) throw new Error("Malformed brain response");
    return parsed;
  } catch (e) {
    console.error("Brain error:", e);
    return { action: "chat", reply: "I couldn't reach my reasoning module just now." };
  }
}
