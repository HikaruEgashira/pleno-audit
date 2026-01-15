# 競合分析

## 市場トレンド（2025年）

1. **GenAI DLPの急務** - 15%の従業員がChatGPTに機密データを共有
2. **ブラウザがラストマイル** - 従来のSWG/CASBの盲点
3. **SSEへの統合** - CASB単体からSSE（SWG+CASB+ZTNA+FWaaS）へ
4. **サプライチェーン攻撃** - ブラウザ拡張機能が標的（Cyberhaven事件）

## エンタープライズCASB/Browser Security

| 競合 | 特徴 | 価格帯 | 弱点 |
|-----|------|-------|------|
| LayerX | Gartner認定、GenAI監視、SaaS DLP、Safe Browsing | カスタム（ユーザー/年） | 高コスト、サーバー依存 |
| Nightfall AI | AI-native DLP、95%精度、ChatGPT/Claude対応 | $4/月〜 | サーバー依存、プライバシー懸念 |
| Cyberhaven | DDR、データリネージ追跡 | エンタープライズ | 2024年12月セキュリティインシデント |
| Netskope | クラウドネイティブCASB、CCI | エンタープライズ | 複雑、高コスト |
| Palo Alto Prisma | SASE統合、Enterprise DLP | エンタープライズ | 導入障壁高い |

### LayerX
- **URL**: https://layerxsecurity.com/
- **強み**: Gartner認定（SEB + AUC両カテゴリ）、AI利用監視、SaaS DLP、Identity Security
- **弱み**: カスタム価格、サーバー依存

### Nightfall AI
- **URL**: https://www.nightfall.ai/
- **強み**: AI-native DLP、100+ AIモデル、95%精度、$4/月から
- **弱み**: サーバー依存、プライバシー懸念

### Cyberhaven
- **URL**: https://www.cyberhaven.com/
- **強み**: DDR（Data Detection and Response）、データリネージ追跡
- **弱み**: 2024年12月のサプライチェーン攻撃（40万ユーザー影響）

## Shadow IT / SaaS Discovery

| 競合 | 特徴 | アプローチ |
|-----|------|----------|
| Trelica | ブラウザ拡張機能でSaaS検出 | サーバー連携必須 |
| Zluri | 9種類の検出方法、125,000+アプリDB | サーバー連携必須 |
| Auvik | Shadow IT/AI検出 | サーバー連携必須 |
| Beamy | 大企業向けWBE | サーバー連携必須 |

## プライバシーファースト/OSS

| 競合 | 特徴 | 差異 |
|-----|------|------|
| uBlock Origin | 広告/トラッカーブロック、OSS | セキュリティ監視なし |
| LibreWolf | プライバシー強化Firefox | ブラウザ全体、拡張機能ではない |
| BrowserOS | ローカルAIエージェント、OSS | セキュリティフォーカスなし |

## Pleno Auditの差別化ポイント

1. **完全ローカル** - 外部通信禁止、プライバシー最優先
2. **オープンソース** - 透明性、信頼性
3. **無料** - 個人ユーザーに無料提供、PMF検証
4. **GenAI特化** - AIプロンプト監視、Shadow AI検出
5. **軽量** - 外部DBなし、ヒューリスティックアルゴリズム

## ポジショニングマップ

```
        高機能
           ↑
   Nightfall │ LayerX
   Cyberhaven│ Netskope
             │
プライバシー ←───────────→ サーバー依存
             │
    Pleno    │ Trelica
    Audit    │ Zluri
             │
           ↓
        シンプル
```

**Pleno Auditのポジション**: プライバシーファースト × シンプル → 高機能へ成長

## 参考リンク

- [LayerX](https://layerxsecurity.com/)
- [Nightfall AI](https://www.nightfall.ai/)
- [Cyberhaven](https://www.cyberhaven.com/)
- [Netskope](https://www.netskope.com/)
- [Palo Alto Enterprise DLP](https://docs.paloaltonetworks.com/enterprise-dlp/)
- [Software Analyst Browser Security Report](https://softwareanalyst.io/reports/agentic-browsers-and-the-new-last-mile-in-cybersecurity-an-enterprise-guide-to-browser-security-in-2025/)
