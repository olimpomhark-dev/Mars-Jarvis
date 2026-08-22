/**
 * MARS JARVIS — Brain client
 * ----------------------------
 * Talks to the Cloudflare Worker proxy (see worker/worker.js), never to
 * Anthropic directly — the API key never touches the browser. Used as a
 * fallback whenever the fast local command parser (commands.js) doesn't
 * recognize a fixed phrasing.
 *
 * Free AI models occasionally hiccup on a single request, so this retries
 * once automatically before giving up — the person shouldn't have to
 * manually repeat themselves for a transient failure.
 */

import { CONFIG } from "./config.js";

export function isBrainConfigured() {
  return !!CONFIG.BRAIN_ENDPOINT && !CONFIG.BRAIN_ENDPOINT.startsWith("PASTE_");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptOnce(message, context) {
  const res = await fetch(CONFIG.BRAIN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });
  if (!res.ok) throw new Error(`Brain endpoint returned ${res.status}`);
  const parsed = await res.json();
  if (!parsed || !parsed.action) throw new Error("Malformed brain response");
  return parsed;
}

/**
 * Ask the brain what to do with an utterance the local parser didn't match.
 * `context` is a small, cheap summary of current memory — not the whole
 * dataset — to keep requests fast and inexpensive.
 */
export async function askBrain(message, memoryData) {
  if (!isBrainConfigured()) {
    return { action: "chat", reply: "My reasoning module isn't connected yet. Check Settings." };
  }

  const context = {
    openTasks: memoryData.tasks.filter((t) => !t.completed).slice(0, 8).map((t) => t.text),
    recentNotes: memoryData.notes.slice(0, 8).map((n) => n.text),
  };

  const MAX_ATTEMPTS = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptOnce(message, context);
    } catch (e) {
      lastError = e;
      console.error(`Brain error (attempt ${attempt}):`, e);
      if (attempt < MAX_ATTEMPTS) await sleep(500);
    }
  }

  console.error("Brain error, giving up after retries:", lastError);
  return { action: "chat", reply: "I couldn't reach my reasoning module just now." };
}
