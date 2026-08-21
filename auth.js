/**
 * MARS JARVIS — Auth
 * -------------------
 * Uses Google Identity Services (loaded via <script src="https://accounts.google.com/gsi/client">).
 *   1. google.accounts.id        -> "Sign in with Google" button, gives an ID token (identity/profile)
 *   2. google.accounts.oauth2    -> token client, gives an access token scoped to Drive
 *
 * No backend: the ID token is decoded client-side purely to show name/email/photo.
 * It is never verified server-side because there is no server — treat it as
 * display-only, not as a security boundary.
 */

import { CONFIG } from "./config.js";

let accessToken = null;
let tokenClient = null;
let profile = null;

const listeners = new Set();
function emit(state) {
  for (const fn of listeners) fn(state);
}

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isConfigured() {
  return !CONFIG.GOOGLE_CLIENT_ID.startsWith("PASTE_");
}

export function getProfile() {
  return profile;
}

export function getAccessToken() {
  return accessToken;
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const json = decodeURIComponent(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to decode ID token", e);
    return null;
  }
}

function handleCredential(response) {
  const payload = decodeJwt(response.credential);
  if (!payload) return;
  profile = {
    name: payload.name,
    email: payload.email,
    picture: payload.picture,
  };
  emit({ status: "identified", profile });
  // Identity confirmed — now request a Drive access token.
  requestDriveAccess();
}

export function initAuth({ buttonEl } = {}) {
  if (!isConfigured()) {
    emit({ status: "unconfigured" });
    return;
  }

  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredential,
    auto_select: true,
  });

  if (buttonEl) {
    google.accounts.id.renderButton(buttonEl, {
      theme: "filled_black",
      shape: "pill",
      size: "large",
      text: "signin_with",
      logo_alignment: "left",
    });
  }
  google.accounts.id.prompt();

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: CONFIG.DRIVE_SCOPE,
    prompt: "",
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        emit({ status: "error", error: tokenResponse.error });
        return;
      }
      accessToken = tokenResponse.access_token;
      emit({ status: "connected", profile, accessToken });
    },
  });
}

export function requestDriveAccess() {
  if (!tokenClient) return;
  tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
}

export function signOut() {
  if (profile?.email && window.google) {
    google.accounts.id.disableAutoSelect();
  }
  if (accessToken && window.google) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  profile = null;
  emit({ status: "signed_out" });
}
