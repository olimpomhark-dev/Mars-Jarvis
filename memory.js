/**
 * MARS JARVIS — Memory model
 * ---------------------------
 * Single source of truth for app data. Pure in-memory object + CRUD
 * helpers. Persistence to Drive is handled by drive.js; this module
 * just mutates state and notifies listeners so the UI (and Drive
 * autosave) can react.
 */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function defaultData() {
  return {
    notes: [],
    tasks: [],
    research: [],
    settings: {
      wakeWord: "jarvis",
      voiceName: null,
      voiceRate: 1,
      voicePitch: 1,
      continuousListening: true,
    },
    conversations: [],
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  };
}

class MemoryStore {
  constructor() {
    this.data = defaultData();
    this.listeners = new Set();
  }

  /** Replace the whole store, e.g. after loading from Drive. */
  hydrate(data) {
    this.data = Object.assign(defaultData(), data);
    // guard against older/partial files missing a key
    this.data.notes ??= [];
    this.data.tasks ??= [];
    this.data.research ??= [];
    this.data.conversations ??= [];
    this.data.settings = Object.assign(defaultData().settings, data.settings || {});
    this._touch(false);
    this._emit();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of this.listeners) fn(this.data);
  }

  _touch(emit = true) {
    this.data.meta.updatedAt = new Date().toISOString();
    if (emit) this._emit();
  }

  // ---------- Notes ----------
  createNote(text) {
    const note = { id: uid(), text: text.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.data.notes.unshift(note);
    this._touch();
    return note;
  }

  editNote(id, newText) {
    const note = this.data.notes.find((n) => n.id === id);
    if (!note) return null;
    note.text = newText.trim();
    note.updatedAt = new Date().toISOString();
    this._touch();
    return note;
  }

  deleteNote(id) {
    const before = this.data.notes.length;
    this.data.notes = this.data.notes.filter((n) => n.id !== id);
    this._touch();
    return this.data.notes.length < before;
  }

  /** Find the most recent note whose text loosely contains `term`. */
  findNoteByText(term) {
    const t = term.trim().toLowerCase();
    if (!t) return null;
    return this.data.notes.find((n) => n.text.toLowerCase().includes(t)) || null;
  }

  searchNotes(term) {
    const t = term.trim().toLowerCase();
    if (!t) return this.data.notes;
    return this.data.notes.filter((n) => n.text.toLowerCase().includes(t));
  }

  // ---------- Tasks ----------
  addTask(text, priority = "medium") {
    const task = {
      id: uid(),
      text: text.trim(),
      priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    this.data.tasks.unshift(task);
    this._touch();
    return task;
  }

  completeTask(id) {
    const task = this.data.tasks.find((t) => t.id === id);
    if (!task) return null;
    task.completed = true;
    task.completedAt = new Date().toISOString();
    this._touch();
    return task;
  }

  deleteTask(id) {
    const before = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter((t) => t.id !== id);
    this._touch();
    return this.data.tasks.length < before;
  }

  setPriority(id, priority) {
    const task = this.data.tasks.find((t) => t.id === id);
    if (!task || !["low", "medium", "high"].includes(priority)) return null;
    task.priority = priority;
    this._touch();
    return task;
  }

  findTaskByText(term) {
    const t = term.trim().toLowerCase();
    if (!t) return null;
    return (
      this.data.tasks.find((tk) => !tk.completed && tk.text.toLowerCase().includes(t)) ||
      this.data.tasks.find((tk) => tk.text.toLowerCase().includes(t)) ||
      null
    );
  }

  // ---------- Conversations ----------
  logConversation(input, response) {
    this.data.conversations.unshift({
      id: uid(),
      timestamp: new Date().toISOString(),
      input,
      response,
    });
    // keep the log from growing forever
    if (this.data.conversations.length > 200) this.data.conversations.length = 200;
    this._touch();
  }

  // ---------- Settings ----------
  updateSettings(patch) {
    Object.assign(this.data.settings, patch);
    this._touch();
  }
}

export const memory = new MemoryStore();
