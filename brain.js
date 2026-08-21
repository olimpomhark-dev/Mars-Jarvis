/**
 * MARS JARVIS - Brain client
 * ----------------------------
 * Talks to the Cloudflare Worker proxy, never to any AI service directly -
 * no keys ever touch the browser. Used as a fallback whenever the fast
 * local command parser (commands.js) does not recognize a fixed phrasing.
 */

import { CONFIG } from "./config.js";

export function isBrainConfigured() {
  return !!CONFIG.BRAIN_ENDPOINT && !CONFIG.BRAIN_ENDPOINT.startsWith("PASTE_");
}

export async function askBrain(message, memoryData) {
  if (!isBrainConfigured()) {
    return { action: "chat", reply: "My reasoning module is not connected yet. Check Settings." };
  }

  var context = {
    openTasks: memoryData.tasks.filter(function (t) { return !t.completed; }).slice(0, 8).map(function (t) { return t.text; }),
    recentNotes: memoryData.notes.slice(0, 8).map(function (n) { return n.text; }),
  };

  try {
    var res = await fetch(CONFIG.BRAIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message, context: context }),
    });
    if (!res.ok) throw new Error("Brain endpoint returned " + res.status);
    var parsed = await res.json();
    if (!parsed || !parsed.action) throw new Error("Malformed brain response");
    return parsed;
  } catch (e) {
    console.error("Brain error:", e);
    return { action: "chat", reply: "I could not reach my reasoning module just now." };
  }
}
