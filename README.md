# ニュースまとめサイト (news-aggregator)

複数のRSSフィード(NHK、Yahoo!ニュース、ITmedia、The Guardian、BBCなど)を10分おきにまとめて取得し、
1つのページに一覧表示するシンプルなNode.js(Express)製Webアプリです。

## 機能

- 📖 記事をページ内で読める簡易リーダー(タイトルをクリック。外部サイトへ遷移しません)
- 🔍 キーワード検索(タイトル・要約から絞り込み)
- 🏷️ ニュースソース別の絞り込みタブ
- 🌙 ダークモード切り替え(ブラウザに設定を記憶。初回はOSの設定に追従)
- ⭐ お気に入り登録(ブラウザのlocalStorageに保存。「お気に入り」ボタンで絞り込み表示も可能)
- 🔄 手動更新ボタン+5分ごとの自動更新(ページ再読み込みなしで反映)

### 記事リーダーについて

記事タイトルをクリックすると、サーバー側で該当ページを取得し、本文を抽出してモーダル(ポップアップ)内に表示します。
- 配信元サイトの構造やブロック設定によっては本文を抽出できない場合があります。その場合は自動的に「元のページを開く」リンクを表示します。
- 長文の場合は冒頭約2000文字のみを表示し、続きは元サイトでの閲覧を案内します(著作権への配慮のため)。
- 取得できるのは `server.js` の `ALLOWED_ARTICLE_HOST_SUFFIXES` に含まれるドメイン(フィード配信元)のみです(不正利用防止)。
- 個人利用を想定した簡易機能です。公開して広く使う場合は、配信元サイトの利用規約・robots.txtを確認してください。

## 構成

```
news-aggregator/
├── server.js       # Expressサーバー本体(RSS取得・HTML生成)
├── package.json
├── render.yaml      # Renderへのデプロイ設定
└── .gitignore
```

## ローカルでの動作確認

```bash
npm install
npm start
# http://localhost:3000 を開く
```

## フィードの追加・変更

`server.js` 内の `FEEDS` 配列を編集してください。

```js
const FEEDS = [
  { name: "表示名", url: "RSSのURL" },
  // ...
];
```

## GitHubへのプッシュ手順

このプロジェクトはローカルに用意してあります。以下の手順でご自身のGitHubリポジトリにプッシュしてください。

1. GitHubで新しい空のリポジトリを作成する(READMEなどは追加しない)
2. ダウンロードしたこのフォルダで以下を実行:

```bash
cd news-aggregator
git init
git add .
git commit -m "Initial commit: news aggregator app"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/<リポジトリ名>.git
git push -u origin main
```

## Renderへのデプロイ手順

1. [Render](https://render.com) にログインし、「New +」→「Web Service」を選択
2. 先ほどプッシュしたGitHubリポジトリを選択
3. 以下の設定を確認(`render.yaml` があれば自動で読み込まれます)
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node`
4. 「Create Web Service」をクリックするとデプロイが始まります
5. 数分後、`https://<サービス名>.onrender.com` でアクセスできるようになります

## 注意事項

- 無料プランのRenderは一定時間アクセスがないとスリープします(初回アクセス時に少し時間がかかります)
- RSSフィードのURLは配信元の都合で変更・停止される場合があります
- 各記事の著作権は配信元に帰属します。本サイトは見出しと要約のみを表示し、本文はリンク先で閲覧する構成です
