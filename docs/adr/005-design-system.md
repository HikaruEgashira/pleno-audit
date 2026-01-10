# ADR-005: Vercel風ミニマルデザインシステム

## Status
Accepted (Updated)

## Context
拡張機能のUIは一貫したデザイン言語を必要とする。PopupとDashboardで同じコンポーネントを共有し、統一されたUXを提供する。

### 参考にしたプロダクト
- **Vercel**: 黒/白のコントラスト、丸みを帯びた角、ミニマルなボーダー
- **Linear**: グレースケール、余白、タイポグラフィ重視
- **shadcn/ui**: コンポーネント構造、variant パターン

## Decision
**Vercel風のモダン・ミニマルデザイン**を採用し、共通コンポーネントライブラリで統一する。

### デザイン原則
1. **黒/白コントラスト**: プライマリは`#000`、背景は`#fafafa`
2. **丸みを帯びた角**: `border-radius: 6-8px`で統一
3. **ミニマルなボーダー**: `#eaeaea`の薄いボーダー
4. **余白で区切る**: 要素間は余白で分離
5. **セマンティックカラー**: バッジでのみアクセントカラーを使用

### フォントファミリー
```typescript
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif";
const FONT_MONO = "'Menlo', 'Monaco', 'Courier New', monospace";
```

### カラーパレット
```
// ベース
Text Primary:   #111
Text Secondary: #666
Text Muted:     #999
Border:         #eaeaea
Background:     #fafafa
Surface:        #fff

// バッジバリアント
Default:  bg:#fafafa  text:#666   border:#eaeaea
Success:  bg:#d3f9d8  text:#0a7227 border:#b8f0c0
Warning:  bg:#fff8e6  text:#915b00 border:#ffe58f
Danger:   bg:#fee     text:#c00    border:#fcc
Info:     bg:#e6f4ff  text:#0050b3 border:#91caff
```

### 共有コンポーネント (`app/extension/components/`)

| Component | 説明 | バリアント |
|-----------|------|-----------|
| Badge | ステータス表示 | default, success, warning, danger, info |
| Button | アクションボタン | primary, secondary, ghost |
| Card | コンテナ | padding: sm, md, lg |
| DataTable | テーブル | ページネーション付き |
| SearchInput | 検索入力 | - |
| Select | ドロップダウン | - |
| StatCard | 統計カード | クリック可能、トレンド表示 |
| Tabs | タブナビゲーション | カウント表示対応 |

### コンポーネント構造
```
app/extension/
├── components/           # 共有コンポーネント
│   ├── Badge.tsx
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── DataTable.tsx
│   ├── SearchInput.tsx
│   ├── Select.tsx
│   ├── StatCard.tsx
│   ├── Tabs.tsx
│   └── index.ts
├── entrypoints/
│   ├── popup/            # Popup UI
│   │   ├── App.tsx
│   │   ├── styles.ts     # Popup固有スタイル
│   │   └── components/   # Popup専用コンポーネント
│   └── dashboard/        # Dashboard UI
│       └── App.tsx
```

### スタイル設計

```typescript
// 共有スタイル定義
const styles = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
    color: "#111",
    background: "#fafafa",
  },
  card: {
    background: "#fff",
    border: "1px solid #eaeaea",
    borderRadius: "8px",
    padding: "16px",
  },
  button: {
    borderRadius: "6px",
    fontWeight: 500,
    transition: "all 0.15s",
  },
};
```

## Consequences

### Positive
- **一貫性**: Popup/Dashboardで同じビジュアル言語
- **再利用性**: 共有コンポーネントによるDRY原則
- **保守性**: 変更が全体に反映
- **モダンなUX**: Vercel風の洗練されたデザイン
- **セマンティック**: バッジカラーで状態が一目で分かる

### Negative
- コンポーネント変更時の影響範囲が広い
- 初見でのインパクトはカラフルなUIより弱い

### Evolution
1. v1: グレースケール・テキストベース (廃止)
2. **v2: Vercel風・コンポーネントベース (現行)**
3. v3: ダークモード対応 (予定)
