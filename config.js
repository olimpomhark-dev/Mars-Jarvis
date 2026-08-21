/**
 * MARS JARVIS — Configuration
 * ----------------------------
 * Fill in GOOGLE_CLIENT_ID before running the app.
 * See README.md → "1. Google Cloud setup" for exact steps.
 */
export const CONFIG = {
  // Paste your OAuth 2.0 Web Client ID here (ends in .apps.googleusercontent.com)
  GOOGLE_CLIENT_ID: "1018612758154-qeatqph1h89q7959nns4mkt88e3d845e.apps.googleusercontent.com",

  // Least-privilege scope: only files this app creates/opens. No access to the
  // rest of the user's Drive.
  DRIVE_SCOPE: "https://www.googleapis.com/auth/drive.file",

  // Where MARS JARVIS keeps its data
  DRIVE_FOLDER_NAME: "MARS-JARVIS",
  DRIVE_FILE_NAME: "jarvis-data.json",

  // Voice
  WAKE_WORD: "jarvis",
  DEFAULT_VOICE_RATE: 1,
  DEFAULT_VOICE_PITCH: 1,

  // How often to autosave to Drive after a change (ms)
  SAVE_DEBOUNCE_MS: 1500,
};
