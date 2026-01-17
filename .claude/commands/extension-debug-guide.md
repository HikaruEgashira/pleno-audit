Chrome拡張機能のデバッグ手順ガイドです。

## デバッグの流れ

### 1. 開発環境を起動
```bash
pnpm dev
```
WXTが専用プロファイル(.wxt-dev)でChromeを起動します。

### 2. 接続確認
```bash
DEBUG_PORT=9223 pnpm --filter @pleno-audit/debugger start status
```

### 3. URLを開く
```bash
DEBUG_PORT=9223 pnpm --filter @pleno-audit/debugger start browser open <url>
```

### 4. ログ監視
```bash
DEBUG_PORT=9223 pnpm --filter @pleno-audit/debugger start logs
```

### 5. 終了
Ctrl+C（自動クリーンアップ）

## トラブルシューティング
```bash
pnpm dev:stop                          # プロセス停止
lsof -i :9223 -t | xargs kill -9       # ポート解放
```
