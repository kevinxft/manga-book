document.addEventListener('DOMContentLoaded', async () => {
  const badge = document.getElementById('conn-badge');
  const text = document.getElementById('conn-text');
  const hitomiPanel = document.getElementById('hitomi-panel');
  const downloadCurrentBtn = document.getElementById('download-current-btn');
  const taskList = document.getElementById('task-list');

  let currentGalleryId = null;
  let currentUrl = null;

  function sendApiMessage(action, payload = {}) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ action, ...payload }, response => {
        resolve(response || { ok: false });
      });
    });
  }

  // 1. Check current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      currentUrl = tabs[0].url;
      const match = currentUrl.match(/[/-]([0-9]+)\.html/) || currentUrl.match(/\/galleries\/([0-9]+)/) || currentUrl.match(/\/reader\/([0-9]+)/);
      if (match && currentUrl.includes('hitomi.la')) {
        currentGalleryId = match[1];
        hitomiPanel.style.display = 'block';
        document.getElementById('page-gallery-title').textContent = `画册 ID: ${currentGalleryId}`;
      }
    }
  });

  // 2. Ping MangaBook server
  async function refreshServerStatus() {
    const res = await sendApiMessage('ping');
    if (res && res.ok) {
      badge.className = 'badge online';
      text.textContent = '漫书已连接';
      loadTasks();
    } else {
      badge.className = 'badge';
      text.textContent = '漫书未启动';
    }
  }

  // 3. Load Tasks
  async function loadTasks() {
    const res = await sendApiMessage('tasks');
    if (res && res.ok && res.data && res.data.tasks && res.data.tasks.length > 0) {
      taskList.innerHTML = '';
      res.data.tasks.forEach(t => {
        const card = document.createElement('div');
        card.className = 'task-card';
        const stateLabel = t.state === 'completed' ? '完成 ✓' : (t.state === 'downloading' ? `下载中 ${Math.round(t.progress * 100)}%` : t.statusText);
        card.innerHTML = `
          <div class="task-name" title="${t.title}">${t.title}</div>
          <div class="task-status">
            <span>${t.artist || '未知作者'}</span>
            <span>${stateLabel}</span>
          </div>
        `;
        taskList.appendChild(card);
      });
    } else {
      taskList.innerHTML = '<div class="empty-tasks">暂无下载记录</div>';
    }
  }

  // 4. Download Current Button
  downloadCurrentBtn.addEventListener('click', async () => {
    if (!currentGalleryId) return;
    downloadCurrentBtn.disabled = true;
    downloadCurrentBtn.textContent = '正在发送请求…';

    const res = await sendApiMessage('download', { url: currentUrl, id: currentGalleryId });
    if (res && res.ok) {
      downloadCurrentBtn.textContent = '已开始后台下载';
      setTimeout(() => {
        loadTasks();
        downloadCurrentBtn.disabled = false;
        downloadCurrentBtn.textContent = '重新下载';
      }, 1500);
    } else {
      window.open(`mangabook://download?id=${currentGalleryId}`);
      downloadCurrentBtn.textContent = '已唤起漫书客户端';
      setTimeout(() => {
        downloadCurrentBtn.disabled = false;
        downloadCurrentBtn.textContent = '下载此漫画到漫书';
      }, 2000);
    }
  });

  refreshServerStatus();
  setInterval(refreshServerStatus, 2500);
});
