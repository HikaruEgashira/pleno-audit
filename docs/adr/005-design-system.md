# ADR-005: グレースケール・ミニマルデザインシステム

## Status
Accepted

## Context
拡張機能のPopup UIは400px幅という制約がある。限られたスペースで情報を効率的に表示する必要がある。

### デザインの選択肢
1. **リッチUI**: カード、カラフルなバッジ、アイコン多用
2. **ミニマルUI**: テキスト主体、グレースケール、余白重視
3. **ターミナル風**: モノスペース、コマンドライン風

### 参考にしたプロダクト
- Linear: グレースケール、余白、タイポグラフィ重視
- Raycast: リスト表示、キーボード操作
- shadcn/ui: ボーダー控えめ、HSLカラー

## Decision
**shadcn/ui風のグレースケール・ミニマルデザイン**を採用し、テーブルベースのレイアウトで統一する。

### デザイン原則
1. **枠線は最小限**: カードの枠は使わず、区切り線のみ
2. **グレースケール**: `hsl(0 0% X%)`で統一
3. **余白で区切る**: 要素間は余白で分離
4. **テーブルベース**: ヘッダー付きテーブルで一覧表示

### フォントファミリー
```typescript
const FONT_MONO = "'Menlo', 'Monaco', 'Courier New', monospace";
const FONT_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
```

- **ベースフォント**: FONT_SANS（UIテキスト）
- **コード/ドメイン**: FONT_MONO（技術情報）

### カラーパレット
```
Text Primary:   hsl(0 0% 10%)
Text Secondary: hsl(0 0% 50%)
Text Muted:     hsl(0 0% 60%)
Border:         hsl(0 0% 92%)
Background:     hsl(0 0% 100%)
Badge BG:       hsl(0 0% 95%)
```

### コンポーネント構造
```
Section
├── SectionTitle (h3)
└── Table
    ├── thead > tr > th (tableHeader)
    └── tbody > tr (tableRow) > td (tableCell)
```

### 共有スタイル (styles.ts)
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

## Consequences

### Positive
- **一貫性**: 全タブで同じ視覚言語
- **保守性**: 共有stylesによるDRY原則
- **可読性**: テーブルヘッダーで項目が明確
- **情報密度**: 一覧性が良い
- **ビルドサイズ**: CSSフレームワーク不要

### Negative
- 初見での訴求力が弱い（地味に見える）
- カラーコードによる状態表現ができない（危険=赤など）
- テーブルは行ベースより縦に長くなる場合がある

### Evolution
1. v1: テキストのみのミニマル
2. v2: 必要に応じてサブタルなアクセントカラー追加
3. v3: ダークモード対応
