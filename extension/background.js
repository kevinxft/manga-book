/**
 * MangaBook Background Service Worker
 * Handles silent communication with local MangaBook HTTP API (127.0.0.1:48123).
 * Bypasses webpage Mixed-Content and Private Network Access restrictions.
 */

const MANGABOOK_SERVER = 'http://127.0.0.1:48123';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    fetch(`${MANGABOOK_SERVER}/api/ping`)
      .then(res => res.json())
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'download') {
    fetch(`${MANGABOOK_SERVER}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: request.url, id: request.id })
    })
      .then(res => res.json())
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (request.action === 'status') {
    fetch(`${MANGABOOK_SERVER}/api/status?id=${encodeURIComponent(request.id)}`)
      .then(res => res.json())
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (request.action === 'tasks') {
    fetch(`${MANGABOOK_SERVER}/api/tasks`)
      .then(res => res.json())
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
