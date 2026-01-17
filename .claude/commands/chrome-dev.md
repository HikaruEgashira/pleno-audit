Chrome拡張機能の開発環境を管理します。

## コマンド: $ARGUMENTS

以下のコマンドを実行してください:

- `start` または引数なし: 開発環境を起動
  ```bash
  pnpm dev
  ```

- `stop`: 開発Chromeプロセスを停止
  ```bash
  pnpm dev:stop
  ```

- `status`: 状態確認
  ```bash
  pnpm --filter @pleno-audit/debugger start dev status
  ```

- `open <url>`: URLを開く
  ```bash
  DEBUG_PORT=9223 pnpm --filter @pleno-audit/debugger start browser open <url>
  ```

- `logs`: ログ監視
  ```bash
  DEBUG_PORT=9223 pnpm --filter @pleno-audit/debugger start logs
  ```

## 注意事項
- DEBUG_PORT=9223で既存Chromeと分離
- ビルド出力は.wxt-dev/（既存のdist/には影響なし）
- Ctrl+Cで終了時に自動クリーンアップ
