# ADR-005: Vercel風ミニマルデザインシステム

## Status
Accepted (Updated - v3 Dark Mode)

## Context
拡張機能のUIは一貫したデザイン言語を必要とする。PopupとDashboardで同じコンポーネントを共有し、統一されたUXを提供する。

### 参考にしたプロダクト
- **Vercel**: 黒/白のコントラスト、丸みを帯びた角、ミニマルなボーダー
- **Linear**: グレースケール、余白、タイポグラフィ重視
- **shadcn/ui**: コンポーネント構造、variant パターン

## Decision
**Vercel風のモダン・ミニマルデザイン**を採用し、共通コンポーネントライブラリで統一する。

### デザイン原則
1. **黒/白コントラスト**: プライマリは`#000`/`#fff`、背景は`#fafafa`/`#222`
2. **丸みを帯びた角**: `border-radius: 6-8px`で統一
3. **ミニマルなボーダー**: `#eaeaea`/`#333`の薄いボーダー
4. **余白で区切る**: 要素間は余白で分離
5. **セマンティックカラー**: バッジでのみアクセントカラーを使用

### フォントファミリー
```typescript
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif";
const FONT_MONO = "'Menlo', 'Monaco', 'Courier New', monospace";
```

### カラーパレット

#### ライトモード
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

#### ダークモード
```
// ベース
Text Primary:   #e5e5e5
Text Secondary: #a0a0a0
Text Muted:     #666
Border:         #333
Background:     #222
Surface:        #1a1a1a

// バッジバリアント
Default:  bg:#2a2a2a  text:#a0a0a0 border:#333
Success:  bg:#0a3d1a  text:#4ade80  border:#166534
Warning:  bg:#3d2e0a  text:#fbbf24  border:#92400e
Danger:   bg:#3d0a0a  text:#f87171  border:#991b1b
Info:     bg:#0a2a3d  text:#60a5fa  border:#1e40af
```

### テーマシステム

```typescript
// app/extension/lib/theme.ts

type ThemeMode = "light" | "dark" | "system";

interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  status: { default, success, warning, danger, info };
}

// Preact Contextでテーマを管理
const ThemeContext = createContext<ThemeContextValue>(defaultContext);
const useTheme = () => useContext(ThemeContext);
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
| ThemeToggle | テーマ切り替え | light/dark/system |

### コンポーネント構造
```
app/extension/
├── lib/
│   └── theme.ts          # テーマコンテキスト・カラーパレット
├── components/           # 共有コンポーネント
│   ├── Badge.tsx
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── DataTable.tsx
│   ├── SearchInput.tsx
│   ├── Select.tsx
│   ├── StatCard.tsx
│   ├── Tabs.tsx
│   ├── ThemeToggle.tsx
│   └── index.ts
├── entrypoints/
│   ├── popup/            # Popup UI
│   │   ├── App.tsx       # ThemeContext.Provider
│   │   ├── styles.ts     # createStyles(colors)
│   │   └── components/   # Popup専用コンポーネント
│   └── dashboard/        # Dashboard UI
│       └── App.tsx       # ThemeContext.Provider
```

### スタイル設計

```typescript
// テーマ対応スタイル
function createStyles(colors: ThemeColors) {
  return {
    container: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
      color: colors.textPrimary,
      background: colors.bgSecondary,
    },
    card: {
      background: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: "8px",
      padding: "16px",
    },
  };
}
```

### テーマ設定の永続化
- `chrome.storage.local.themeMode`にユーザー選択を保存
- `prefers-color-scheme`メディアクエリでシステム設定を検出
- system/light/darkの3モード対応

## Consequences

### Positive
- **一貫性**: Popup/Dashboardで同じビジュアル言語
- **再利用性**: 共有コンポーネントによるDRY原則
- **保守性**: 変更が全体に反映
- **モダンなUX**: Vercel風の洗練されたデザイン
- **セマンティック**: バッジカラーで状態が一目で分かる
- **アクセシビリティ**: ダークモードで目に優しい

### Negative
- コンポーネント変更時の影響範囲が広い
- 初見でのインパクトはカラフルなUIより弱い
- テーマ切り替え時の再レンダリングコスト

### 履歴
1. v1: グレースケール・テキストベース（廃止）
2. v2: Vercel風・コンポーネントベース（廃止）
3. **v3: ダークモード対応（現行）**
