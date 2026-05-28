# 🍱 Restaurant Menu TV

Google TV のブラウザで常時表示する飲食店メニューボード。

- **自動スライドショー**：放置で全メニューを順に表示
- **JSON 一発編集**：`data/menus.json` を編集 → Pull Request → Vercel が自動で Preview URL を発行 → 店頭TVで確認 → main マージで本番反映
- **画像／カテゴリ／バッジ／価格** に対応
- **TV最適化**：1080p / 4K向けにvw単位レイアウト、画面焼け対策（サブピクセルドリフト）、カーソル非表示

---

## 🚀 セットアップ（初回のみ）

### 1. ローカル動作確認

```bash
npm install
npm run dev
# → http://localhost:3000
```

ブラウザを 1920x1080 に最大化、もしくは Chrome DevTools で TV解像度をエミュレートして確認。

### 2. Vercelにデプロイ

1. このリポジトリを GitHub に push（[GitHubに新規リポジトリ作成](https://github.com/new) → `git remote add origin ...` → `git push`）
2. [Vercel](https://vercel.com/new) に GitHub アカウントでログイン
3. このリポジトリを Import → そのまま Deploy（設定変更不要、`vercel.json` で全部済む）
4. 本番URLが `https://restaurant-menu-tv.vercel.app` のような形で発行される

### 3. Google TV にキオスク表示

1. Google TV のブラウザ（Chrome / TV Bro 等）を起動
2. 本番URLを開く
3. 全画面表示 → スクリーンセーバーをOFF / 画面の自動オフをOFF
4. （任意）TV Bro なら「キオスクモード」「起動時にURLを開く」設定が可能

---

## 📝 メニュー更新ワークフロー（PR運用）

メニューが増えても、誰でも安全に更新できるように Pull Request ベースで運用します。

### 通常の更新（メニュー追加・価格変更など）

```bash
# 1. ブランチを切る
git checkout -b menu/add-new-spring-items

# 2. data/menus.json を編集

# 3. ローカルで検証（必須）
npm run validate     # JSON 構文・スキーマチェック
npm run dev          # 表示確認

# 4. コミット → push
git add data/menus.json
git commit -m "Add spring seasonal items"
git push -u origin menu/add-new-spring-items

# 5. GitHub で Pull Request を作成
#    → Vercel が自動で Preview URL をコメントしてくれる
#    → そのURLをスマホ／TVで開いて見た目を確認
#    → 問題なければ main にマージ → 本番に自動デプロイ
```

### 複数メニューを並行編集（季節メニュー・期間限定など）

ブランチを別々に切れば、それぞれ独立した Preview URL が出るので比較もしやすい：

```
main                          ← 本番
├── menu/dinner-update        ← Preview URL A
├── menu/lunch-update         ← Preview URL B
└── menu/limited-may          ← Preview URL C
```

---

## 📐 `data/menus.json` のスキーマ

```jsonc
{
  "restaurant": {
    "name": "店名",
    "tagline": "副題（任意）",
    "currency": "¥"
  },
  "display": {
    "slideDurationMs": 7000,           // 1メニューあたりの表示時間
    "showCategoryIntro": true,         // カテゴリ見出しスライドを挟むか
    "categoryIntroDurationMs": 3500
  },
  "categories": [
    {
      "id": "today",                   // 一意のID（URL/keyに使用）
      "name": "本日のおすすめ",
      "nameEn": "Today's Special",     // 英語表記（任意）
      "accent": "#e8b14a",             // カテゴリのアクセントカラー
      "items": [
        {
          "id": "today-001",
          "name": "金目鯛の煮付け",
          "nameEn": "Golden Eye Snapper",
          "description": "脂ののった…",
          "price": 2480,
          "image": "https://...",      // 任意。Unsplash等のURL
          "badges": ["数量限定"],      // 任意。複数可
          "hidden": false              // true で一時的に非表示
        }
      ]
    }
  ]
}
```

### 画像について

- 外部URL（Unsplash 等）を使う場合は `next.config.ts` の `remotePatterns` に追加
- ローカル画像を使う場合は `public/images/` に置いて `"image": "/images/xxx.jpg"`
- 推奨サイズ：横 1600px 以上、横長アスペクト

### 一時的に隠したい

`"hidden": true` を付けると、データは残したまま表示から外せます（売切れ・季節外れ等）。

---

## 🛠️ スクリプト

| コマンド             | 内容                                 |
| -------------------- | ------------------------------------ |
| `npm run dev`        | 開発サーバー (http://localhost:3000) |
| `npm run build`      | 本番ビルド                           |
| `npm run start`      | ビルド成果物を起動                   |
| `npm run validate`   | menus.json のスキーマ検証            |

---

## ⚠️ よくあるトラブル

| 症状                               | 対処                                                         |
| ---------------------------------- | ------------------------------------------------------------ |
| 画像が出ない                       | `next.config.ts` の `remotePatterns` にホスト追加 → 再デプロイ |
| Vercel Preview が更新されない      | PR を空コミット (`git commit --allow-empty -m "redeploy"`) で push |
| Google TV で文字が小さい           | 全画面化されているか確認。vw単位なので解像度に追従する         |
| 焼き付きが心配                     | `burn-guard` でサブピクセルドリフト中。さらに `display.slideDurationMs` を短くしても可 |

---

## 🤖 Generated with

This project structure was bootstrapped with [Claude Code](https://claude.com/claude-code).
