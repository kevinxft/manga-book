/**
 * MangaBook Hitomi Content Script
 * Clean, native-matched button injection and silent background communication.
 */

(function () {
  'use strict';

  function extractGalleryId() {
    const path = window.location.pathname;
    const match = path.match(/[/-]([0-9]+)\.html/) || path.match(/\/galleries\/([0-9]+)/) || path.match(/\/reader\/([0-9]+)/);
    return match ? match[1] : null;
  }

  const galleryId = extractGalleryId();
  if (!galleryId) return;

  const isReaderPage = window.location.pathname.startsWith('/reader/');
  let pollInterval = null;

  function sendApiMessage(action, payload = {}) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ action, ...payload }, response => {
        resolve(response || { ok: false });
      });
    });
  }

  function setButtonLabel(btn, text) {
    if (isReaderPage) {
      btn.textContent = text;
    } else {
      btn.innerHTML = `<h1>${text}</h1>`;
    }
  }

  function createButton() {
    const btn = document.createElement('a');
    btn.id = 'mangabook-dl-button';
    btn.href = 'javascript:void(0);';
    if (isReaderPage) {
      btn.className = 'mangabook-reader-btn';
    }
    setButtonLabel(btn, '下载到漫书');

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
    const res = await sendApiMessage('status', { id: galleryId });
    if (res && res.ok && res.data && res.data.task) {
      updateButtonState(btn, res.data.task);
      if (res.data.task.state === 'downloading' || res.data.task.state === 'fetching') {
        startPolling(btn);
      }
    }
  }

  async function onButtonClick(e) {
    e.preventDefault();
    const btn = document.getElementById('mangabook-dl-button');
    if (!btn) return;

    if (btn.classList.contains('is-downloading')) return;

    btn.className = (isReaderPage ? 'mangabook-reader-btn' : '') + ' is-downloading';
    setButtonLabel(btn, '正在连接…');

    const res = await sendApiMessage('download', { url: window.location.href, id: galleryId });
    if (res && res.ok) {
      setButtonLabel(btn, '获取画册信息…');
      startPolling(btn);
      return;
    }

    // Local server unreachable, fallback to custom URL scheme
    setButtonLabel(btn, '正在唤起漫书…');
    window.location.href = `mangabook://download?id=${galleryId}`;
    setTimeout(() => {
      startPolling(btn);
    }, 1500);
  }

  function startPolling(btn) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      const res = await sendApiMessage('status', { id: galleryId });
      if (res && res.ok && res.data && res.data.task) {
        updateButtonState(btn, res.data.task);
        if (res.data.task.state === 'completed' || res.data.task.state === 'failed') {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }
    }, 1000);
  }

  function updateButtonState(btn, task) {
    btn.className = isReaderPage ? 'mangabook-reader-btn' : '';

    switch (task.state) {
      case 'fetching':
        btn.classList.add('is-downloading');
        setButtonLabel(btn, '获取画册信息…');
        break;
      case 'downloading':
        btn.classList.add('is-downloading');
        const pct = Math.round(task.progress * 100);
        if (task.totalPages > 0) {
          setButtonLabel(btn, `下载中 (${task.completedPages}/${task.totalPages}页 · ${pct}%)`);
        } else {
          setButtonLabel(btn, `下载中 (${pct}%)…`);
        }
        break;
      case 'completed':
        btn.classList.add('is-completed');
        setButtonLabel(btn, '已存入漫书 ✓');
        break;
      case 'failed':
        btn.classList.add('is-failed');
        setButtonLabel(btn, '下载失败 (点击重试)');
        break;
      default:
        setButtonLabel(btn, '下载到漫书');
        break;
    }
  }

  // Inject when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }

  // Monitor DOM for SPA changes
  const observer = new MutationObserver(() => {
    if (!document.getElementById('mangabook-dl-button')) {
      injectButton();
    }
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
