# 📥 incoming/

メニュー素材を放り込む場所。`npm run import` で `data/menus.json` に自動取り込み。

## 📸 画像の置き方

### 基本ルール

```
incoming/images/
├── <カテゴリID>/         # data/menus.json の categories[].id と一致
│   └── <メニュー名>.jpg  # 拡張子: .jpg .jpeg .png .webp .avif
└── _uncategorized/       # カテゴリ不明なものはここに
```

### 例

```
incoming/images/
├── today/                          # 「本日のおすすめ」カテゴリ
│   ├── 金目鯛の煮付け.jpg          # ← 既存アイテムに画像が紐付く
│   └── 新春お刺身__1980.jpg        # ← 既存にないので新規ドラフトとして追加。__1980 が価格
├── sashimi/
│   └── 大トロ__2480.jpg
└── _uncategorized/
    └── なんか美味しそうなやつ.jpg  # 「imported」カテゴリにドラフト追加
```

### ファイル名のルール

- `金目鯛の煮付け.jpg` → メニュー名が同じ既存アイテムを探して画像を設定
- `新メニュー__1980.jpg` → `__` の後は価格。既存になければドラフト追加（hidden:true）
- 拡張子は `.jpg / .jpeg / .png / .webp / .avif` に対応

## 📄 PDFの置き方

```
incoming/pdfs/
├── lunch.pdf      # ファイル名がそのままカテゴリ名になる
└── dinner.pdf
```

`npm run import` を実行すると、各PDFからテキストを抽出し、価格パターン（例：`金目鯛の煮付け　¥2,480`）を検出して `pdf-<filename>` というカテゴリにドラフト追加します（全部 `hidden: true`）。

### PDF抽出の限界

- **テキストレイヤーありのPDF** → うまく抽出できます
- **スキャンPDF（画像のみ）** → 抽出できません。`IMPORT_REPORT.md` で警告が出ます
  - 対処：別途OCR（macOSなら「プレビュー」→ テキスト選択 or `ocrmypdf`）でテキスト化してから再投入

## 🚀 取り込み実行

```bash
npm run import
```

出力：

- `data/menus.json` が更新される（差分は `git diff data/menus.json` で確認）
- `public/menu-images/<カテゴリ>/<file>` に画像がコピーされる
- `incoming/IMPORT_REPORT.md` に取り込み結果のレポート

## 📋 取り込み後の確認

新規ドラフトは全部 `hidden: true` で追加されます（つまり店頭表示には出ません）。

1. `npm run dev` → ローカルで表示確認（ドラフトは表示されない）
2. `data/menus.json` を開いて、新規追加されたアイテム（`_draft: true` 付き）を確認
3. 表示したいものは `hidden: true` を消す
4. メニュー名・価格・カテゴリを必要に応じて調整
5. `git add . && git commit -m "Add new menu items from incoming/" && git push`
6. PR作成 → Vercel Preview URLで店頭TVから最終確認 → mainマージ

## 🔁 再実行は安全

`npm run import` は冪等です。同じファイルが残っていても：
- 既存の同名アイテムには画像が再設定されるだけ（重複しない）
- PDFのドラフトは同名なら追加しない

クリーンにしたい時は `incoming/images/<cat>/` から手動で削除してください（`public/menu-images/` の方は `git checkout` で戻せます）。
