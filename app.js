// app.js: TRPGログ整形ツールの振る舞い
// norobot メタタグとスクリプトを挿入し、整形・コピー・ダウンロード、list.html生成を扱う

document.addEventListener("DOMContentLoaded", () => {
  // --- パーツ1：HTML整形・コピー・ダウンロード ---
  document.getElementById("formatBtn").addEventListener("click", () => {
    const fileInput = document.getElementById("uploadHtml");
    if (!fileInput.files.length) return alert("ファイルを選択してください");
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

  document.getElementById("copyFormattedBtn").addEventListener("click", () => {
    const out = document.getElementById("formattedOutput").textContent;
    navigator.clipboard.writeText(out);
    alert("コピーしました");
  });

  document.getElementById("downloadBtn").addEventListener("click", () => {
    const out = document.getElementById("formattedOutput").textContent;
    const filename =
      document.getElementById("filenameInput").value || "test.html";
    const blob = new Blob([out], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    // localStorage に保存＆リスト更新
    const files = JSON.parse(localStorage.getItem("generatedFiles") || "[]");
    if (!files.includes(filename)) {
      files.push(filename);
      localStorage.setItem("generatedFiles", JSON.stringify(files));
      appendToGeneratedList(filename);
    }
  });

  // --- パーツ2：list.html 生成・コピー・ダウンロード ---
  const formatListBtn = document.getElementById("formatListBtn");
  const copyListBtn = document.getElementById("copyListBtn");
  const downloadListBtn = document.getElementById("downloadListBtn");
  const listPre = document.getElementById("listOutput");

  formatListBtn.addEventListener("click", () => {
    const files = JSON.parse(localStorage.getItem("generatedFiles") || "[]");
    let html = `<!DOCTYPE html>
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>目次 - TRPGログ整形サイト</title>
      <!-- Bootstrap CSS -->
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
      <!-- norobot スクリプト -->
      <script src="norobot.js"></script>
    </head>
    <body>
      <div class="container py-5">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h1 class="mb-0">目次</h1>
          <a href="index.html" class="btn btn-outline-secondary">トップへ戻る</a>
        </div>
        <ul class="list-group">
  `;
    if (files.length === 0) {
      html += `        <li class="list-group-item">まだファイルが生成されていません。</li>\n`;
    } else {
      files.forEach((f) => {
        html += `        <li class="list-group-item"><a href="${f}">${f}</a></li>\n`;
      });
    }
    html += `      </ul>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    </body>
  </html>`;
    listPre.textContent = html;
  });

  copyListBtn.addEventListener("click", () => {
    const txt = listPre.textContent;
    navigator.clipboard.writeText(txt);
    alert("コピーしました");
  });

  downloadListBtn.addEventListener("click", () => {
    const txt = listPre.textContent;
    const blob = new Blob([txt], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "list.html";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // --- パーツ3：作成済みファイル一覧表示 ---
  const listContainer = document.getElementById("generatedList");
  if (listContainer) {
    const files = JSON.parse(localStorage.getItem("generatedFiles") || "[]");
    if (files.length === 0) {
      const li = document.createElement("li");
      li.className = "list-group-item";
      li.textContent = "まだファイルが生成されていません。";
      listContainer.appendChild(li);
    } else {
      files.forEach((f) => appendToGeneratedList(f));
    }
  }

  // --- 共通関数：リストに要素追加 ---
  function appendToGeneratedList(filename) {
    const container = document.getElementById("generatedList");
    if (!container) return;
    // 「まだ…」表示をクリア
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
    a.textContent = filename;
    li.appendChild(a);
    container.appendChild(li);
  }
});
