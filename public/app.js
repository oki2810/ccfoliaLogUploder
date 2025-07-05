document.addEventListener("DOMContentLoaded", () => {
  // CSRF トークン取得
  function getCsrfToken() {
    const match = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  }

  // --- GitHub OAuth / コミット機能 ---
  const githubConnectBtn = document.getElementById("githubConnectBtn");
  const authSection = document.getElementById("authSection");
  const repoSettings = document.getElementById("repoSettings");
  const githubUploadBtn = document.getElementById("githubUploadBtn");
  const githubStatus = document.getElementById("githubStatus");

  // OAuth 認証開始
  githubConnectBtn.addEventListener("click", () => {
    window.location.href = "/auth/github";
  });

  // 認証状態チェック
  fetch("/api/auth/status", {
    credentials: 'include',
    headers: { 'X-CSRF-Token': getCsrfToken() }
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.authenticated) {
        authSection.style.display = "none";
        repoSettings.style.display = "block";
      } else {
        authSection.style.display = "block";
        repoSettings.style.display = "none";
      }
    })
    .catch((err) => {
      console.error("Auth status error:", err);
    });

  // GitHub へコミット
  githubUploadBtn.addEventListener("click", async () => {
    const out = document.getElementById("formattedOutput").textContent;
    const owner = document.getElementById("ownerInput").value.trim();
    const repo = document.getElementById("repoInput").value.trim();
    const path = document.getElementById("pathInput").value.trim();

    if (!out) return alert("まずは「修正」ボタンで整形してください");
    if (!owner || !repo || !path) {
      return alert("リポジトリ情報をすべて入力してください");
    }

    githubStatus.textContent = "送信中...";
    try {
      const formData = new FormData();
      const blob = new Blob([out], { type: "text/html" });
      formData.append("htmlFile", blob, path.split("/").pop());
      formData.append("owner", owner);
      formData.append("repo", repo);
      formData.append("path", path);

      const res = await fetch("/api/user/upload", {
        method: "POST",
        credentials: 'include',
        headers: { 'X-CSRF-Token': getCsrfToken() },
        body: formData,
      });
      const result = await res.json();
      if (result.ok) {
        githubStatus.innerHTML =
          '<div class="alert alert-success">GitHub へのコミットに成功しました！</div>';
      } else {
        githubStatus.innerHTML = `<div class="alert alert-danger">エラー: ${result.error}</div>`;
      }
    } catch (error) {
      console.error(error);
      githubStatus.innerHTML =
        '<div class="alert alert-danger">通信エラーが発生しました</div>';
    }
  });

  // --- HTML 整形・ローカル保存機能 ---
  const formatBtn = document.getElementById("formatBtn");
  const downloadBtn = document.getElementById("downloadBtn");

  formatBtn.addEventListener("click", () => {
    const fileInput = document.getElementById("uploadHtml");
    if (!fileInput.files.length)
      return alert("整形したい HTML ファイルを選択してください");

    const reader = new FileReader();
    reader.onload = (e) => {
      let html = e.target.result;
      const robotsMeta = '<meta name="robots" content="noindex,nofollow">';
      const norobotScript = '<script src="norobot.js"></scr' + "ipt>";
      html = html.replace(
        /<\/head>/i,
        robotsMeta + "\n" + norobotScript + "\n</head>"
      );
      document.getElementById("formattedOutput").textContent = html;
    };
    reader.readAsText(fileInput.files[0]);
  });

  downloadBtn.addEventListener("click", () => {
    const out = document.getElementById("formattedOutput").textContent;
    const filename =
      document.getElementById("filenameInput").value.trim() || "test.html";
    const linkname =
      document.getElementById("linknameInput").value.trim() || filename;

    if (!out) return alert("まずは「修正」ボタンで整形してください");

    // Blob ダウンロード
    const blob = new Blob([out], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);

    // localStorage に記録
    const files = JSON.parse(
      localStorage.getItem("generatedFiles") || "[]"
    );
    const entry = { filename, linkname };
    if (!files.some((f) => f.filename === filename)) {
      files.push(entry);
      localStorage.setItem("generatedFiles", JSON.stringify(files));
      appendToGeneratedList(entry);
    }
  });

  // 作成済み一覧のレンダリング
  const listContainer = document.getElementById("generatedList");
  if (listContainer) {
    const files = JSON.parse(
      localStorage.getItem("generatedFiles") || "[]"
    );
    if (files.length === 0) {
      const li = document.createElement("li");
      li.className = "list-group-item";
      li.textContent = "まだファイルが生成されていません。";
      listContainer.appendChild(li);
    } else {
      files.forEach((f) => appendToGeneratedList(f));
    }
  }

  function appendToGeneratedList({ filename, linkname }) {
    const container = document.getElementById("generatedList");
    if (!container) return;
    if (
      container.children.length === 1 &&
      container.children[0].textContent.includes("まだ")
    ) {
      container.innerHTML = "";
    }
    const li = document.createElement("li");
    li.className = "list-group-item";
    const a = document.createElement("a");
    a.href = filename;
    a.textContent = linkname || filename;
    li.appendChild(a);
    container.appendChild(li);
  }
});
