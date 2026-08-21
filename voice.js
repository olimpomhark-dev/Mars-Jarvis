/**
 * MARS JARVIS — Voice engine
 * ---------------------------
 * Wraps the Web Speech API:
 *   - SpeechRecognition: continuous listening, wake-word ("jarvis") gating,
 *     push-to-talk (bypasses the wake word for one command).
 *   - SpeechSynthesis: spoken responses.
 *
 * This module knows nothing about notes/tasks — it only turns audio into
 * "command text" events and speaks strings it's given. commands.js does
 * the interpreting.
 */

import { CONFIG } from "./config.js";

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

export const VoiceState = {
  UNSUPPORTED: "unsupported",
  IDLE: "idle", // mic on, waiting for wake word
  MUTED: "muted", // mic off entirely
  WAKE_HEARD: "wake_heard", // wake word detected, capturing command
  PROCESSING: "processing", // command handed off, waiting on a reply
  SPEAKING: "speaking", // synthesis playing
};

class VoiceEngine {
  constructor() {
    this.supported = !!SpeechRecognitionImpl;
    this.recognition = null;
    this.state = this.supported ? VoiceState.MUTED : VoiceState.UNSUPPORTED;
    this.pushToTalkActive = false;
    this.shouldRun = false; // whether we *want* the mic running (vs. deliberately stopped)
    this.wakeWord = CONFIG.WAKE_WORD.toLowerCase();
    this.listeners = new Set();
    this.voices = [];

    if (this.supported) this._setupRecognition();
    if (window.speechSynthesis) {
      const loadVoices = () => (this.voices = window.speechSynthesis.getVoices());
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(event, payload) {
    for (const fn of this.listeners) fn(event, payload);
  }

  _setState(state) {
    this.state = state;
    this._emit("state", state);
  }

  _setupRecognition() {
    const rec = new SpeechRecognitionImpl();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim();
      this._emit("transcript", { text: transcript, final: result.isFinal });
      if (!result.isFinal) return;
      this._handleFinalTranscript(transcript);
    };

    rec.onerror = (event) => {
      this._emit("error", event.error);
      // "no-speech" / "aborted" are routine in continuous mode — just let onend restart it.
    };

    rec.onend = () => {
      if (this.shouldRun && this.state !== VoiceState.MUTED) {
        // Browsers auto-stop recognition after a period of silence; keep it alive.
        try {
          rec.start();
        } catch (e) {
          /* already starting */
        }
      }
    };

    this.recognition = rec;
  }

  _handleFinalTranscript(transcript) {
    const lower = transcript.toLowerCase();

    if (this.pushToTalkActive) {
      // Push-to-talk: whole utterance is the command, no wake word needed.
      this.pushToTalkActive = false;
      this._setState(VoiceState.PROCESSING);
      this._emit("command", transcript);
      return;
    }

    const wakeIndex = lower.indexOf(this.wakeWord);
    if (wakeIndex === -1) return; // no wake word heard, ignore

    const rest = transcript.slice(wakeIndex + this.wakeWord.length).trim();
    this._setState(VoiceState.WAKE_HEARD);
    this._emit("wake");

    if (rest.length > 0) {
      this._setState(VoiceState.PROCESSING);
      this._emit("command", rest);
    } else {
      // Just "Jarvis" with no command yet — stay listening for the follow-up.
      setTimeout(() => {
        if (this.state === VoiceState.WAKE_HEARD) this._setState(VoiceState.IDLE);
      }, 4000);
    }
  }

  start() {
    if (!this.supported) return;
    this.shouldRun = true;
    this._setState(VoiceState.IDLE);
    try {
      this.recognition.start();
    } catch (e) {
      /* already running */
    }
  }

  stop() {
    this.shouldRun = false;
    this._setState(VoiceState.MUTED);
    try {
      this.recognition.stop();
    } catch (e) {
      /* not running */
    }
  }

  toggleMute() {
    if (this.state === VoiceState.MUTED) this.start();
    else this.stop();
  }

  /** Hold-to-talk: capture the next utterance as a command, no wake word required. */
  pushToTalkStart() {
    if (!this.supported) return;
    this.pushToTalkActive = true;
    this._setState(VoiceState.WAKE_HEARD);
    if (this.state === VoiceState.MUTED || !this.shouldRun) {
      this.shouldRun = true;
      try {
        this.recognition.start();
      } catch (e) {
        /* already running */
      }
    }
  }

  pushToTalkEnd() {
    // Recognition keeps listening until a final result arrives or silence times out;
    // nothing to do here beyond letting the flag ride until _handleFinalTranscript.
  }

  speak(text, { onEnd } = {}) {
    if (!window.speechSynthesis) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const wanted = this._preferredVoiceName;
    if (wanted) {
      const v = this.voices.find((v) => v.name === wanted);
      if (v) utter.voice = v;
    }
    utter.rate = this._rate || CONFIG.DEFAULT_VOICE_RATE;
    utter.pitch = this._pitch || CONFIG.DEFAULT_VOICE_PITCH;

    utter.onstart = () => this._setState(VoiceState.SPEAKING);
    utter.onend = () => {
      this._setState(this.shouldRun ? VoiceState.IDLE : VoiceState.MUTED);
      onEnd?.();
    };
    window.speechSynthesis.speak(utter);
  }

  setVoicePrefs({ voiceName, rate, pitch }) {
    this._preferredVoiceName = voiceName;
    this._rate = rate;
    this._pitch = pitch;
  }

  getVoices() {
    return this.voices;
  }
}

export const voiceEngine = new VoiceEngine();
