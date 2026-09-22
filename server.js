const express = require("express");
const Parser = require("rss-parser");

const app = express();
const parser = new Parser({
  timeout: 8000,
  headers: { "User-Agent": "Mozilla/5.0 (news-aggregator bot)" },
});

const PORT = process.env.PORT || 3000;

// 集約するRSSフィード一覧。必要に応じて自由に追加・削除してください。
const FEEDS = [
  { name: "NHKニュース", url: "https://www3.nhk.or.jp/rss/news/cat0.xml" },
  { name: "Yahoo!ニュース 主要", url: "https://news.yahoo.co.jp/rss/topics/top-picks.xml" },
  { name: "ITmedia News", url: "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml" },
  { name: "Reuters World", url: "http://feeds.reuters.com/Reuters/worldNews" },
  { name: "BBC News", url: "http://feeds.bbci.co.uk/news/rss.xml" },
];

// 簡易キャッシュ(毎回全フィードに取りに行かないように)
let cache = { updatedAt: null, items: [] };
const CACHE_TTL_MS = 10 * 60 * 1000; // 10分

async function fetchAllFeeds() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items || []).slice(0, 10).map((item) => ({
        source: feed.name,
        title: item.title || "(タイトルなし)",
        link: item.link || "#",
        pubDate: item.pubDate || item.isoDate || "",
        contentSnippet: (item.contentSnippet || "").slice(0, 140),
      }));
    })
  );

  const items = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const failed = results
    .map((r, i) => (r.status === "rejected" ? FEEDS[i].name : null))
    .filter(Boolean);

  return { items, failed };
}

async function getNews() {
  const now = Date.now();
  if (cache.updatedAt && now - cache.updatedAt < CACHE_TTL_MS) {
    return cache;
  }
  const { items, failed } = await fetchAllFeeds();
  cache = { updatedAt: now, items, failed };
  return cache;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPage({ items, failed, updatedAt }) {
  const cards = items
    .map(
      (item) => `
        <article class="card">
          <span class="source">${escapeHtml(item.source)}</span>
          <h2><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        item.title
      )}</a></h2>
          ${item.contentSnippet ? `<p>${escapeHtml(item.contentSnippet)}...</p>` : ""}
          <time>${item.pubDate ? new Date(item.pubDate).toLocaleString("ja-JP") : ""}</time>
        </article>`
    )
    .join("");

  const failedNotice = failed && failed.length
    ? `<p class="notice">取得に失敗したフィード: ${escapeHtml(failed.join(", "))}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>ニュースまとめ</title>
<style>
  :root {
    --bg: #f5f5f7;
    --card-bg: #ffffff;
    --text: #1d1d1f;
    --muted: #6e6e73;
    --accent: #0066cc;
    --border: #e5e5e7;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
    background: var(--bg);
    color: var(--text);
  }
  header {
    background: var(--card-bg);
    border-bottom: 1px solid var(--border);
    padding: 24px 20px;
    text-align: center;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  header h1 { margin: 0 0 4px; font-size: 1.6rem; }
  header p { margin: 0; color: var(--muted); font-size: 0.85rem; }
  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }
  @media (min-width: 640px) {
    main { grid-template-columns: 1fr 1fr; }
  }
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
  }
  .source {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--accent);
    background: rgba(0,102,204,0.08);
    padding: 2px 8px;
    border-radius: 999px;
    margin-bottom: 8px;
  }
  .card h2 { margin: 0 0 8px; font-size: 1.02rem; line-height: 1.4; }
  .card h2 a { color: var(--text); text-decoration: none; }
  .card h2 a:hover { color: var(--accent); }
  .card p { margin: 0 0 8px; font-size: 0.85rem; color: var(--muted); }
  .card time { font-size: 0.75rem; color: var(--muted); }
  .notice {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 20px;
    color: #b45309;
    font-size: 0.8rem;
  }
  footer {
    text-align: center;
    padding: 24px;
    color: var(--muted);
    font-size: 0.75rem;
  }
</style>
</head>
<body>
  <header>
    <h1>ニュースまとめ</h1>
    <p>最終更新: ${updatedAt ? new Date(updatedAt).toLocaleString("ja-JP") : "-"}(10分ごとに自動更新)</p>
  </header>
  ${failedNotice}
  <main>
    ${cards || "<p style='padding:0 18px;color:var(--muted);'>現在取得できる記事がありません。</p>"}
  </main>
  <footer>複数のRSSフィードから自動収集しています。各記事の著作権は配信元に帰属します。</footer>
</body>
</html>`;
}

app.get("/", async (req, res) => {
  try {
    const { items, failed, updatedAt } = await getNews();
    res.send(renderPage({ items, failed, updatedAt }));
  } catch (err) {
    res.status(500).send("ニュースの取得中にエラーが発生しました。");
  }
});

// ヘルスチェック用(Renderのヘルスチェックに利用可能)
app.get("/health", (req, res) => res.status(200).send("ok"));

// JSON APIとしても取得できるようにしておく
app.get("/api/news", async (req, res) => {
  try {
    const data = await getNews();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "failed to fetch news" });
  }
});

app.listen(PORT, () => {
  console.log(`News aggregator listening on port ${PORT}`);
});
