/**
 * MangaBook Hitomi Content Script
 * Injects "下载到漫书" button and communicates with MangaBook Mac App.
 */

(function () {
  'use strict';

  const MANGABOOK_SERVER = 'http://127.0.0.1:48123';

  function extractGalleryId() {
    const path = window.location.pathname;
    const match = path.match(/[/-]([0-9]+)\.html/) || path.match(/\/galleries\/([0-9]+)/) || path.match(/\/reader\/([0-9]+)/);
    return match ? match[1] : null;
  }

  const galleryId = extractGalleryId();
  if (!galleryId) return;

  const isReaderPage = window.location.pathname.startsWith('/reader/');

  let pollInterval = null;

  function createButton() {
    const btn = document.createElement('a');
    btn.id = 'mangabook-dl-button';
    btn.href = 'javascript:void(0);';
    btn.className = isReaderPage ? 'mangabook-reader-floating-btn' : 'mangabook-dl-btn';
    btn.innerHTML = '📥 下载到漫书';

    btn.addEventListener('click', onButtonClick);
    return btn;
  }

  function injectButton() {
    if (document.getElementById('mangabook-dl-button')) return;

    const btn = createButton();

    if (isReaderPage) {
      document.body.appendChild(btn);
      checkInitialStatus(btn);
      return;
    }

    // Gallery Page
    const dlButton = document.getElementById('dl-button');
    if (dlButton && dlButton.parentNode) {
      dlButton.parentNode.insertBefore(btn, dlButton.nextSibling);
    } else {
      const coverColumn = document.querySelector('.cover-column');
      if (coverColumn) {
        coverColumn.appendChild(btn);
      } else {
        const gallery = document.querySelector('.gallery');
        if (gallery) gallery.prepend(btn);
      }
    }

    checkInitialStatus(btn);
  }

  async function checkInitialStatus(btn) {
    try {
      const res = await fetch(`${MANGABOOK_SERVER}/api/status?id=${galleryId}`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.task) {
          updateButtonState(btn, data.task);
          if (data.task.state === 'downloading' || data.task.state === 'fetching') {
            startPolling(btn);
          }
        }
      }
    } catch {
      // MangaBook not running or no active task
    }
  }

  async function onButtonClick(e) {
    e.preventDefault();
    const btn = document.getElementById('mangabook-dl-button');
    if (!btn) return;

    if (btn.classList.contains('is-downloading')) return;

    btn.className = (isReaderPage ? 'mangabook-reader-floating-btn' : 'mangabook-dl-btn') + ' is-downloading';
    btn.innerHTML = '⏳ 正在请求漫书…';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${MANGABOOK_SERVER}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: window.location.href, id: galleryId }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        btn.innerHTML = '⏳ 正在解析画册…';
        startPolling(btn);
        return;
      }
    } catch {
      // Local server unreachable, fallback to custom URL scheme to wake up MangaBook
      btn.innerHTML = '🚀 正在唤起漫书 App…';
      window.location.href = `mangabook://download?id=${galleryId}`;
      setTimeout(() => {
        startPolling(btn);
      }, 1500);
      return;
    }
  }

  function startPolling(btn) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${MANGABOOK_SERVER}/api/status?id=${galleryId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.task) {
          updateButtonState(btn, data.task);
          if (data.task.state === 'completed' || data.task.state === 'failed') {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      } catch {
        // App might still be launching
      }
    }, 1000);
  }

  function updateButtonState(btn, task) {
    const baseClass = isReaderPage ? 'mangabook-reader-floating-btn' : 'mangabook-dl-btn';
    btn.className = baseClass;

    switch (task.state) {
      case 'fetching':
        btn.classList.add('is-downloading');
        btn.innerHTML = '⏳ 正在获取画册信息…';
        break;
      case 'downloading':
        btn.classList.add('is-downloading');
        const pct = Math.round(task.progress * 100);
        if (task.totalPages > 0) {
          btn.innerHTML = `📥 下载中 (${task.completedPages}/${task.totalPages}页 · ${pct}%)`;
        } else {
          btn.innerHTML = `📥 下载中 (${pct}%)…`;
        }
        break;
      case 'completed':
        btn.classList.add('is-completed');
        btn.innerHTML = '✅ 已存入漫画库！';
        break;
      case 'failed':
        btn.classList.add('is-failed');
        btn.innerHTML = '❌ 下载失败 (点击重试)';
        break;
      default:
        btn.innerHTML = '📥 下载到漫书';
        break;
    }
  }

  // Inject when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }

  // Also monitor DOM in case Hitomi SPA dynamically mounts elements
  const observer = new MutationObserver(() => {
    if (!document.getElementById('mangabook-dl-button')) {
      injectButton();
    }
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
