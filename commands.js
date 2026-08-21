/**
 * MARS JARVIS — Command interpreter
 * -----------------------------------
 * Takes the text spoken *after* the wake word (or a push-to-talk utterance)
 * and turns it into a memory action + a spoken/log response.
 *
 * Supported phrasings (case-insensitive, wake word already stripped):
 *   Notes:
 *     "save a note <text>" / "save note <text>" / "note that <text>" / "take a note <text>"
 *     "show my notes" / "show notes" / "read my notes"
 *     "search notes for <term>" / "find notes about <term>"
 *     "delete note <term>" / "remove note <term>"
 *
 *   Tasks:
 *     "add task <text>" / "add a task to <text>" / "new task <text>"
 *        (optionally ending in "priority high/medium/low")
 *     "complete task <term>" / "finish task <term>" / "mark <term> as done"
 *     "delete task <term>" / "remove task <term>"
 *     "set priority of <term> to high/medium/low" / "make <term> high priority"
 *     "show tasks" / "what are my tasks" / "list tasks"
 */

import { memory } from "./memory.js";

function respond(text, meta = {}) {
  return { text, ...meta };
}

const PRIORITY_WORDS = ["low", "medium", "high"];

function stripTrailingPriority(text) {
  const m = text.match(/^(.*?)\s*(?:with |at )?priority\s+(low|medium|high)\s*$/i);
  if (m) return { text: m[1].trim(), priority: m[2].toLowerCase() };
  const m2 = text.match(/^(.*?)\s*[-–]\s*(low|medium|high)\s+priority\s*$/i);
  if (m2) return { text: m2[1].trim(), priority: m2[2].toLowerCase() };
  return { text: text.trim(), priority: null };
}

export function interpretCommand(raw) {
  const text = raw.trim().replace(/[.!?]+$/, "");
  const lower = text.toLowerCase();

  // ---------- Notes ----------
  let m;
  if ((m = lower.match(/^(?:save (?:a |my )?note|note that|take a note|add (?:a )?note)\s*[:,]?\s*(.+)/))) {
    const body = text.slice(m[0].indexOf(m[1]));
    if (!body.trim()) return respond("What should the note say?");
    const note = memory.createNote(body);
    return respond("I have saved your note.", { action: "note_created", note });
  }

  if (/^(show|read|list)\s+(my\s+)?notes$/.test(lower)) {
    const notes = memory.data.notes.slice(0, 5);
    if (notes.length === 0) return respond("You have no notes yet.");
    const list = notes.map((n) => n.text).join(". ");
    return respond(`You have ${memory.data.notes.length} notes. Most recent: ${list}`, { action: "notes_listed" });
  }

  if ((m = lower.match(/^(?:search notes for|find notes about|search notes)\s+(.+)/))) {
    const term = text.slice(text.toLowerCase().indexOf(m[1]));
    const results = memory.searchNotes(term);
    if (results.length === 0) return respond(`No notes matched "${term}".`, { action: "notes_searched" });
    return respond(`Found ${results.length} matching note${results.length > 1 ? "s" : ""}: ${results.slice(0, 3).map((n) => n.text).join(". ")}`, {
      action: "notes_searched",
      results,
    });
  }

  if ((m = lower.match(/^(?:delete|remove)\s+note\s+(.+)/))) {
    const term = text.slice(text.toLowerCase().indexOf(m[1]));
    const note = memory.findNoteByText(term);
    if (!note) return respond(`I couldn't find a note matching "${term}".`);
    memory.deleteNote(note.id);
    return respond("Note deleted.", { action: "note_deleted", note });
  }

  // ---------- Tasks ----------
  if ((m = lower.match(/^(?:add (?:a )?task(?: to)?|new task(?: to)?)\s+(.+)/))) {
    let body = text.slice(text.toLowerCase().indexOf(m[1]));
    const { text: cleanText, priority } = stripTrailingPriority(body);
    if (!cleanText) return respond("What is the task?");
    const task = memory.addTask(cleanText, priority || "medium");
    return respond(`Task added${priority ? `, ${priority} priority` : ""}.`, { action: "task_added", task });
  }

  if ((m = lower.match(/^(?:complete|finish)\s+task\s+(.+)/)) || (m = lower.match(/^mark\s+(.+?)\s+as\s+(?:done|complete|finished)/))) {
    const term = text.slice(text.toLowerCase().indexOf(m[1]));
    const task = memory.findTaskByText(term);
    if (!task) return respond(`I couldn't find a task matching "${term}".`);
    memory.completeTask(task.id);
    return respond(`Marked "${task.text}" as complete.`, { action: "task_completed", task });
  }

  if ((m = lower.match(/^(?:delete|remove)\s+task\s+(.+)/))) {
    const term = text.slice(text.toLowerCase().indexOf(m[1]));
    const task = memory.findTaskByText(term);
    if (!task) return respond(`I couldn't find a task matching "${term}".`);
    memory.deleteTask(task.id);
    return respond("Task deleted.", { action: "task_deleted", task });
  }

  if (
    (m = lower.match(/^set priority of\s+(.+?)\s+to\s+(low|medium|high)$/)) ||
    (m = lower.match(/^make\s+(.+?)\s+(low|medium|high)\s+priority$/))
  ) {
    const term = text.slice(text.toLowerCase().indexOf(m[1]), text.toLowerCase().indexOf(m[1]) + m[1].length);
    const priority = m[2].toLowerCase();
    const task = memory.findTaskByText(term);
    if (!task) return respond(`I couldn't find a task matching "${term}".`);
    memory.setPriority(task.id, priority);
    return respond(`Set "${task.text}" to ${priority} priority.`, { action: "task_priority_set", task });
  }

  if (/^(show|list|what are my|what's on my)\s+tasks?$/.test(lower)) {
    const open = memory.data.tasks.filter((t) => !t.completed);
    if (open.length === 0) return respond("You have no open tasks.");
    const list = open.slice(0, 5).map((t) => t.text).join(". ");
    return respond(`You have ${open.length} open task${open.length > 1 ? "s" : ""}: ${list}`, { action: "tasks_listed" });
  }

  // ---------- Fallback ----------
  return respond("I didn't catch a command in that. Try saving a note or adding a task.", { action: "unknown" });
}
