# X-Layer

WEBサイトにカスタムCSSスタイルを注入できるChrome拡張機能です。サイドパネルでスタイルをリアルタイムで編集・確認でき、プリセットとして保存して特定のサイトに自動適用できます。

## 主な機能

- **リアルタイムCSSエディター**: サイドパネルでCSSを編集し、即座にページに反映
- **プリセット管理**: よく使うスタイルをプリセットとして保存
- **URL パターンマッチング**: プリセットごとに適用するサイトを指定（ワイルドカード対応）
- **自動適用**: ページ読み込み時に、URLにマッチするプリセットを自動適用

## セットアップ

### 1. 依存関係のインストール

```bash
cd /home/ubuntu/code/x-layer
npm install
```

### 2. ビルド

開発ビルド（ウォッチモード）:

```bash
npm run dev
```

本番ビルド:

```bash
npm run build
```

ビルド後、`dist` ディレクトリに拡張機能ファイルが生成されます。

### 3. Chrome に拡張機能をロード

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `dist` ディレクトリを選択

### 4. アイコンの準備（オプション）

`public/icons/icon-128.png` に 128x128 ピクセルのアイコンを配置してください。
簡単なアイコンがない場合は、以下のコマンドでプレースホルダーを作成できます:

```bash
# ImageMagick を使用してシンプルなアイコンを作成
convert -size 128x128 xc:#667eea -gravity center -pointsize 48 -fill white -annotate +0+0 "XL" public/icons/icon-128.png
```

## 使い方

### 基本的な使い方

1. Chrome ツールバーの X-Layer アイコンをクリックしてサイドパネルを開く
2. CSS エディターにスタイルを入力
3. 「適用」ボタンをクリックして現在のページにスタイルを適用
4. 「クリア」ボタンでスタイルをリセット

### プリセットの作成

1. CSS エディターでスタイルを作成
2. 「プリセット名」を入力
3. 「適用するURLパターン」を入力（例: `https://example.com/*`）
4. 「保存」ボタンをクリック

### URLパターンの例

- `https://example.com/*` - example.com のすべてのページ
- `https://example.com/blog/*` - example.com の /blog/ 以下のページ
- `https://*.example.com/*` - example.com のすべてのサブドメイン
- `*://example.com/*` - HTTP/HTTPS 両方

### プリセットの管理

- **読込**: プリセットをエディターに読み込んで適用
- **編集**: プリセット名やURLパターンを変更
- **削除**: プリセットを削除

## プロジェクト構成

```
x-layer/
├── public/
│   ├── icons/
│   │   └── icon-128.png      # 拡張機能のアイコン
│   ├── manifest.json          # Chrome拡張機能のマニフェスト
│   └── sidepanel.html         # サイドパネルのHTML
├── src/
│   ├── background.ts          # バックグラウンドサービスワーカー
│   ├── content.ts             # コンテンツスクリプト（スタイル注入）
│   ├── types.ts               # TypeScript型定義
│   └── sidepanel/
│       ├── App.tsx            # サイドパネルのメインコンポーネント
│       ├── main.tsx           # エントリーポイント
│       └── styles.css         # スタイルシート
├── dist/                      # ビルド出力（gitignore）
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 技術スタック

- **TypeScript**: 型安全な開発
- **React**: サイドパネルUI
- **Vite**: 高速なビルドツール
- **Chrome Extension Manifest V3**: 最新のChrome拡張機能仕様
- **Chrome Side Panel API**: サイドパネルUI

## 開発

### ホットリロード

開発中は `npm run dev` を実行して、ファイル変更を監視します。
ソースコードを変更した後、Chrome の拡張機能ページで「更新」ボタンをクリックしてください。

### デバッグ

- **サイドパネル**: サイドパネルで右クリック → 「検証」
- **バックグラウンドスクリプト**: `chrome://extensions/` → 「サービスワーカー」をクリック
- **コンテンツスクリプト**: ページで右クリック → 「検証」→ Consoleタブ

## ライセンス

AGPL-3.0
