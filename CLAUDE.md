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

## ADR

@docs/adr/README.md
