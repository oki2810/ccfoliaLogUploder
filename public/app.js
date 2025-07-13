document.addEventListener("DOMContentLoaded", () => {
  // CSRF トークン取得
  function getCsrfToken() {
    const match = document.cookie.match(/(?:^| )XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  // --- 要素取得 ---
  const githubConnectBtn   = document.getElementById("githubConnectBtn");
  const authSection        = document.getElementById("authSection");
  const loginPanel         = document.getElementById("loginPanel");
  const loginInfo          = document.getElementById("loginInfo");
  const githubDisconnectBtn= document.getElementById("githubDisconnectBtn");
  const repoSettings       = document.getElementById("repoSettings");
  const repoInput          = document.getElementById("repoInput");
  const pathInput          = document.getElementById("pathInput");
  const createAndInitBtn   = document.getElementById("createAndInitBtn");
  const initStatus         = document.getElementById("initStatus");   // ← 追加

  const uploadHtml         = document.getElementById("uploadHtml");
  const formatBtn          = document.getElementById("formatBtn");
  const filenameInput      = document.getElementById("filenameInput");
  const linknameInput      = document.getElementById("linknameInput");
  const formattedOutput    = document.getElementById("formattedOutput");
  const githubUploadBtn    = document.getElementById("githubUploadBtn");
  const viewProjectBtn     = document.getElementById("viewProjectBtn");
  const githubStatus       = document.getElementById("githubStatus");

  let ownerName = "";

  // リンク名 → path 同期
  if (linknameInput && pathInput) {
    const syncPath = () => {
      const name = linknameInput.value.trim() || "test";
      pathInput.value = `log/${name}.html`;
    };
    linknameInput.addEventListener("input", syncPath);
    syncPath();
  }

  // --- GitHub OAuth 開始・解除 ---
  githubConnectBtn.addEventListener("click", () => {
    window.location.href = "/api/auth/github";
  });
  githubDisconnectBtn.addEventListener("click", async () => {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": getCsrfToken() }
    });
    window.location.reload();
  });

  // 認証状態チェック
  fetch("/api/auth-status", {
    credentials: "include",
    headers: { "X-CSRF-Token": getCsrfToken() }
  })
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) {
        authSection.style.display       = "none";
        loginPanel.style.display        = "flex";   // ← 表示
        repoSettings.style.display      = "block";
        loginInfo.textContent           = `GitHub連携中: ${data.username}`;
        ownerName                       = data.username;
      } else {
        authSection.style.display       = "block";
        loginPanel.style.display        = "none";
        repoSettings.style.display      = "none";
        ownerName                       = "";
      }
    });

  // プロジェクト公開リンク更新
  function updateViewBtn() {
    if (!viewProjectBtn) return;
    const repo = repoInput.value.trim();
    if (ownerName && repo) {
      const url = `https://${ownerName}.github.io/${repo}/`;
      viewProjectBtn.onclick = () => window.open(url, "_blank");
      viewProjectBtn.style.display = "inline-block";
    } else {
      viewProjectBtn.style.display = "none";
    }
  }
  repoInput.addEventListener("input", updateViewBtn);

  // --- リポジトリ作成＆初期化 ---
  createAndInitBtn.addEventListener("click", async () => {
    const repo = repoInput.value.trim();
    if (!repo) return alert("リポジトリ名を入力してください");

    initStatus.textContent = "GitHubリポジトリを作成し、初期設定中…";

    try {
      const res = await fetch("/api/create-and-init", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken(),
        },
        body: JSON.stringify({ repo }),
      });
      const result = await res.json();
      if (result.ok) {
        initStatus.innerHTML = `<div class="alert alert-success">リポジトリ作成と初期設定が完了しました！</div>`;
        updateViewBtn();
      } else {
        initStatus.innerHTML = `<div class="alert alert-danger">エラー: ${result.error}</div>`;
      }
    } catch (err) {
      console.error(err);
      initStatus.innerHTML = `<div class="alert alert-danger">通信エラーが発生しました</div>`;
    }
  });

  // --- 以下、②の処理は変更なし ---
  // GitHub へのコミット、HTML整形 など省略
});
