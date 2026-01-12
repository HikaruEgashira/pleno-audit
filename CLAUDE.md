CASB/Browser Security

## 構造

- `packages/detectors/` - CASBドメイン（サービス検出、認証検出）
- `packages/csp/` - CSP監査（違反検出、ポリシー生成、レポーター）
- `packages/nrd/` - NRDアルゴリズム
- `packages/typosquat` - typosquattingアルゴリズム
- `packages/ai-detector` - AI検出アルゴリズム
- `packages/api/` - REST API（Hono + sql.js）
- `packages/extension-runtime/` - 拡張機能ランタイム（ストレージ、API クライアント、同期）
- `app/extension/` - Chrome拡張（WXT + Preact）

詳細は各パッケージの`index.ts`を参照。

## ロギング

`console.*`の代わりに`createLogger`を使用する。`oxlint`の`no-console`ルールで検出される。

```typescript
import { createLogger } from "@pleno-audit/extension-runtime";

const logger = createLogger("module-name");

logger.debug("開発時のみ出力");
logger.info("情報ログ");
logger.warn("警告");
logger.error("エラー", error);
```

開発モードでは`pleno-debug logs`でリアルタイム監視可能。

## 動作確認

```bash
# 開発環境を起動（server + extension + logs）
pnpm dev

# 別ターミナルでブラウザ操作
pnpm --filter @pleno-audit/debugger start browser open example.com
pnpm --filter @pleno-audit/debugger start status
```

ポップアップでサービス検出結果を確認。

## ADR

@docs/adr/README.md
