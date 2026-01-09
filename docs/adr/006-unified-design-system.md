# ADR-006: CSP Auditor統合に伴うデザインシステム統一

## Status
Accepted

## Context
CSP Auditor機能をservice-detectionに統合するにあたり、UIの統一感が課題となった。

### 統合前の状態
- **service-detection**: 行ベースのリスト表示、独自スタイル
- **CSP Auditor**: テーブルベース、グレースケール、モノスペースフォント

### 問題点
1. コンポーネントごとに異なるスタイル定義（ローカルstyles）
2. フォントファミリーの不統一（sans-serif vs monospace）
3. 情報の表示形式の不一致（行 vs テーブル）

## Decision
**CSP Auditorのデザインシステムに統一**する。

### 理由
1. CSP Auditorはセキュリティ監査ツールとして設計されており、データ一覧表示に最適化
2. テーブルレイアウトは複数カラムの情報を整理して表示可能
3. モノスペースフォントはドメイン名・コード表示に適切

### 統一されたデザインシステム

#### フォントファミリー
```typescript
const FONT_MONO = "'Menlo', 'Monaco', 'Courier New', monospace";
const FONT_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
```

- **ベースフォント**: FONT_SANS（UIテキスト）
- **コード/ドメイン**: FONT_MONO（技術情報）

#### レイアウト
- **テーブルベース**: ヘッダー付きテーブルで一覧表示
- **セクションタイトル**: 大文字、letter-spacing、軽量フォント

#### コンポーネント構造
```
Section
├── SectionTitle (h3)
└── Table
    ├── thead > tr > th (tableHeader)
    └── tbody > tr (tableRow) > td (tableCell)
```

#### 共有スタイル (styles.ts)
```typescript
export const styles = {
  // フォント定義
  fontMono: FONT_MONO,
  fontSans: FONT_SANS,

  // テーブルスタイル
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  tableHeader: { backgroundColor: "hsl(0 0% 95%)", ... },
  tableCell: { padding: "6px 8px", ... },

  // 汎用コンポーネント
  badge: { ... },  // タグ表示
  code: { ... },   // コード/ドメイン表示
};
```

### 統一対象コンポーネント

| コンポーネント | 変更内容 |
|---------------|---------|
| ServiceList.tsx | 行ベース → テーブル、共有styles使用 |
| EventLog.tsx | 独自styles → 共有styles、テーブル化 |
| ViolationList.tsx | そのまま（既にCSP Auditorスタイル） |
| NetworkList.tsx | そのまま（既にCSP Auditorスタイル） |
| PolicyGenerator.tsx | そのまま（既にCSP Auditorスタイル） |
| Settings.tsx | そのまま（既にCSP Auditorスタイル） |

## Consequences

### Positive
- **一貫性**: 全タブで同じ視覚言語
- **保守性**: 共有stylesによるDRY原則
- **可読性**: テーブルヘッダーで項目が明確
- **拡張性**: 新機能追加時もスタイル統一が容易

### Negative
- **既存UIの変更**: service-detection利用者は見た目が変わる
- **情報密度**: テーブルは行ベースより縦に長くなる場合がある

### Migration
1. styles.tsを中央集約のスタイル定義として使用
2. 各コンポーネントからローカルstylesを削除
3. 共有stylesをimportして使用
