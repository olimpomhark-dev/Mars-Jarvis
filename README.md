# MARS JARVIS — Phase I

A browser-based personal AI operating system, Jarvis-inspired. Phase I is the
**foundation**: dashboard shell, voice console, and a Google Drive-backed
memory system. No backend, no database, no framework — plain HTML/CSS/JS.
All persistent data lives in **your own Google Drive**, in a file called
`jarvis-data.json` inside a `MARS-JARVIS` folder.

```
mars-jarvis/
├─ index.html
├─ css/
│  └─ styles.css
├─ js/
│  ├─ config.js      ← put your Google Client ID here
│  ├─ auth.js         Google Sign-In + Drive OAuth token
│  ├─ drive.js         Drive REST calls (find/create/save jarvis-data.json)
│  ├─ memory.js         in-memory data model + CRUD (notes, tasks, etc.)
│  ├─ voice.js           Web Speech API (wake word, push-to-talk, TTS)
│  ├─ commands.js         "Jarvis, ..." command parser
│  ├─ ui.js                DOM rendering
│  └─ app.js                wires everything together
└─ README.md
```

## 1. Google Cloud setup (one-time, ~5 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create (or pick) a project.
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → set it up as "External," add
   your own Google account as a test user (unless you verify the app).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → Application type: **Web application**.
   - Authorized JavaScript origins: add whatever origin you'll serve the app
     from, e.g. `http://localhost:5500` or `https://yourdomain.com`.
   - No redirect URI is needed (this app uses the Google Identity Services
     token-client flow, not a redirect).
5. Copy the generated **Client ID** (ends in `.apps.googleusercontent.com`).
6. Paste it into `js/config.js`:
   ```js
   GOOGLE_CLIENT_ID: "your-id-here.apps.googleusercontent.com",
   ```

MARS JARVIS requests only the `drive.file` scope — it can only see or edit
files it creates itself (the `MARS-JARVIS` folder and `jarvis-data.json`),
never the rest of your Drive.

## 2. Run it

Because the app uses native ES modules (`<script type="module">`), it must be
served over `http://` or `https://` — opening `index.html` directly via
`file://` will fail. Any static file server works, for example:

```bash
cd mars-jarvis
python3 -m http.server 5500
# then visit http://localhost:5500
```

(Whatever port/origin you use must match an "Authorized JavaScript origin"
from step 4 above.)

## 3. Using it

- **Sign in** with Google on the login screen. This both identifies you and
  requests Drive access — on first sign-in, MARS JARVIS creates
  `MARS-JARVIS/jarvis-data.json` in your Drive automatically.
- **Wake word**: say **"Jarvis"** followed by a command. Example:
  - *"Jarvis, save a note blockchain idea"* → *"I have saved your note."*
  - *"Jarvis, add a task finish the robotics report, high priority"*
  - *"Jarvis, complete task finish the robotics report"*
  - *"Jarvis, show my notes"* / *"Jarvis, show tasks"*
- **Push-to-talk**: hold the "HOLD TO TALK" button to speak a command without
  the wake word.
- **Mute**: stops the microphone entirely.
- Everything you do — notes, tasks, voice commands — is saved to Drive a
  couple seconds after each change (see the sync badge top-right).
- **Settings** lets you pick a synthesis voice, adjust rate/pitch, toggle
  continuous listening, export a local copy of `jarvis-data.json`, or clear
  all data.

## Browser support

Voice features need the Web Speech API (`SpeechRecognition` +
`speechSynthesis`), which is solid in Chrome/Edge but limited or unavailable
in Firefox/Safari. The rest of the dashboard works everywhere; unsupported
browsers will just show "VOICE NOT SUPPORTED" and you can still use the
on-screen forms for notes/tasks.

## Data shape (`jarvis-data.json`)

```json
{
  "notes": [{ "id": "...", "text": "...", "createdAt": "...", "updatedAt": "..." }],
  "tasks": [{ "id": "...", "text": "...", "priority": "high|medium|low", "completed": false, "createdAt": "...", "completedAt": null }],
  "research": [],
  "settings": { "wakeWord": "jarvis", "voiceName": null, "voiceRate": 1, "voicePitch": 1, "continuousListening": true },
  "conversations": [{ "id": "...", "timestamp": "...", "input": "...", "response": "..." }],
  "meta": { "createdAt": "...", "updatedAt": "...", "version": 1 }
}
```

## What's next (future phases)

Phase I intentionally only builds the shell: UI, auth, Drive memory, notes,
tasks, and basic voice commands. Later phases can layer on top of this same
`jarvis-data.json` schema — e.g. a `research` module, smarter natural
language command parsing, calendar/reminders, or connecting an LLM API for
open-ended conversation — without changing the storage model.
