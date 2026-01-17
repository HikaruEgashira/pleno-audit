Chrome拡張機能の動作確認を行います。

## テスト対象: $ARGUMENTS

### 1. 開発環境を起動
```bash
pnpm dev
```

### 2. 接続確認
```bash
DEBUG_PORT=9223 pnpm --filter @pleno-audit/debugger start status
```
期待: Status: Connected, Dev mode: yes

### 3. テストURLを開く
```bash
DEBUG_PORT=9223 pnpm --filter @pleno-audit/debugger start browser open $ARGUMENTS
```

### 4. ログを確認
```bash
DEBUG_PORT=9223 pnpm --filter @pleno-audit/debugger start logs
```

### 5. 終了
Ctrl+C（自動クリーンアップ）

## 確認ポイント
- [ ] 開発環境が正常に起動
- [ ] 拡張機能が接続される
- [ ] ログにエラーがない
- [ ] 終了時にプロセスがクリーンアップ

## トラブルシューティング
```bash
pnpm dev:stop  # プロセスが残っている場合
```
