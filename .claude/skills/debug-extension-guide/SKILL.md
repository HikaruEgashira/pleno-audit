---
name: debug-extension-guide
description: pleno-debug (debugger CLI) で拡張機能をテスト・動作確認する際に使用。pnpm devで開発環境を起動し、DEBUG_PORT=9223でコマンド実行。「debuggerで確認」「機能テスト」「動作確認」タスク時に必須。
---

Chrome拡張機能のデバッグ手順ガイドです。
もしもこの手順で動作しない場合は、ユーザーが指示したタスクを中断して修復に努めてください。もしも開発環境にアップデートがある場合はこのスキルを更新してください。

## デバッグの流れ

### 1. 開発環境を起動（バックグラウンド）
Bash Toolの`run_in_background: true`オプションを使用して起動。
```bash
pnpm dev
```
WXTが専用プロファイル(.wxt-dev)でChromeを起動します。起動完了まで約15秒待機。

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
