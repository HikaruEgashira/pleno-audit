# ADR-032: 拡張機能分析タブのOSS移行

## ステータス

Accepted

## コンテキスト

`pleno-audit-internal`リポジトリに実装されていた「拡張機能分析タブ（ExtensionsAnalysisTab）」は、インストール済みのブラウザ拡張機能の権限を分析し、セキュリティリスクを可視化する機能である。

この機能は以下の理由からエンタープライズ固有の機能ではなく、一般的なセキュリティ機能と判断された：

1. **ユーザー単位の機能**: 拡張機能の分析は個人ユーザーのセキュリティ向上に直接貢献する
2. **外部通信不要**: `chrome.management` APIを使用してローカルで完結する
3. **プライバシーポリシー準拠**: ユーザーのブラウザ環境情報を外部に送信しない
4. **OSS版の価値向上**: 基本的なセキュリティ機能として提供することでOSS版の有用性が向上する

エンタープライズ要件に該当するのは以下のような機能：
- 組織全体での拡張機能ポリシー管理
- 管理者による拡張機能の一括許可/拒否
- SIEMとの連携によるアラート
- SSO/Active Directory統合

## 決定

`ExtensionsAnalysisTab`をOSS版（`pleno-audit`）に移行し、以下の変更を行う：

1. **実データの使用**: モックデータではなく `chrome.management` APIから実際の拡張機能リストを取得
2. **リスク評価ロジックの実装**: 権限に基づいたリスクレベル（critical/high/medium/low）の自動判定
3. **ダッシュボードへの統合**: 既存のタブシステムに「拡張機能」タブとして追加

### リスク評価基準

| リスクレベル | 対象権限 |
|-------------|---------|
| Critical | `debugger`, `nativeMessaging`, `proxy`, `webRequestBlocking`, `<all_urls>` |
| High | `cookies`, `history`, `tabs`, `webNavigation`, `webRequest`, `management`, `downloads`, `clipboardRead/Write` |
| Medium | `storage`, `activeTab`, `contextMenus`, `notifications`, `alarms` |
| Low | その他の権限 |

## 結果

### 肯定的

- OSS版ユーザーが拡張機能のセキュリティリスクを把握可能になる
- 外部通信なしで動作し、プライバシーポリシーに準拠
- エンタープライズ版との機能分離が明確化

### 注意点

- `chrome.management` APIには `management` 権限が必要（manifest.jsonに追加済み）
- 拡張機能のアイコン取得には追加の権限は不要

## 関連

- ADR-002: MVPではブロック機能を実装せず検出・可視化のみとする
- ADR-010: Extension Runtimeパッケージの分離
