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
  const useExistingBtn     = document.getElementById("useExistingBtn");
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

  // タブ切り替え要素
  const tabCCU = document.getElementById("tabCCU");
  const tabUsage = document.getElementById("tabUsage");
  const ccuContent = document.getElementById("ccuContent");
  const usageContent = document.getElementById("usageContent");

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

  // --- タブ切り替え ---
  function activateTab(target) {
    if (!tabCCU || !tabUsage || !ccuContent || !usageContent) return;
    if (target === "ccu") {
      tabCCU.classList.add("active");
      tabUsage.classList.remove("active");
      ccuContent.style.display = "block";
      usageContent.style.display = "none";
    } else {
      tabUsage.classList.add("active");
      tabCCU.classList.remove("active");
      ccuContent.style.display = "none";
      usageContent.style.display = "block";
    }
  }
  if (tabCCU && tabUsage) {
    tabCCU.addEventListener("click", () => activateTab("ccu"));
    tabUsage.addEventListener("click", () => activateTab("usage"));
    activateTab("ccu");
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

  // --- 既存リポジトリ利用チェック ---
  useExistingBtn.addEventListener("click", async () => {
    const repo = repoInput.value.trim();
    if (!repo) return alert("リポジトリ名を入力してください");

    initStatus.textContent = "リポジトリを確認中…";

    try {
      const res = await fetch("/api/check-repo", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken(),
        },
        body: JSON.stringify({ owner: ownerName, repo }),
      });
      const result = await res.json();
      if (result.ok) {
        initStatus.innerHTML = `<div class="alert alert-success">既存リポジトリを使用します</div>`;
        updateViewBtn();
      } else {
        initStatus.innerHTML = `<div class="alert alert-danger">エラー: ${result.error}</div>`;
      }
    } catch (err) {
      console.error(err);
      initStatus.innerHTML = `<div class="alert alert-danger">通信エラーが発生しました</div>`;
    }
  });

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
        initStatus.innerHTML = `<div class="alert alert-success">リポジトリ作成が完了しました！　こちら<a href="https://github.com/yoshikawa04/terst/settings" target="_blank" rel="noopener noreferrer">https://github.com/yoshikawa04/terst/settings</a>からPage設定を行ってください！</div>`;
        updateViewBtn();
      } else {
        initStatus.innerHTML = `<div class="alert alert-danger">エラー: ${result.error}</div>`;
      }
    } catch (err) {
      console.error(err);
      initStatus.innerHTML = `<div class="alert alert-danger">通信エラーが発生しました</div>`;
    }
  });

  // --- GitHub へのコミット ---
  githubUploadBtn.addEventListener("click", async () => {
    const out = formattedOutput.textContent;
    const repo = repoInput.value.trim();
    const path = pathInput.value.trim();
    const linkText = linknameInput.value.trim();
    const scenarioName = filenameInput.value.trim();

    if (!out) return alert("まずは「修正」ボタンで整形してください");
    if (!ownerName || !repo || !path)
      return alert("リポジトリ情報をすべて入力してください");

    githubStatus.textContent = "送信中…";
    try {
      const formData = new FormData();
      formData.append(
        "htmlFile",
        new Blob([out], { type: "text/html" }),
        path.split("/").pop()
      );
      formData.append("owner", ownerName);
      formData.append("repo", repo);
      formData.append("path", path);
      formData.append("linkText", linkText);
      formData.append("scenarioName", scenarioName);

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": getCsrfToken() },
        body: formData,
      });
      const result = await res.json();
      if (result.ok) {
        githubStatus.innerHTML =
          '<div class="alert alert-success">GitHub へのコミットに成功しました！<br>反映まで5分ほどお待ち下さい！</div>';
      } else {
        githubStatus.innerHTML = `<div class="alert alert-danger">エラー: ${result.error}</div>`;
      }
    } catch (err) {
      console.error(err);
      githubStatus.innerHTML = '<div class="alert alert-danger">通信エラーが発生しました</div>';
    }
  });

  // --- HTML 整形 ---
  formatBtn.addEventListener("click", () => {
    if (!uploadHtml.files.length)
      return alert("整形したい HTML ファイルを選択してください");
    const reader = new FileReader();
    reader.onload = (e) => {
      let html = e.target.result;
      const robotsMeta = '<meta name="robots" content="noindex,nofollow">';
      const norobotScript = '<script src="norobot.js"></scr' + 'ipt>';
      html = html.replace(/<\/head>/i, robotsMeta + "\n" + norobotScript + "\n</head>");
      formattedOutput.textContent = html;
    };
    reader.readAsText(uploadHtml.files[0]);
  });
});
