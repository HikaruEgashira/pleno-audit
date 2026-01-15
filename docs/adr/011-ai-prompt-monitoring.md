# ADR 010: AIプロンプト監視機能

## ステータス

Accepted

## コンテキスト

CASBとしてAIサービス（ChatGPT、Claude、Gemini等）へのプロンプト送信とレスポンス受信を監視する機能が求められている。これにより以下を実現する

- **DLP（Data Loss Prevention）**: 機密情報がAIサービスに送信されていないか監視
- **Shadow AI監視**: 組織が把握していないAIサービスの利用を検出
- **監査ログ**: AI利用履歴の記録・コンプライアンス対応

## 決定

### 検出方式

**URLパターンは使用せず、リクエスト構造による汎用検出を採用する**

理由
1. 新しいAIサービスやカスタムエンドポイントにも対応可能
2. メンテナンスコストの低減（URLパターンの更新不要）
3. 自社ホスト型のAIサービス（Azure OpenAI等）にも対応

### 検出対象のリクエスト構造

以下の構造を持つPOSTリクエストをAIサービスとして検出

1. **Chat Completion形式**
   ```json
   { "messages": [{"role": "user", "content": "..."}], "model": "..." }
   ```

2. **Completion形式**
   ```json
   { "prompt": "...", "model": "..." }
   ```

3. **Gemini形式**
   ```json
   { "contents": [{"parts": [{"text": "..."}]}] }
   ```

### プロバイダー推定

レスポンス構造からプロバイダーを推定
- `choices[].message.content` → OpenAI互換
- `content[].text` → Anthropic
- `candidates[].content` → Google Gemini

### アーキテクチャ

```
Main World (ai-hooks.js)
  │ fetch/XHRフック、リクエストボディキャプチャ
  ↓ CustomEvent('__AI_PROMPT_CAPTURED__')
Content Script (ai-monitor.content.ts)
  ↓ chrome.runtime.sendMessage
Background (background.ts)
  │ ストレージ保存、イベントログ追加
  ↓
chrome.storage.local
  ↓
Popup UI (AIPromptList.tsx)
```

### 新規イベントタイプ

| イベント | 説明 |
|---------|------|
| `ai_prompt_sent` | AIプロンプト送信時 |
| `ai_response_received` | AIレスポンス受信時 |

## 結果

### 利点

1. 特定のAIサービスに依存しない汎用的な検出
2. 既存のCASBアーキテクチャとの統合
3. 将来のPII検出・DLPルール追加が容易

### 制約

1. リクエスト構造が標準的でないAIサービスは検出されない可能性がある
2. 暗号化されたリクエストボディは検出不可
3. ストリーミングレスポンスの完全なキャプチャには制限あり

## 未実装機能

1. **PII検出**: プロンプト内の個人情報（メールアドレス、電話番号等）を検出
2. **DLPルール**: 機密情報パターン（クレジットカード番号、APIキー等）の検出
3. **リスクスコアリング**: プロンプトの機密性レベルを自動評価
4. **アラート機能**: 高リスクプロンプト検出時の通知
5. **エクスポート機能**: 監査ログのCSV/JSON出力
