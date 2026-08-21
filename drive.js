/**
 * MARS JARVIS — Google Drive persistence
 * ----------------------------------------
 * Pure REST calls against the Drive v3 API using fetch + the access token
 * from auth.js. No gapi client library, no backend.
 *
 * Layout on Drive:
 *   /MARS-JARVIS/jarvis-data.json
 *
 * Uses the `drive.file` scope, so this app can only see/edit files it
 * itself created — it will look for an existing folder+file first (in
 * case a previous session already created them) before making new ones.
 */

import { CONFIG } from "./config.js";
import { getAccessToken } from "./auth.js";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

function authHeaders() {
  const token = getAccessToken();
  if (!token) throw new Error("No Drive access token yet");
  return { Authorization: `Bearer ${token}` };
}

async function driveFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive API ${res.status}: ${body}`);
  }
  return res;
}

let folderIdCache = null;
let fileIdCache = null;

async function findFolder() {
  const q = encodeURIComponent(
    `name='${CONFIG.DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await driveFetch(`${API}/files?q=${q}&spaces=drive&fields=files(id,name)`);
  const json = await res.json();
  return json.files?.[0]?.id || null;
}

async function createFolder() {
  const res = await driveFetch(`${API}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: CONFIG.DRIVE_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const json = await res.json();
  return json.id;
}

async function findFile(folderId) {
  const q = encodeURIComponent(
    `name='${CONFIG.DRIVE_FILE_NAME}' and '${folderId}' in parents and trashed=false`
  );
  const res = await driveFetch(`${API}/files?q=${q}&spaces=drive&fields=files(id,name)`);
  const json = await res.json();
  return json.files?.[0]?.id || null;
}

async function createFile(folderId, dataObj) {
  const boundary = "-------marsjarvis" + Date.now();
  const metadata = { name: CONFIG.DRIVE_FILE_NAME, parents: [folderId], mimeType: "application/json" };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(dataObj)}\r\n` +
    `--${boundary}--`;

  const res = await driveFetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const json = await res.json();
  return json.id;
}

async function updateFile(fileId, dataObj) {
  await driveFetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dataObj),
  });
}

async function downloadFile(fileId) {
  const res = await driveFetch(`${API}/files/${fileId}?alt=media`);
  return res.json();
}

/** Ensure the MARS-JARVIS folder + jarvis-data.json exist. Returns {folderId, fileId, isNew}. */
async function ensureStructure(defaultData) {
  folderIdCache = folderIdCache || (await findFolder()) || (await createFolder());
  fileIdCache = fileIdCache || (await findFile(folderIdCache));
  let isNew = false;
  if (!fileIdCache) {
    fileIdCache = await createFile(folderIdCache, defaultData);
    isNew = true;
  }
  return { folderId: folderIdCache, fileId: fileIdCache, isNew };
}

export async function loadMemoryFromDrive(defaultData) {
  const { fileId, isNew } = await ensureStructure(defaultData);
  if (isNew) return defaultData;
  return downloadFile(fileId);
}

export async function saveMemoryToDrive(dataObj) {
  const { fileId } = await ensureStructure(dataObj);
  await updateFile(fileId, dataObj);
}

export function resetDriveCache() {
  folderIdCache = null;
  fileIdCache = null;
}
