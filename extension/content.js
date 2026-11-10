/**
 * MangaBook Hitomi Content Script
 * Clean native-matched button, duplicate detection, and silent background download.
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
  let cachedTaskInfo = null;

  function sendApiMessage(action, payload = {}) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ action, ...payload }, response => {
        resolve(response || { ok: false });
      });
    });
  }

  function getPageMetadata() {
    let title = '';
    let artist = '';
    if (typeof galleryinfo !== 'undefined' && galleryinfo) {
      title = galleryinfo.title || '';
      artist = (galleryinfo.artists && galleryinfo.artists[0] && galleryinfo.artists[0].artist) || '';
    } else {
      title = document.querySelector('#gallery-brand')?.textContent?.trim() || '';
      artist = document.querySelector('#artists a')?.textContent?.trim() || document.querySelector('#artists')?.textContent?.trim() || '';
    }
    return { title, artist };
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
    const meta = getPageMetadata();
    const res = await sendApiMessage('status', { id: galleryId, title: meta.title, artist: meta.artist });
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

    // If already in library, clicking opens it directly in MangaBook!
    if (btn.classList.contains('is-completed')) {
      setButtonLabel(btn, '正在打开漫书…');
      await sendApiMessage('open', { id: galleryId });
      setTimeout(() => {
        if (cachedTaskInfo) {
          updateButtonState(btn, cachedTaskInfo);
        } else {
          setButtonLabel(btn, '已在漫书中 (点击阅读)');
        }
      }, 1200);
      return;
    }

    btn.className = (isReaderPage ? 'mangabook-reader-btn' : '') + ' is-downloading';
    setButtonLabel(btn, '下载中…');

    const meta = getPageMetadata();
    const res = await sendApiMessage('download', { url: window.location.href, id: galleryId });
    if (res && res.ok) {
      if (res.data && res.data.task && res.data.task.alreadyExists) {
        updateButtonState(btn, res.data.task);
        return;
      }
      setButtonLabel(btn, '下载中…');
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
    const meta = getPageMetadata();
    pollInterval = setInterval(async () => {
      const res = await sendApiMessage('status', { id: galleryId, title: meta.title, artist: meta.artist });
      if (res && res.ok && res.data && res.data.task) {
        updateButtonState(btn, res.data.task);
        if (res.data.task.state === 'completed' || res.data.task.state === 'failed') {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }
    }, 600);
  }

  function updateButtonState(btn, task) {
    cachedTaskInfo = task;
    btn.className = isReaderPage ? 'mangabook-reader-btn' : '';

    switch (task.state) {
      case 'fetching':
        btn.classList.add('is-downloading');
        setButtonLabel(btn, '下载中…');
        break;
      case 'downloading':
        btn.classList.add('is-downloading');
        const pct = Math.round((task.progress || 0) * 100);
        if (task.totalPages > 0) {
          setButtonLabel(btn, `下载中 (${task.completedPages}/${task.totalPages}页 · ${pct}%)`);
        } else {
          setButtonLabel(btn, `下载中 (${pct}%)…`);
        }
        break;
      case 'completed':
        btn.classList.add('is-completed');
        const pagesText = task.totalPages > 0 ? ` (共 ${task.totalPages} 页)` : '';
        if (task.alreadyExists) {
          setButtonLabel(btn, `已在漫书中${pagesText}`);
        } else {
          setButtonLabel(btn, `已下载完成${pagesText} ✓`);
        }
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
