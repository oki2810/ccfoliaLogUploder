// CCU_template/loglist.js

document.addEventListener('DOMContentLoaded', () => {
  const ul = document.getElementById('log-list');
  if (!ul) return;

  // 1) Sortable.js でドラッグ＆ドロップを有効化
  Sortable.create(ul, {
    animation: 150,
    onEnd: async () => {
      // 並び順が変わったら、data-path の配列をサーバーに送信
      const order = Array.from(ul.children).map(li => li.dataset.path);
      const cfg = window.CCU_CONFIG || {};
      const res = await fetch('/api/reorder-logs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: cfg.owner,
          repo: cfg.repo,
          order
        })
      });
      const j = await res.json();
      if (!j.ok) alert('並べ替えの保存に失敗しました: ' + j.error);
    }
  });

  // 2) 削除ボタン
  ul.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-delete')) return;
    const li = e.target.closest('li');
    const path = li.dataset.path;
    if (!confirm('本当にこのログを削除しますか？')) return;

    const cfg = window.CCU_CONFIG || {};
    const res = await fetch('/api/delete-log', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: cfg.owner, repo: cfg.repo, path })
    });
    const j = await res.json();
    if (j.ok) {
      li.remove();
    } else {
      alert('削除に失敗しました: ' + j.error);
    }
  });
});
