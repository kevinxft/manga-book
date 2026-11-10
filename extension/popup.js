const MANGABOOK_SERVER = 'http://127.0.0.1:48123';

document.addEventListener('DOMContentLoaded', async () => {
  const badge = document.getElementById('conn-badge');
  const text = document.getElementById('conn-text');
  const hitomiPanel = document.getElementById('hitomi-panel');
  const downloadCurrentBtn = document.getElementById('download-current-btn');
  const taskList = document.getElementById('task-list');

  let currentGalleryId = null;
  let currentUrl = null;

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
    try {
      const res = await fetch(`${MANGABOOK_SERVER}/api/ping`);
      if (res.ok) {
        badge.className = 'badge online';
        text.textContent = '漫书已连接';
        loadTasks();
      } else {
        throw new Error();
      }
    } catch {
      badge.className = 'badge';
      text.textContent = '漫书未启动';
    }
  }

  // 3. Load Tasks
  async function loadTasks() {
    try {
      const res = await fetch(`${MANGABOOK_SERVER}/api/tasks`);
      if (res.ok) {
        const data = await res.json();
        if (data.tasks && data.tasks.length > 0) {
          taskList.innerHTML = '';
          data.tasks.forEach(t => {
            const card = document.createElement('div');
            card.className = 'task-card';
            const stateLabel = t.state === 'completed' ? '✅ 完成' : (t.state === 'downloading' ? `📥 ${Math.round(t.progress * 100)}%` : t.statusText);
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
    } catch {
      // Ignored
    }
  }

  // 4. Download Current Button
  downloadCurrentBtn.addEventListener('click', async () => {
    if (!currentGalleryId) return;
    downloadCurrentBtn.disabled = true;
    downloadCurrentBtn.textContent = '⏳ 发送中…';

    try {
      const res = await fetch(`${MANGABOOK_SERVER}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: currentUrl, id: currentGalleryId })
      });
      if (res.ok) {
        downloadCurrentBtn.textContent = '✅ 已开始下载！';
        setTimeout(() => {
          loadTasks();
          downloadCurrentBtn.disabled = false;
          downloadCurrentBtn.textContent = '📥 重新下载';
        }, 1500);
      } else {
        throw new Error();
      }
    } catch {
      // Fallback URL scheme
      window.open(`mangabook://download?id=${currentGalleryId}`);
      downloadCurrentBtn.textContent = '🚀 已唤起漫书 App';
      setTimeout(() => {
        downloadCurrentBtn.disabled = false;
        downloadCurrentBtn.textContent = '📥 下载此漫画到漫书';
      }, 2000);
    }
  });

  refreshServerStatus();
  setInterval(refreshServerStatus, 2500);
});
