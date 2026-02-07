---
name: create-adr
description: >
  ADR（Architecture Decision Record）を作成するスキル。
  docs/adr/ にストック情報（永続的な意思決定）のみを記録する。
  Trigger: ADR作成, 設計決定記録, アーキテクチャ決定を記録
---

# ADR作成

## ルール

- **ストック情報のみ**: リファクタリング手順やプロセスガイドは記録しない
- フロー情報（段階的手順、一時的な計画）はgit historyやCLAUDE.mdに任せる

## 手順

1. `docs/adr/README.md` を読み、現在の最大番号を取得
2. 次の番号で `docs/adr/{NNN}-{slug}.md` を作成

```markdown
# ADR-{NNN}: {タイトル}

## Status

Accepted

## Context

なぜこの決定が必要か。背景と制約。

## Decision

何を決定したか。具体的な方針。

## Consequences

この決定により何が変わるか。トレードオフ。
```

3. `docs/adr/README.md` のテーブル末尾にエントリを追加

```markdown
| [{NNN}](./{NNN}-{slug}.md) | {タイトル} | Accepted |
```

## 判断基準: ADRに記録すべきか

記録する: 技術選定、パッケージ構造、機能設計方針、外部制約への対応
記録しない: リファクタリングの各ステップ、一時的な計画、開発プロセス
