# ADR-005: UIはグレースケール・ミニマルデザインとする

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
**shadcn/ui風のグレースケール・ミニマルデザイン**を採用。

### デザイン原則
1. **枠線は最小限**: カードの枠は使わず、区切り線のみ
2. **グレースケール**: `hsl(0 0% X%)`で統一
3. **余白で区切る**: 要素間は余白で分離
4. **1行1サービス**: ドメイン名 + タグをコンパクトに

### 具体的な実装

```tsx
// サービス一覧（1行表示）
<a style={styles.row}>
  <span style={styles.domain}>github.com</span>
  <span style={styles.tags}>login · privacy · 3 cookies</span>
</a>

// スタイル
const styles = {
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 20px",
  },
  domain: {
    fontSize: "14px",
    fontWeight: 500,
    color: "hsl(0 0% 15%)",
  },
  tags: {
    fontSize: "12px",
    color: "hsl(0 0% 55%)",
  },
};
```

### カラーパレット
```
Text Primary:   hsl(0 0% 10%)
Text Secondary: hsl(0 0% 50%)
Text Muted:     hsl(0 0% 60%)
Border:         hsl(0 0% 92%)
Background:     hsl(0 0% 100%)
Badge BG:       hsl(0 0% 95%)
```

## Consequences

### Positive
- 情報密度が高く、一覧性が良い
- ビルドサイズが小さい（CSSフレームワーク不要）
- 目に優しく、長時間使用でも疲れにくい

### Negative
- 初見での訴求力が弱い（地味に見える）
- カラーコードによる状態表現ができない（危険=赤など）

### Evolution
1. v1: テキストのみのミニマル
2. v2: 必要に応じてサブタルなアクセントカラー追加
3. v3: ダークモード対応
