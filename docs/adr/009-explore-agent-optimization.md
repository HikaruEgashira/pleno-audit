# ADR 009: Claude Code Explore Agent最適化

## Status

Accepted

## Context

Claude CodeのExplore Agentの振る舞いを~/.claudeのログを分析して調査した。

### 分析結果

1. **使用モデル**: `claude-haiku-4-5-20251001`（軽量・高速モデル）
2. **実行パターン**:
   - 並列でBash/Read/Globツールを呼び出す
   - 1回の探索で28回以上のツール呼び出し
   - 探索時間は質問の複雑さに依存（10秒〜35秒）

3. **制約**:
   - Explore Agentの内部ロジックはClaude Code本体に組み込まれており、ユーザーが直接変更することはできない
   - Haikuモデルでは`tool_reference blocks`がサポートされていない

### 課題

- プロジェクト構造の探索に時間がかかる
- 同じファイルの繰り返し読み込みが発生する可能性
- CLAUDE.mdの情報がExplore Agentのコンテキストに含まれるが、最適化されていない

## Decision

Explore Agentの効率を**間接的に**改善するため、以下のアプローチを採用する:

### 1. CLAUDE.mdの構造化

プロジェクト構造を明示的に記載し、Explore Agentが探索する前に必要な情報を提供する。

```markdown
## プロジェクト構造

\`\`\`
service-policy-auditor/
├── packages/           # 共有パッケージ
│   ├── detectors/      # CASBドメイン: @service-policy-auditor/detectors
│   ├── csp/            # CSPドメイン: @service-policy-auditor/csp
│   └── api/            # API層: @service-policy-auditor/api
├── app/
│   ├── extension/      # Chrome拡張機能 (WXT + Preact)
│   │   └── entrypoints/  # background.ts, content.ts, popup/, dashboard/
│   ├── server/         # ローカル開発サーバー
│   └── debugger/       # puppeteerテストツール
└── docs/adr/           # Architecture Decision Records
\`\`\`
```

### 2. ドメイン情報の提供

ADRへの参照やパッケージ名を明記し、Explore Agentがコードベースを理解しやすくする。

### 3. 変更しないこと

- Claude Code本体のリファクタリング（不可能）
- 環境変数やsettings.jsonでのAgent動作の変更（サポートされていない）

## Consequences

### Positive

- CLAUDE.mdを参照することで、Explore Agentがプロジェクト構造を即座に把握できる
- 一貫した構造情報により、開発者とAgentの認識が統一される
- ドキュメントとしての価値も向上

### Negative

- Explore Agentの内部動作は変更できないため、効果は限定的
- CLAUDE.mdのメンテナンスコストが発生

### Neutral

- 効果の定量的測定は困難（キャッシュや質問内容の影響）

## Evaluation

測定ログ（~/.claude/debug/）:
- プロジェクト全体の構造調査: 約33秒
- 特定パッケージの型定義調査: 約11秒

直接的な効果の測定は困難だが、CLAUDE.mdの構造化は開発体験の向上に寄与する。
