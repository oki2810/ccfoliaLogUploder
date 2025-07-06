document.addEventListener("DOMContentLoaded", () => {
  // CSRF トークン取得
  function getCsrfToken() {
    const match = document.cookie.match(/(?:^| )XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  // --- 要素参照 ---
  const githubConnectBtn = document.getElementById("githubConnectBtn");
  const authSection      = document.getElementById("authSection");
  const repoSettings     = document.getElementById("repoSettings");
  const ownerInput       = document.getElementById("ownerInput");
  const repoInput        = document.getElementById("repoInput");
  const viewProjectBtn   = document.getElementById("viewProjectBtn");
  const githubUploadBtn  = document.getElementById("githubUploadBtn");
  const githubStatus     = document.getElementById("githubStatus");

  const uploadHtml       = document.getElementById("uploadHtml");
  const formatBtn        = document.getElementById("formatBtn");
  const downloadBtn      = document.getElementById("downloadBtn");
  const filenameInput    = document.getElementById("filenameInput");
  const linknameInput    = document.getElementById("linknameInput");
  const formattedOutput  = document.getElementById("formattedOutput");
  const listContainer    = document.getElementById("generatedList");

  // --- 1) OAuth開始 ---
  githubConnectBtn.addEventListener("click", () => {
    window.location.href = "/auth/github";
  });

  // 認証状態チェック
  fetch("/api/auth/status", {
    credentials: "include",
    headers: { "X-CSRF-Token": getCsrfToken() }
  })
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) {
        authSection.style.display = "none";
        repoSettings.style.display = "block";
        updateViewBtn();
      }
    })
    .catch(err => console.error("Auth status error:", err));

  // --- 2) プロジェクト公開ページへのリンク 更新 ---
  function updateViewBtn() {
    const owner = ownerInput.value.trim();
    const repo  = repoInput.value.trim();
    if (owner && repo) {
      viewProjectBtn.onclick = () =>
        window.open(`https://${owner}.github.io/${repo}/`, "_blank");
      viewProjectBtn.style.display = "inline-block";
    } else {
      viewProjectBtn.style.display = "none";
    }
  }
  ownerInput.addEventListener("input", updateViewBtn);
  repoInput.addEventListener("input", updateViewBtn);

  // --- 3) GitHub へのコミット + index.html 更新 ---
  githubUploadBtn.addEventListener("click", async () => {
    const out      = formattedOutput.textContent;
    const owner    = ownerInput.value.trim();
    const repo     = repoInput.value.trim();
    const path     = document.getElementById("pathInput").value.trim();
    const linkText = linknameInput.value.trim();

    if (!out)    return alert("まずは「修正」ボタンで整形してください");
    if (!owner || !repo || !path)
                 return alert("リポジトリ情報をすべて入力してください");

    githubStatus.textContent = "送信中…";
    try {
      const formData = new FormData();
      formData.append("htmlFile", new Blob([out], { type: "text/html" }), path.split("/").pop());
      formData.append("owner", owner);
      formData.append("repo", repo);
      formData.append("path", path);
      formData.append("linkText", linkText);

      const res = await fetch("/api/user/upload", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": getCsrfToken() },
        body: formData
      });
      const result = await res.json();
      if (result.ok) {
        githubStatus.innerHTML =
          '<div class="alert alert-success">コミットに成功しました！</div>';
      } else {
        githubStatus.innerHTML =
          `<div class="alert alert-danger">エラー: ${result.error}</div>`;
      }
    } catch (err) {
      console.error(err);
      githubStatus.innerHTML =
        '<div class="alert alert-danger">通信エラーが発生しました</div>';
    }
  });

  // --- 4) HTML 整形・ローカル保存 ---
  formatBtn.addEventListener("click", () => {
    if (!uploadHtml.files.length)
      return alert("整形したい HTML ファイルを選択してください");
    const reader = new FileReader();
    reader.onload = e => {
      let html = e.target.result;
      const robotsMeta    = '<meta name="robots" content="noindex,nofollow">';
      const norobotScript = '<script src="norobot.js"></scr' + 'ipt>';
      html = html.replace(/<\/head>/i, robotsMeta + "\n" + norobotScript + "\n</head>");
      formattedOutput.textContent = html;
    };
    reader.readAsText(uploadHtml.files[0]);
  });

  downloadBtn.addEventListener("click", () => {
    const out      = formattedOutput.textContent;
    const filename = filenameInput.value.trim() || "test.html";
    const linkname = linknameInput.value.trim()  || filename;
    if (!out) return alert("まずは「修正」ボタンで整形してください");

    const blob = new Blob([out], { type: "text/html" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);

    const files = JSON.parse(localStorage.getItem("generatedFiles") || "[]");
    const entry = { filename, linkname };
    if (!files.some(f => f.filename === filename)) {
      files.push(entry);
      localStorage.setItem("generatedFiles", JSON.stringify(files));
      appendToGeneratedList(entry);
    }
  });

  // --- 5) 作成済み一覧 初期表示 ---
  if (listContainer) {
    const files = JSON.parse(localStorage.getItem("generatedFiles") || "[]");
    if (!files.length) {
      const li = document.createElement("li");
      li.className = "list-group-item";
      li.textContent = "まだファイルが生成されていません。";
      listContainer.appendChild(li);
    } else {
      files.forEach(appendToGeneratedList);
    }
  }

  function appendToGeneratedList({ filename, linkname }) {
    const li = document.createElement("li");
    li.className = "list-group-item";
    const a  = document.createElement("a");
    a.href        = filename;
    a.textContent = linkname || filename;
    a.target      = "_blank";
    li.appendChild(a);
    listContainer.appendChild(li);
  }
});
