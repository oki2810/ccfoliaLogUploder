import crypto from "crypto";
import { Octokit } from "@octokit/rest";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const sig = req.headers["x-hub-signature-256"] || "";
  const hmac = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET);
  hmac.update(req.body);
  const expected = `sha256=${hmac.digest("hex")}`;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).end("Invalid signature");
  }

  const event = req.headers["x-github-event"];
  if (event === "push") {
    const payload = JSON.parse(req.body.toString());
    // 必要なら logs/以下への追加を検出して index.html を再生成
    // （upload.js と同様のロジックをここに入れられます）
  }

  res.status(200).end("OK");
}
