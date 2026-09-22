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
  { name: "The Guardian World", url: "https://www.theguardian.com/world/rss" },
  { name: "BBC News", url: "http://feeds.bbci.co.uk/news/rss.xml" },
];

// 簡易キャッシュ(毎回全フィードに取りに行かないように)
let cache = { updatedAt: null, items: [], failed: [] };
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

async function getNews(force = false) {
  const now = Date.now();
  if (!force && cache.updatedAt && now - cache.updatedAt < CACHE_TTL_MS) {
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SOURCE_NAMES = FEEDS.map((f) => f.name);

function renderPage({ items, failed, updatedAt }) {
  const failedNotice = failed && failed.length
    ? `<p class="notice">取得に失敗したフィード: ${escapeHtml(failed.join(", "))}</p>`
    : "";

  const sourceChips = SOURCE_NAMES
    .map((name) => `<button class="chip" data-source="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
    .join("");

  // クライアント側で使うため、記事データをそのままJSONとして埋め込む
  const itemsJson = JSON.stringify(items).replace(/</g, "\\u003c");

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
    --chip-bg: #ffffff;
  }
  html[data-theme="dark"] {
    --bg: #121214;
    --card-bg: #1c1c1f;
    --text: #f2f2f2;
    --muted: #9a9a9e;
    --accent: #5b9dff;
    --border: #2e2e32;
    --chip-bg: #1c1c1f;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
    background: var(--bg);
    color: var(--text);
    transition: background 0.2s, color 0.2s;
  }
  header {
    background: var(--card-bg);
    border-bottom: 1px solid var(--border);
    padding: 18px 20px;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .header-top {
    max-width: 900px;
    margin: 0 auto 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .header-top-titles { text-align: left; }
  header h1 { margin: 0 0 2px; font-size: 1.4rem; }
  header p#updated-at { margin: 0; color: var(--muted); font-size: 0.78rem; }
  .header-buttons { display: flex; gap: 8px; flex-shrink: 0; }
  .icon-btn {
    border: 1px solid var(--border);
    background: var(--chip-bg);
    color: var(--text);
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 0.85rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .icon-btn:hover { border-color: var(--accent); }
  .icon-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .controls { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
  #search {
    width: 100%;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--card-bg);
    color: var(--text);
    font-size: 0.9rem;
  }
  #search:focus { outline: none; border-color: var(--accent); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    border: 1px solid var(--border);
    background: var(--chip-bg);
    color: var(--muted);
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
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
    position: relative;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
  }
  .card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .source {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--accent);
    background: rgba(91,157,255,0.12);
    padding: 2px 8px;
    border-radius: 999px;
    margin-bottom: 8px;
  }
  .bookmark-btn {
    border: none;
    background: none;
    font-size: 1.1rem;
    cursor: pointer;
    color: var(--muted);
    line-height: 1;
    padding: 0 0 8px;
  }
  .bookmark-btn.active { color: #f5a623; }
  .card h2 { margin: 0 0 8px; font-size: 1.02rem; line-height: 1.4; }
  .card h2 a { color: var(--text); text-decoration: none; }
  .card h2 a:hover { color: var(--accent); }
  .card p { margin: 0 0 8px; font-size: 0.85rem; color: var(--muted); }
  .card time { font-size: 0.75rem; color: var(--muted); }
  .notice {
    max-width: 900px;
    margin: 10px auto 0;
    padding: 0 20px;
    color: #b45309;
    font-size: 0.8rem;
  }
  .empty { padding: 0 18px; color: var(--muted); }
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
    <div class="header-top">
      <div class="header-top-titles">
        <h1>ニュースまとめ</h1>
        <p id="updated-at">最終更新: ${updatedAt ? new Date(updatedAt).toLocaleString("ja-JP") : "-"}</p>
      </div>
      <div class="header-buttons">
        <button id="refresh-btn" class="icon-btn" title="今すぐ更新">🔄 更新</button>
        <button id="bookmark-filter-btn" class="icon-btn" title="お気に入りのみ表示">⭐ お気に入り</button>
        <button id="theme-btn" class="icon-btn" title="ダークモード切り替え">🌙</button>
      </div>
    </div>
    <div class="controls">
      <input id="search" type="text" placeholder="キーワードで検索(タイトル・要約)" autocomplete="off" />
      <div class="chips" id="source-chips">
        <button class="chip active" data-source="__all__">すべて</button>
        ${sourceChips}
      </div>
    </div>
  </header>
  ${failedNotice}
  <main id="news-list"></main>
  <footer>複数のRSSフィードから自動収集しています。各記事の著作権は配信元に帰属します。</footer>

<script>
(function () {
  var STORAGE_BOOKMARKS = "news-aggregator:bookmarks";
  var STORAGE_THEME = "news-aggregator:theme";

  var state = {
    items: ${itemsJson},
    query: "",
    activeSource: "__all__",
    bookmarksOnly: false,
    bookmarks: loadBookmarks(),
  };

  function loadBookmarks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_BOOKMARKS) || "[]");
    } catch (e) {
      return [];
    }
  }
  function saveBookmarks() {
    localStorage.setItem(STORAGE_BOOKMARKS, JSON.stringify(state.bookmarks));
  }
  function isBookmarked(link) {
    return state.bookmarks.indexOf(link) !== -1;
  }
  function toggleBookmark(link) {
    var idx = state.bookmarks.indexOf(link);
    if (idx === -1) state.bookmarks.push(link);
    else state.bookmarks.splice(idx, 1);
    saveBookmarks();
    render();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var btn = document.getElementById("theme-btn");
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  function render() {
    var q = state.query.trim().toLowerCase();
    var filtered = state.items.filter(function (item) {
      if (state.activeSource !== "__all__" && item.source !== state.activeSource) return false;
      if (state.bookmarksOnly && !isBookmarked(item.link)) return false;
      if (q) {
        var haystack = (item.title + " " + (item.contentSnippet || "")).toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      return true;
    });

    var list = document.getElementById("news-list");
    if (filtered.length === 0) {
      list.innerHTML = "<p class='empty'>条件に一致する記事がありません。</p>";
      return;
    }

    list.innerHTML = filtered
      .map(function (item) {
        var bookmarked = isBookmarked(item.link);
        var dateStr = item.pubDate ? new Date(item.pubDate).toLocaleString("ja-JP") : "";
        return (
          "<article class='card'>" +
          "<div class='card-top'>" +
          "<span class='source'>" + escapeHtml(item.source) + "</span>" +
          "<button class='bookmark-btn" + (bookmarked ? " active" : "") + "' data-link='" + escapeHtml(item.link) + "' title='お気に入り登録'>" +
          (bookmarked ? "★" : "☆") +
          "</button>" +
          "</div>" +
          "<h2><a href='" + escapeHtml(item.link) + "' target='_blank' rel='noopener noreferrer'>" + escapeHtml(item.title) + "</a></h2>" +
          (item.contentSnippet ? "<p>" + escapeHtml(item.contentSnippet) + "...</p>" : "") +
          "<time>" + dateStr + "</time>" +
          "</article>"
        );
      })
      .join("");

    Array.prototype.forEach.call(list.querySelectorAll(".bookmark-btn"), function (btn) {
      btn.addEventListener("click", function () {
        toggleBookmark(btn.getAttribute("data-link"));
      });
    });
  }

  async function refresh(force) {
    var refreshBtn = document.getElementById("refresh-btn");
    refreshBtn.disabled = true;
    refreshBtn.textContent = "🔄 更新中...";
    try {
      var res = await fetch("/api/news" + (force ? "?force=1" : ""));
      var data = await res.json();
      state.items = data.items || [];
      document.getElementById("updated-at").textContent =
        "最終更新: " + (data.updatedAt ? new Date(data.updatedAt).toLocaleString("ja-JP") : "-");
      render();
    } catch (e) {
      // 取得失敗時は現在の表示を維持
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "🔄 更新";
    }
  }

  // 検索
  document.getElementById("search").addEventListener("input", function (e) {
    state.query = e.target.value;
    render();
  });

  // ソースフィルタ
  document.getElementById("source-chips").addEventListener("click", function (e) {
    var btn = e.target.closest(".chip");
    if (!btn) return;
    state.activeSource = btn.getAttribute("data-source");
    Array.prototype.forEach.call(document.querySelectorAll("#source-chips .chip"), function (c) {
      c.classList.toggle("active", c === btn);
    });
    render();
  });

  // お気に入りのみ表示
  document.getElementById("bookmark-filter-btn").addEventListener("click", function () {
    state.bookmarksOnly = !state.bookmarksOnly;
    this.classList.toggle("active", state.bookmarksOnly);
    render();
  });

  // ダークモード
  document.getElementById("theme-btn").addEventListener("click", function () {
    var current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    var next = current === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_THEME, next);
    applyTheme(next);
  });

  // 手動更新
  document.getElementById("refresh-btn").addEventListener("click", function () {
    refresh(true);
  });

  // 初期テーマ適用(OS設定 or 保存済み設定)
  var savedTheme = localStorage.getItem(STORAGE_THEME);
  if (!savedTheme) {
    savedTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  applyTheme(savedTheme);

  render();

  // 5分ごとに自動更新(ページ再読み込みなし)
  setInterval(function () { refresh(false); }, 5 * 60 * 1000);
})();
</script>
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

// JSON APIとしても取得できるようにしておく。?force=1 でキャッシュを無視して再取得。
app.get("/api/news", async (req, res) => {
  try {
    const force = req.query.force === "1";
    const data = await getNews(force);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "failed to fetch news" });
  }
});

app.listen(PORT, () => {
  console.log(`News aggregator listening on port ${PORT}`);
});
