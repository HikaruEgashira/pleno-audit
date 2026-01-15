# ADR 006: 利用規約（Terms of Service）検出機能

## ステータス

Accepted

## コンテキスト

プライバシーポリシー検出機能（ADR-004）と同様に、利用規約（Terms of Service）の検出機能が必要となった。ユーザーがアクセスするサービスの利用規約を自動的に特定し、可視化することで、サービス利用時の法的条件を把握しやすくする。

## 決定

### 検出方式

プライバシーポリシー検出と同じアーキテクチャを採用し、以下の優先順位で検出を行う

1. **URL判定** - 現在のURLが利用規約パターンに該当するか
2. **link[rel]メタデータ** - `<link rel="terms-of-service">` 等
3. **JSON-LD** - 構造化データ内の `termsOfService` キー
4. **OG meta** - Open Graph URL に terms パターンが含まれるか
5. **フッターリンク検索** - フッター要素内のリンクをスキャン
6. **全リンク走査** - フォールバック（最大500リンク）

### 多言語対応

以下の言語のパターンをサポート

| 言語 | URLパターン例 | テキストパターン例 |
|------|--------------|------------------|
| 英語 | /terms, /tos, /eula | Terms of Service, Terms of Use |
| 日本語 | /%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84 | 利用規約, ご利用規約 |
| ドイツ語 | /agb, /nutzungsbedingungen | AGB, Nutzungsbedingungen |
| フランス語 | /cgu, /conditions-utilisation | CGU, Conditions d'utilisation |
| スペイン語 | /terminos, /condiciones | Términos de servicio |
| イタリア語 | /termini-servizio | Termini di servizio |
| 中国語 | - | 服务条款, 使用条款 |
| 韓国語 | - | 이용약관, 서비스약관 |

### メタデータ検出

```typescript
TOS_JSONLD_KEYS = ["termsOfService", "termsUrl"]
TOS_LINK_REL_VALUES = ["terms-of-service", "terms", "tos"]
TOS_OG_PATTERNS = [/terms/i, /tos/i, /agb/i]
```

### データ構造

```typescript
interface DetectedService {
  // ...
  termsOfServiceUrl: string | null;
}

type EventLog =
  | EventLogBase<"terms_of_service_found", TosFoundDetails>
  // ...

interface TosFoundDetails {
  url: string;
  method: string;
}
```

## 影響

### ポジティブ

- プライバシーポリシー検出との一貫したアーキテクチャ
- 多言語対応により国際的なサービスもカバー
- メタデータ検出により構造化されたサイトでの精度向上
- サーバー通信なしでプライバシー保護

### 考慮事項

- 利用規約ページとプライバシーポリシーページが同一の場合がある
- 一部のサイトでは利用規約が複数文書に分かれている場合がある

## 関連

- [ADR 004: プライバシーポリシー検出](./004-privacy-policy-detection.md)
