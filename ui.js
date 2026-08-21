/**
 * MARS JARVIS — UI rendering
 * ---------------------------
 * Small, dependency-free DOM rendering helpers. No framework: every
 * render* function just rebuilds the innerHTML of its target from the
 * current memory state. Good enough at this data scale (personal notes
 * and tasks), and keeps the "no framework" constraint honest.
 */

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function renderNotes(notes, mountEl, { onDelete } = {}) {
  if (notes.length === 0) {
    mountEl.innerHTML = `<div class="empty-state">No notes yet. Say <em>"Jarvis, save a note..."</em> or add one below.</div>`;
    return;
  }
  mountEl.innerHTML = notes
    .map(
      (n) => `
      <div class="record-card" data-id="${n.id}">
        <div class="record-card__bracket bracket-tl"></div>
        <div class="record-card__body">${esc(n.text)}</div>
        <div class="record-card__meta">
          <span>${timeAgo(n.updatedAt)}</span>
          <button class="icon-btn danger" data-action="delete-note" data-id="${n.id}" title="Delete note">✕</button>
        </div>
      </div>`
    )
    .join("");
}

const PRIORITY_LABEL = { high: "HIGH", medium: "MED", low: "LOW" };

export function renderTasks(tasks, mountEl) {
  if (tasks.length === 0) {
    mountEl.innerHTML = `<div class="empty-state">No tasks yet. Say <em>"Jarvis, add a task..."</em> or add one below.</div>`;
    return;
  }
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
  mountEl.innerHTML = sorted
    .map(
      (t) => `
      <div class="task-row ${t.completed ? "is-complete" : ""}" data-id="${t.id}">
        <button class="task-check" data-action="complete-task" data-id="${t.id}" ${t.completed ? "disabled" : ""}>
          ${t.completed ? "✓" : ""}
        </button>
        <span class="task-text">${esc(t.text)}</span>
        <span class="priority-chip priority-${t.priority}">${PRIORITY_LABEL[t.priority]}</span>
        <button class="icon-btn danger" data-action="delete-task" data-id="${t.id}" title="Delete task">✕</button>
      </div>`
    )
    .join("");
}

export function renderConversations(conversations, mountEl) {
  if (conversations.length === 0) {
    mountEl.innerHTML = `<div class="empty-state">No commands logged yet.</div>`;
    return;
  }
  mountEl.innerHTML = conversations
    .slice(0, 30)
    .map(
      (c) => `
      <div class="conv-row">
        <div class="conv-row__time">${new Date(c.timestamp).toLocaleTimeString()}</div>
        <div class="conv-row__you"><span class="tag">YOU</span> ${esc(c.input)}</div>
        <div class="conv-row__jarvis"><span class="tag tag-gold">JARVIS</span> ${esc(c.response)}</div>
      </div>`
    )
    .join("");
}

export function renderStats(data, mountEl) {
  const openTasks = data.tasks.filter((t) => !t.completed).length;
  mountEl.querySelector("[data-stat=notes]").textContent = data.notes.length;
  mountEl.querySelector("[data-stat=tasks]").textContent = openTasks;
  mountEl.querySelector("[data-stat=conversations]").textContent = data.conversations.length;
}

export function renderActivityFeed(data, mountEl) {
  const events = [
    ...data.notes.slice(0, 3).map((n) => ({ t: n.createdAt, text: `Note saved: ${n.text}` })),
    ...data.tasks.slice(0, 3).map((t) => ({ t: t.createdAt, text: `Task added: ${t.text}` })),
    ...data.conversations.slice(0, 3).map((c) => ({ t: c.timestamp, text: `Command: ${c.input}` })),
  ]
    .sort((a, b) => new Date(b.t) - new Date(a.t))
    .slice(0, 6);

  if (events.length === 0) {
    mountEl.innerHTML = `<div class="empty-state">No activity yet. Everything you do will show up here.</div>`;
    return;
  }
  mountEl.innerHTML = events
    .map((e) => `<div class="feed-row"><span class="feed-dot"></span>${esc(e.text)}<span class="feed-time">${timeAgo(e.t)}</span></div>`)
    .join("");
}

export function setConnectionBadge(el, status) {
  el.dataset.status = status; // 'offline' | 'connecting' | 'online' | 'error'
  const labels = {
    offline: "DRIVE OFFLINE",
    connecting: "CONNECTING…",
    online: "DRIVE SYNCED",
    error: "SYNC ERROR",
  };
  el.textContent = labels[status] || status;
}
