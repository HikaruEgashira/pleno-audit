# pleno-debug

Chrome拡張のデバッグCLI。[agent-browser](https://github.com/vercel-labs/agent-browser)風のコマンド体系で、拡張の内部状態を操作・取得できます。

## アーキテクチャ

```
┌─────────────────┐      WebSocket        ┌──────────────────────┐
│   pleno-debug   │◄─────────────────────►│  Chrome Extension    │
│  (CLI + Server) │   localhost:9222      │  (dev mode only)     │
└─────────────────┘                       └──────────────────────┘
        ▲                                          │
        │                                          │ WebSocket
        │                                          ▼
┌─────────────────┐                       ┌──────────────────────┐
│  Claude Code /  │                       │   Debug Server       │
│  Coding Agent   │                       │   (localhost:9222)   │
└─────────────────┘                       └──────────────────────┘
```

**通信フロー:**
1. `pleno-debug server` でデバッグサーバーを起動（localhost:9222）
2. 拡張機能（devモード）がサーバーの `/debug` パスに接続
3. CLIコマンドがサーバーの `/cli` パスに接続してリクエストを送信
4. サーバーがCLI→拡張、拡張→CLIのメッセージを中継

## 使い方

### 1. デバッグサーバーを起動

```bash
# ターミナル1: サーバー起動
pnpm --filter @pleno-audit/debugger start server
```

### 2. 拡張を開発モードで起動

```bash
# ターミナル2: 拡張起動
pnpm --filter @pleno-audit/audit-extension dev
```

拡張が起動すると、自動的にデバッグサーバーに接続します。

### 3. CLIコマンドを実行

```bash
# ターミナル3: コマンド実行
pnpm --filter @pleno-audit/debugger start status
pnpm --filter @pleno-audit/debugger start snapshot -p
```

## コマンド一覧

```bash
# 基本情報
pleno-debug status              # 接続状態確認
pleno-debug snapshot            # 全状態のJSONスナップショット

# ストレージ操作
pleno-debug storage list        # キー一覧
pleno-debug storage get <key>   # 値取得
pleno-debug storage set <key> <value>
pleno-debug storage clear -y    # クリア

# データ取得
pleno-debug services list       # 検出済みサービス一覧
pleno-debug events list -n 20   # イベントログ
pleno-debug events count        # イベント数

# 拡張操作
pleno-debug message <type> [data]  # 任意のメッセージ送信

# 監視
pleno-debug watch events        # イベントをリアルタイム監視
pleno-debug watch storage       # ストレージ変更監視
```

## coding agent連携

Claude Codeなどのcoding agentから使用する場合

```bash
# サーバーをバックグラウンドで起動
pnpm --filter @pleno-audit/debugger start server &

# 拡張を起動（別ターミナルで）
pnpm --filter @pleno-audit/audit-extension dev

# コマンド実行
pnpm --filter @pleno-audit/debugger start status
pnpm --filter @pleno-audit/debugger start snapshot -p | jq '.services'
```

## 開発モード専用

このデバッグ機能は**開発モード(`pnpm dev`)でのみ**有効です。
本番ビルドには含まれません。
