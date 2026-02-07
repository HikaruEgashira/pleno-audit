# ADR-048: lib/原則禁止とpackages/移行方針

## Status

Accepted

## Context

`app/audit-extension/lib/` にアプリケーション固有のロジックが蓄積されていた。ADR-044〜046でモジュール分割・ファサード化を進めた結果、各モジュールは独立性が高まり、パッケージとして切り出す準備が整った。

## Decision

- `lib/` にドメインロジックを配置することを原則禁止する
- ドメインロジックは `packages/` 配下に独立パッケージとして配置する
- `lib/` にはUI固有コード（Preactフック等）のみ残すことを許容する

### 移行対象と移行先

| 元の場所 | 移行先パッケージ |
|---|---|
| `lib/background/extension-network-service/` + helpers | `@pleno-audit/extension-network-service` |
| `lib/debug-bridge/` + `lib/debug-bridge.ts` | `@pleno-audit/debug-bridge` |
| `lib/background/` (残り全体) | `@pleno-audit/background-services` |
| `lib/theme.ts` | 移行しない（UIフック） |

### 方針

- chrome.*直接呼び出しのDI抽象化は初回移行では行わない（ROI低い）
- `pnpm-workspace.yaml` の `packages/*` でワークスペース自動認識
- 各パッケージは `src/index.ts` でfacadeをexport

## Consequences

- `background.ts` の全importが `@pleno-audit/*` パッケージ参照に統一される
- 各パッケージの単体テスト・型チェックが独立して可能になる
- 将来的にchrome.*のDI抽象化が必要な場合、パッケージ単位で段階的に対応可能
