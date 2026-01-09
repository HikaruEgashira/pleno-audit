# ADR-004: プライバシーポリシーはURLパターンとリンクテキストで特定する

## Status
Accepted

## Context
サービスのプライバシーポリシーURLを自動特定したい。方法は複数あり、それぞれコスト・精度・プライバシーのトレードオフがある。

### 特定方法の選択肢

| 方法 | コスト | 精度 | プライバシー |
|------|--------|------|--------------|
| URLパターン | 即時 | 70% | ◎ ローカル完結 |
| リンクテキスト検索 | DOM走査 | 85% | ◎ ローカル完結 |
| Well-known パス | HTTP 1回 | 低 | ◎ 標準仕様のみ |
| サーバーキャッシュ | API 1回 | 95% | △ ドメイン送信 |
| AI Agent | LLM呼び出し | 98% | × ページ内容送信 |

## Decision
MVPでは**URLパターン→リンクテキスト**の順で試行。サーバー通信なし。

```typescript
function findPrivacyPolicy(): string | null {
  // 1. 現在のURLがプライバシーポリシーか
  if (isPrivacyUrl(location.pathname)) {
    return location.href;
  }

  // 2. フッターのリンクを検索
  for (const selector of FOOTER_SELECTORS) {
    for (const link of document.querySelectorAll(selector)) {
      if (isPrivacyText(link.textContent) || isPrivacyUrl(link.href)) {
        return link.href;
      }
    }
  }

  // 3. ページ全体のリンクを検索（フォールバック）
  // ...

  return null;
}
```

### パターン定義

```typescript
// URLパターン
const PRIVACY_URL_PATTERNS = [
  /\/privacy[-_]?policy/i,
  /\/privacy/i,
  /\/legal\/privacy/i,
];

// リンクテキスト（多言語対応）
const PRIVACY_TEXT_PATTERNS = [
  /privacy\s*policy/i,
  /プライバシー\s*ポリシー/,
  /個人情報\s*保護/,
  /個人情報の取り扱い/,
];

// フッターセレクタ
const FOOTER_SELECTORS = [
  'footer a',
  '[class*="footer"] a',
  '[role="contentinfo"] a',
];
```

## Consequences

### Positive
- サーバー不要、完全にローカルで動作
- プライバシー保護（ブラウジングデータを送信しない）
- 主要サイトの80-90%をカバー

### Negative
- SPAで動的に生成されるフッターは検出できない場合がある
- 非標準的なURL構造のサイトは検出できない
- 多言語対応が不完全（英語・日本語のみ）

### Future Work
将来のintelligence機能で以下を追加：
1. **サーバーキャッシュ**: 同じドメインを訪れた他ユーザーの結果を共有
2. **AI Agent**: 検出できなかったサイトのみLLMで解析
3. **Well-known**: `/.well-known/privacy-policy`の標準化を待つ

---

## 2025-01 改善: メタデータ検出と多言語対応の追加

### 追加した検出方法

| 方法 | コスト | 精度 | プライバシー |
|------|--------|------|--------------|
| link[rel] | 即時 | 90% | ◎ ローカル完結 |
| JSON-LD | 軽量 | 85% | ◎ ローカル完結 |
| OG meta | 軽量 | 70% | ◎ ローカル完結 |

### 検出優先順位（更新後）

```typescript
// 1. URL判定 - O(1)
// 2. link[rel="privacy-policy"] - querySelector 1回
// 3. JSON-LD (privacyPolicy, privacyUrl) - script要素のみ走査
// 4. OG meta (og:url にprivacy含む) - querySelector 1回
// 5. フッターリンク検索 - 限定的DOM走査
// 6. 全リンクスキャン - 最大500件
```

### 追加した多言語対応

- **英語**: data protection, data privacy, your privacy
- **ドイツ語**: Datenschutz, Datenschutzerklärung
- **フランス語**: Politique de confidentialité, Protection des données
- **スペイン語**: Política de privacidad, Protección de datos
- **イタリア語**: Informativa sulla privacy
- **ポルトガル語**: Política de privacidade
- **中国語**: 隐私政策, 隱私政策, 个人信息保护
- **韓国語**: 개인정보 처리방침, 프라이버시 정책
- **オランダ語**: Privacybeleid
- **ロシア語**: Политика конфиденциальности

### 追加した機能

- **URLエンコード対応**: `decodeURIComponent`でデコード後にパターンマッチング
- **GDPR関連URL**: `/gdpr`, `/dsgvo` パターン追加
- **除外パターン**: プライバシー設定ページ（policy以外）を誤検知しないよう除外
  - `privacyprefs`, `privacy-settings`, `privacy-preferences`
  - `privacy-center`, `manage-privacy`, `privacy-controls`
