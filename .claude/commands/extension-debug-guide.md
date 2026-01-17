Chrome拡張機能のデバッグ手順ガイドです。

## デバッグの流れ

### 1. 開発環境を起動（バックグラウンド）
```bash
pnpm dev &
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

### 4. ログ確認
```bash
timeout 10 bash -c 'DEBUG_PORT=9223 pnpm --filter @pleno-audit/debugger start logs' || true
```

### 5. 終了
```bash
pnpm dev:stop
```

## トラブルシューティング

### ポートが使用中エラー
前回の開発環境が正常終了しなかった場合に発生。
```bash
lsof -i :9223 -t | xargs kill -9
```

### Chromeプロセスが残っている
timeoutやSIGINT以外で強制終了した場合に発生。
```bash
pkill -9 -f tmp-web-ext
```
