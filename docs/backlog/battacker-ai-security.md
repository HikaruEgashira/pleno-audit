# Battacker AI Security シグネチャ

## 概要

BrowserTotalのAI Securityカテゴリに対応するBattackerシグネチャの実装計画。

## 背景

BrowserTotalは以下のAI Security テストを提供：
- AI Browser Prompt Injection
- AI Agent Hijacking
- LLM Analysis
- AI Tool Poisoning

Battackerにはこれらのテストが存在しないため、ギャップを埋める必要がある。

## シグネチャ定義

### 1. AI Browser Prompt Injection

```typescript
{
  id: "ai_browser_prompt_injection",
  name: "AI Browser Prompt Injection",
  category: "ai_security",
  description: "AIブラウザに対するプロンプトインジェクション攻撃のシミュレーション",
  severity: "high",
  weight: 20,
  tags: ["ai", "injection", "prompt"],
  testFn: async (context) => {
    // DOM内に埋め込まれた悪意あるプロンプトの検出
    // 1. 隠しテキスト（display:none, visibility:hidden）
    // 2. 極小フォント（font-size: 0px）
    // 3. 白背景に白文字
    // 4. data-*属性内のプロンプト
  }
}
```

**攻撃ベクトル**:
- Webページ内の隠しプロンプト
- DOM属性への悪意あるテキスト埋め込み
- CSSによる視覚的隠蔽

### 2. AI Agent Hijacking

```typescript
{
  id: "ai_agent_hijacking",
  name: "AI Agent Hijacking",
  category: "ai_security",
  description: "AIエージェントの制御を奪取する攻撃のシミュレーション",
  severity: "critical",
  weight: 25,
  tags: ["ai", "hijacking", "agent"],
  testFn: async (context) => {
    // AIエージェントへのコマンドインジェクション
    // 1. 権限昇格を誘導するテキスト
    // 2. 外部URLへのアクセス誘導
    // 3. ファイル操作の誘導
  }
}
```

**攻撃ベクトル**:
- ソーシャルエンジニアリングプロンプト
- 権限バイパスの誘導
- 悪意あるアクション実行の誘導

### 3. AI Context Poisoning

```typescript
{
  id: "ai_context_poisoning",
  name: "AI Context Poisoning",
  category: "ai_security",
  description: "AIのコンテキストを汚染する攻撃のシミュレーション",
  severity: "high",
  weight: 18,
  tags: ["ai", "context", "poisoning"],
  testFn: async (context) => {
    // ページコンテンツ経由のコンテキスト汚染
    // 1. 偽のシステムメッセージ
    // 2. 権限クレーム
    // 3. 緊急性を装ったテキスト
  }
}
```

**攻撃ベクトル**:
- 偽のシステムメッセージ埋め込み
- 管理者権限の偽装
- 緊急対応を装った指示

### 4. AI Tool Abuse

```typescript
{
  id: "ai_tool_abuse",
  name: "AI Tool Abuse",
  category: "ai_security",
  description: "AIツールの悪用を検出するテスト",
  severity: "medium",
  weight: 15,
  tags: ["ai", "tool", "abuse"],
  testFn: async (context) => {
    // AIツールの悪用パターン検出
    // 1. 過剰な権限要求
    // 2. 機密データへのアクセス誘導
    // 3. ファイルシステム操作の誘導
  }
}
```

**攻撃ベクトル**:
- ツール機能の悪用
- 権限外操作の誘導
- データ漏洩の誘導

## 検出ロジック

### 隠しプロンプト検出

```typescript
function detectHiddenPrompts(document: Document): HiddenPrompt[] {
  const suspiciousPatterns = [
    /ignore.*previous.*instructions?/i,
    /you.*are.*now/i,
    /system.*prompt/i,
    /override.*safety/i,
    /admin.*mode/i,
    /developer.*mode/i,
  ];

  const results: HiddenPrompt[] = [];

  // 1. 隠し要素のスキャン
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    const style = window.getComputedStyle(el);
    const isHidden =
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      parseFloat(style.fontSize) < 2;

    if (isHidden && el.textContent) {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(el.textContent)) {
          results.push({
            element: el,
            text: el.textContent,
            reason: 'hidden_suspicious_text'
          });
        }
      }
    }
  }

  // 2. data-*属性のスキャン
  for (const el of allElements) {
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-')) {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(attr.value)) {
            results.push({
              element: el,
              text: attr.value,
              reason: 'suspicious_data_attribute'
            });
          }
        }
      }
    }
  }

  return results;
}
```

## 実装ファイル

```
packages/battacker/
├── signatures/
│   └── ai-security/
│       ├── index.ts
│       ├── prompt-injection.ts
│       ├── agent-hijacking.ts
│       ├── context-poisoning.ts
│       └── tool-abuse.ts
└── categories/
    └── ai-security.ts
```

## テスト計画

### ユニットテスト
- 各シグネチャの検出精度テスト
- 誤検知率のテスト
- パフォーマンステスト

### 統合テスト
- BrowserTotalの同等テストとの比較
- 実際のAIブラウザ（Claude, Cursor等）での動作確認

## 優先度

**最優先**: AIブラウザの普及に伴い、この種の攻撃は増加傾向

## 関連ADR

- 新規ADR作成が必要: `docs/adr/029-battacker-ai-security.md`

## 参考資料

- [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Prompt Injection Attacks](https://simonwillison.net/2022/Sep/12/prompt-injection/)
- [AI Agent Security](https://www.anthropic.com/research/building-safe-ai-systems)
