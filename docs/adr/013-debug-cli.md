# ADR-013: デバッグCLI (pleno-debug)

## ステータス
Accepted

## コンテキスト

Chrome拡張のデバッグ・開発において以下の課題があった：

1. **拡張内部状態の取得が困難** - ストレージやサービス情報を確認するにはDevToolsを開く必要がある
2. **coding agentとの連携** - Claude Codeなどのコーディングエージェントが拡張の状態を自動取得できない
3. **browser agentの限界** - Puppeteer/Playwrightベースのブラウザ自動化では拡張内部のAPIにアクセスできない

[agent-browser](https://github.com/vercel-labs/agent-browser)のようなCLIベースのデバッグツールが必要。

## 決定

### アーキテクチャ

WebSocketベースのクライアント・サーバーアーキテクチャを採用：

```
┌─────────────────┐      WebSocket        ┌──────────────────────┐
│   pleno-debug   │◄─────────────────────►│  Chrome Extension    │
│  (CLI + Server) │   localhost:9222      │  (dev mode only)     │
└─────────────────┘                       └──────────────────────┘
```

**通信フロー:**
1. `pleno-debug server` でデバッグサーバーを起動（localhost:9222）
2. 拡張機能（devモード）がサーバーの `/debug` パスに接続
3. CLIコマンドがサーバーの `/cli` パスに接続してリクエストを送信
4. サーバーがCLI→拡張、拡張→CLIのメッセージを中継

### 検討した代替案

| 方式 | メリット | デメリット |
|------|---------|-----------|
| **Native Messaging** | Chrome公式API | セットアップが複雑、ホストマニフェスト登録が必要 |
| **Chrome DevTools Protocol** | 標準的 | 拡張内部APIへのアクセスが制限される |
| **HTTP REST API** | シンプル | Service Workerからサーバーを立てられない |
| **WebSocket** ✅ | 双方向通信、シンプル | 専用サーバーが必要 |

WebSocketを選択した理由：
- Service Workerがクライアントとして接続可能
- 双方向リアルタイム通信が可能
- セットアップが不要（サーバー起動のみ）

### コマンド体系

agent-browser風のサブコマンド構造：

```bash
pleno-debug server              # サーバー起動
pleno-debug status              # 接続状態確認
pleno-debug snapshot            # 全状態取得（JSON）
pleno-debug storage list|get|set|clear  # ストレージ操作
pleno-debug services list|get|clear     # サービス操作
pleno-debug events list|count|clear     # イベント操作
pleno-debug message <type> [data]       # 任意メッセージ送信
pleno-debug logs [-l level] [-m module] # リアルタイムログストリーム
pleno-debug browser open <url>          # ブラウザでURLを開く
```

### 開発モード専用

`debug-bridge.ts`は`import.meta.env.DEV`でガードされ、本番ビルドには含まれない：

```typescript
// background.ts
if (import.meta.env.DEV) {
  import("../lib/debug-bridge.js").then(({ initDebugBridge }) => {
    initDebugBridge();
  });
}
```

### ファイル構成

```
app/debugger/
├── src/
│   ├── cli.ts              # CLIエントリポイント
│   ├── server.ts           # WebSocketサーバー
│   ├── extension-client.ts # CLI→サーバー通信
│   └── commands/           # サブコマンド
│       ├── status.ts
│       ├── snapshot.ts
│       ├── storage.ts
│       ├── services.ts
│       ├── events.ts
│       ├── message.ts
│       ├── watch.ts
│       ├── logs.ts         # リアルタイムログ
│       └── browser.ts      # ブラウザ操作

app/extension/lib/
└── debug-bridge.ts         # 拡張側WebSocketクライアント
```

## 結果

- coding agentがCLI経由で拡張の状態を取得可能
- 拡張内部APIにプログラマティックにアクセス可能
- 本番環境に影響なし（開発モード専用）
- browser agentでできない操作をサブコマンドで補完

## 使用例

```bash
# 開発環境を一括起動（server + extension + logs）
pnpm dev

# 別ターミナルでコマンド実行
pnpm --filter @pleno-audit/debugger start status
pnpm --filter @pleno-audit/debugger start snapshot -p
pnpm --filter @pleno-audit/debugger start browser open example.com
```
