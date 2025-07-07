// app.js
document.addEventListener("DOMContentLoaded", () => {
  // CSRF トークン取得
  function getCsrfToken() {
    const match = document.cookie.match(/(?:^| )XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  // --- 要素取得 ---
  const githubConnectBtn = document.getElementById("githubConnectBtn");
  const authSection      = document.getElementById("authSection");
  const repoSettings     = document.getElementById("repoSettings");
  const loginInfo        = document.getElementById("loginInfo");
  const ownerInput       = document.getElementById("ownerInput");
  const repoInput        = document.getElementById("repoInput");
  const pathInput        = document.getElementById("pathInput");
  const viewProjectBtn   = document.getElementById("viewProjectBtn");
  const githubUploadBtn  = document.getElementById("githubUploadBtn");
  const githubStatus     = document.getElementById("githubStatus");
  const githubDisconnectBtn = document.getElementById("githubDisconnectBtn");

  const uploadHtml       = document.getElementById("uploadHtml");
  const formatBtn        = document.getElementById("formatBtn");
  const linknameInput    = document.getElementById("linknameInput");
  const formattedOutput  = document.getElementById("formattedOutput");

  // リンク名入力に合わせてコミットパスを更新
  const syncPath = () => {
    // 半角英数字以外は除去
    const name = linknameInput.value.trim() || "test";
    pathInput.value = `log/${name}.html`;
  };
  linknameInput.addEventListener("input", syncPath);
  syncPath();

  // --- GitHub OAuth 開始 ---
  githubConnectBtn.addEventListener("click", () => {
    window.location.href = "/api/auth/github";
  });

  githubDisconnectBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": getCsrfToken() }
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      window.location.reload();
    }
  });

  // 認証状態チェック
  fetch("/api/auth-status", {
    credentials: "include",
    headers: { "X-CSRF-Token": getCsrfToken() }
  })
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) {
        authSection.style.display = "none";
        repoSettings.style.display = "block";
        if (loginInfo) {
          loginInfo.textContent = data.username
            ? `GitHub連携中: ${data.username}`
            : "GitHub連携中";
          loginInfo.style.display = "block";
        }
        githubDisconnectBtn.style.display = "inline-block";
        updateViewBtn();
      } else {
        authSection.style.display = "block";
        repoSettings.style.display = "none";
        if (loginInfo) loginInfo.style.display = "none";
        githubDisconnectBtn.style.display = "none";
      }
    })
    .catch(err => console.error("Auth status error:", err));

  // プロジェクト公開ページリンク更新
  function updateViewBtn() {
    const owner = ownerInput.value.trim();
    const repo  = repoInput.value.trim();
    if (owner && repo) {
      const url = `https://${owner}.github.io/${repo}/`;
      viewProjectBtn.onclick = () => window.open(url, "_blank");
      viewProjectBtn.style.display = "inline-block";
    } else {
      viewProjectBtn.style.display = "none";
    }
  }
  ownerInput.addEventListener("input", updateViewBtn);
  repoInput.addEventListener("input", updateViewBtn);

  // --- GitHub へのコミット ---
  githubUploadBtn.addEventListener("click", async () => {
    const out   = formattedOutput.textContent;
    const owner = ownerInput.value.trim();
    const repo  = repoInput.value.trim();
    const path  = pathInput.value.trim();
    const linkText = linknameInput.value.trim();

    if (!out) return alert("まずは「修正」ボタンで整形してください");
    if (!owner || !repo || !path) return alert("リポジトリ情報をすべて入力してください");

    githubStatus.textContent = "送信中…";
    try {
      const formData = new FormData();
      formData.append("htmlFile", new Blob([out], { type: "text/html" }), path.split("/").pop());
      formData.append("owner", owner);
      formData.append("repo", repo);
      formData.append("path", path);
      formData.append("linkText", linkText);

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": getCsrfToken() },
        body: formData,
      });
      const result = await res.json();
      if (result.ok) {
        githubStatus.innerHTML = '<div class="alert alert-success">GitHub へのコミットに成功しました！</div>';
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
    if (!uploadHtml.files.length) return alert("整形したい HTML ファイルを選択してください");
    const reader = new FileReader();
    reader.onload = e => {
      let html = e.target.result;
      const robotsMeta   = '<meta name="robots" content="noindex,nofollow">';
      const norobotScript = '<script src="norobot.js"></scr' + 'ipt>';
      html = html.replace(/<\/head>/i, robotsMeta + "\n" + norobotScript + "\n</head>");
      formattedOutput.textContent = html;
    };
    reader.readAsText(uploadHtml.files[0]);
  });


});
