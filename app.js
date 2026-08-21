/**
 * MARS JARVIS — App orchestrator
 * --------------------------------
 * Boots the dashboard: wires auth -> Drive sync -> memory -> voice ->
 * command interpreter -> UI. Nothing here talks to Drive or the mic
 * directly beyond calling into the other modules.
 */

import { CONFIG } from "./config.js";
import * as Auth from "./auth.js";
import * as Drive from "./drive.js";
import { memory, defaultData } from "./memory.js";
import { voiceEngine, VoiceState } from "./voice.js";
import { interpretCommand } from "./commands.js";
import * as UI from "./ui.js";

// ---------- DOM refs ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const loginScreen = $("#login-screen");
const appShell = $("#app-shell");
const googleBtnMount = $("#google-signin-btn");
const configWarning = $("#config-warning");

const connBadge = $("#connection-badge");
const userChip = $("#user-chip");
const userName = $("#user-name");
const userAvatar = $("#user-avatar");
const clockEl = $("#hud-clock");
const dateEl = $("#hud-date");

const micOrbs = $$(".mic-orb");
const micStateLabels = [$("#mic-state-label"), $("#mic-state-label-2")];
const muteButtons = [$("#btn-mute"), $("#btn-mute-2")];
const pttButtons = [$("#btn-ptt"), $("#btn-ptt-2")];
const liveTranscripts = [$("#live-transcript"), $("#live-transcript-2")];

const notesMount = $("#notes-list");
const tasksMount = $("#tasks-list");
const convMount = $("#conversation-log");
const activityMount = $("#activity-feed");
const statsMount = $("#dashboard-stats");

const noteForm = $("#note-form");
const noteInput = $("#note-input");
const noteSearch = $("#note-search");

const taskForm = $("#task-form");
const taskInput = $("#task-input");
const taskPriority = $("#task-priority");

const settingsWakeWord = $("#settings-wakeword");
const settingsVoiceSelect = $("#settings-voice");
const settingsRate = $("#settings-rate");
const settingsPitch = $("#settings-pitch");
const settingsContinuous = $("#settings-continuous");
const btnSignOut = $("#btn-signout");
const btnExport = $("#btn-export");
const btnClear = $("#btn-clear");
const settingsAccountName = $("#settings-account-name");
const settingsAccountEmail = $("#settings-account-email");

let saveTimer = null;
let driveReady = false;

// ---------- Section navigation ----------
$$(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".nav-item").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    const target = btn.dataset.section;
    $$(".section").forEach((s) => s.classList.toggle("is-active", s.id === `section-${target}`));
  });
});

// ---------- Clock ----------
function tickClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString([], { hour12: false });
  dateEl.textContent = now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
setInterval(tickClock, 1000);
tickClock();

// ---------- Rendering ----------
function renderAll() {
  const data = memory.data;
  UI.renderNotes(data.notes, notesMount);
  UI.renderTasks(data.tasks, tasksMount);
  UI.renderConversations(data.conversations, convMount);
  UI.renderActivityFeed(data, activityMount);
  UI.renderStats(data, statsMount);
}

memory.onChange(() => {
  renderAll();
  queueSave();
});

// ---------- Drive persistence ----------
function queueSave() {
  if (!driveReady) return;
  clearTimeout(saveTimer);
  UI.setConnectionBadge(connBadge, "connecting");
  saveTimer = setTimeout(async () => {
    try {
      await Drive.saveMemoryToDrive(memory.data);
      UI.setConnectionBadge(connBadge, "online");
    } catch (e) {
      console.error(e);
      UI.setConnectionBadge(connBadge, "error");
    }
  }, CONFIG.SAVE_DEBOUNCE_MS);
}

async function loadFromDrive() {
  UI.setConnectionBadge(connBadge, "connecting");
  try {
    const data = await Drive.loadMemoryFromDrive(defaultData());
    memory.hydrate(data);
    driveReady = true;
    UI.setConnectionBadge(connBadge, "online");
    applySettingsToUI();
  } catch (e) {
    console.error(e);
    UI.setConnectionBadge(connBadge, "error");
  }
}

// ---------- Auth flow ----------
if (!Auth.isConfigured()) {
  configWarning.classList.remove("hidden");
} else {
  Auth.initAuth({ buttonEl: googleBtnMount });
}

Auth.onAuthChange(async (state) => {
  if (state.status === "identified" || state.status === "connected") {
    userName.textContent = state.profile.name;
    userAvatar.src = state.profile.picture;
    userChip.classList.remove("hidden");
    settingsAccountName.textContent = state.profile.name;
    settingsAccountEmail.textContent = state.profile.email;
  }
  if (state.status === "connected") {
    loginScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    await loadFromDrive();
    voiceEngine.start();
  }
  if (state.status === "signed_out") {
    appShell.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    driveReady = false;
    voiceEngine.stop();
  }
});

btnSignOut.addEventListener("click", () => Auth.signOut());

// ---------- Voice UI wiring ----------
const MIC_LABELS = {
  [VoiceState.UNSUPPORTED]: "VOICE NOT SUPPORTED",
  [VoiceState.MUTED]: "MUTED",
  [VoiceState.IDLE]: "LISTENING FOR “JARVIS”",
  [VoiceState.WAKE_HEARD]: "WAKE WORD DETECTED",
  [VoiceState.PROCESSING]: "PROCESSING…",
  [VoiceState.SPEAKING]: "SPEAKING",
};

function updateMicUI(state) {
  micOrbs.forEach((el) => el && (el.dataset.state = state));
  micStateLabels.forEach((el) => el && (el.textContent = MIC_LABELS[state] || state));
  muteButtons.forEach((el) => {
    if (!el) return;
    el.textContent = state === VoiceState.MUTED ? "UNMUTE" : "MUTE";
    el.classList.toggle("is-muted", state === VoiceState.MUTED);
  });
}

voiceEngine.on((event, payload) => {
  if (event === "state") updateMicUI(payload);
  if (event === "transcript") {
    liveTranscripts.forEach((el) => el && (el.textContent = payload.text || "…"));
  }
  if (event === "wake") {
    liveTranscripts.forEach((el) => el && (el.textContent = "Yes?"));
  }
  if (event === "command") {
    handleVoiceCommand(payload);
  }
  if (event === "error") {
    console.warn("Voice error:", payload);
  }
});
updateMicUI(voiceEngine.state);

function handleVoiceCommand(rawText) {
  const result = interpretCommand(rawText);
  memory.logConversation(rawText, result.text);
  voiceEngine.speak(result.text);
  liveTranscripts.forEach((el) => el && (el.textContent = `“${rawText}” → ${result.text}`));
}

muteButtons.forEach((btn) => btn && btn.addEventListener("click", () => voiceEngine.toggleMute()));

pttButtons.forEach((btn) => {
  if (!btn) return;
  btn.addEventListener("mousedown", () => voiceEngine.pushToTalkStart());
  btn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    voiceEngine.pushToTalkStart();
  });
  btn.addEventListener("mouseup", () => voiceEngine.pushToTalkEnd());
  btn.addEventListener("touchend", () => voiceEngine.pushToTalkEnd());
});

// ---------- Notes UI ----------
noteForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = noteInput.value.trim();
  if (!text) return;
  memory.createNote(text);
  noteInput.value = "";
});

noteSearch.addEventListener("input", () => {
  const results = memory.searchNotes(noteSearch.value);
  UI.renderNotes(results, notesMount);
});

notesMount.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action=delete-note]");
  if (btn) memory.deleteNote(btn.dataset.id);
});

// ---------- Tasks UI ----------
taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  memory.addTask(text, taskPriority.value);
  taskInput.value = "";
});

tasksMount.addEventListener("click", (e) => {
  const completeBtn = e.target.closest("[data-action=complete-task]");
  const deleteBtn = e.target.closest("[data-action=delete-task]");
  if (completeBtn) memory.completeTask(completeBtn.dataset.id);
  if (deleteBtn) memory.deleteTask(deleteBtn.dataset.id);
});

// ---------- Settings UI ----------
function populateVoiceOptions() {
  const voices = voiceEngine.getVoices();
  if (!voices.length) return;
  settingsVoiceSelect.innerHTML = voices
    .map((v) => `<option value="${v.name}">${v.name} (${v.lang})</option>`)
    .join("");
  if (memory.data.settings.voiceName) settingsVoiceSelect.value = memory.data.settings.voiceName;
  pushVoicePrefs();
}
setTimeout(populateVoiceOptions, 300);
if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = populateVoiceOptions;

function pushVoicePrefs() {
  voiceEngine.setVoicePrefs({
    voiceName: settingsVoiceSelect.value || memory.data.settings.voiceName,
    rate: parseFloat(settingsRate.value),
    pitch: parseFloat(settingsPitch.value),
  });
}

function applySettingsToUI() {
  settingsWakeWord.textContent = `“${memory.data.settings.wakeWord}”`;
  settingsRate.value = memory.data.settings.voiceRate;
  settingsPitch.value = memory.data.settings.voicePitch;
  $("#rate-val").textContent = settingsRate.value;
  $("#pitch-val").textContent = settingsPitch.value;
  settingsContinuous.checked = memory.data.settings.continuousListening;
  pushVoicePrefs();
}

settingsVoiceSelect.addEventListener("change", () => {
  memory.updateSettings({ voiceName: settingsVoiceSelect.value });
  pushVoicePrefs();
});
const rateVal = $("#rate-val");
const pitchVal = $("#pitch-val");
settingsRate.addEventListener("input", () => {
  rateVal.textContent = settingsRate.value;
  memory.updateSettings({ voiceRate: parseFloat(settingsRate.value) });
  pushVoicePrefs();
});
settingsPitch.addEventListener("input", () => {
  pitchVal.textContent = settingsPitch.value;
  memory.updateSettings({ voicePitch: parseFloat(settingsPitch.value) });
  pushVoicePrefs();
});
settingsContinuous.addEventListener("change", () => {
  memory.updateSettings({ continuousListening: settingsContinuous.checked });
  if (settingsContinuous.checked) voiceEngine.start();
  else voiceEngine.stop();
});

btnExport.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(memory.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "jarvis-data.json";
  a.click();
  URL.revokeObjectURL(url);
});

btnClear.addEventListener("click", () => {
  if (!confirm("This clears all notes, tasks, and history from this session and from Drive. Continue?")) return;
  memory.hydrate(defaultData());
});

// initial paint (before Drive loads, in case someone reloads mid-session)
renderAll();
