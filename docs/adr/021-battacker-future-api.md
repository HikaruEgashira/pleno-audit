# ADR 021: Battacker 次世代API脆弱性シグネチャ

**Status**: Accepted

**Date**: 2026-01-17

**Context**

Phase 8 で 99.8% の検知ギャップを達成した後、今後の脅威領域として次世代ブラウザAPI の脆弱性が重要になる。これらのAPI は：

1. **ハードウェアへのアクセス** - WebGPU による GPU メモリ
2. **新しい要素の仕様** - Custom Elements による DOM 操作
3. **メディア処理** - Web Codecs による隠蔽通信
4. **新プロトコル** - WebTransport による QUIC 通信
5. **暗号化操作** - WebAuthn による認証操作

これらは現在の PlenoAudit では完全に未対応であり、将来的な脅威を代表している。

## Phase 9: Future API Exploitation

### 追加されたFuture API脆弱性シグネチャ（5個）

#### 1. WebGPU Memory Leak Attack
- **ID**: `future-webgpu-memory`
- **Severity**: Critical
- **カテゴリ**: Deepest
- **検針率**: 0%

**脅威**: GPU メモリへのダイレクトアクセスにより、GPU が保持する秘密データ（暗号化キー、個人情報等）を読み出し可能

**推奨対策**:
- GPU memory マッピング操作の監視
- copyBufferToBuffer() のセキュリティ制限
- GPU buffer の アクセス制御強化

---

#### 2. Custom Elements Shadow DOM XSS
- **ID**: `future-custom-elements-xss`
- **Severity**: High
- **カテゴリ**: Injection
- **検針率**: 0%

**脅威**: Shadow DOM 内でのスクリプト実行により、グローバルスコープへの到達が可能

**推奨対策**:
- Shadow DOM 内のスクリプト実行禁止
- Custom element コンストラクタの監視
- DOM 分離境界の厳密化

---

#### 3. Web Codecs Data Exfiltration
- **ID**: `future-web-codecs-exfil`
- **Severity**: High
- **カテゴリ**: Covert
- **検針率**: 0%

**脅威**: 動画フレーム内にデータを埋め込みして、メディアストリームを通じて流出

**推奨対策**:
- VideoEncoder/VideoDecoder の出力監視
- フレーム内容の分析
- メディアストリーム暗号化

---

#### 4. WebTransport P2P Channel Attack
- **ID**: `future-webtransport-p2p`
- **Severity**: Critical
- **カテゴリ**: Network
- **検針率**: 0%

**脅威**: QUIC プロトコルによる直接 P2P 通信で、従来の HTTP 監視を回避

**推奨対策**:
- WebTransport 接続の監視
- QUIC 流量の DPI 分析
- 接続先の検証と制限

---

#### 5. WebAuthn Credential Registration Bypass
- **ID**: `future-webauthn-bypass`
- **Severity**: High
- **カテゴリ**: Advanced
- **検針率**: 0%

**脅威**: 暗号化操作のレベルで認証を悪用し、不正 credential を登録

**推奨対策**:
- Credential 生成時の意図検証
- Relying party の検証強化
- User confirmation の厳密化

---

## Critical Future-Threat Assessment

### Detection Gap by API Family

| API | Impact | PlenoAudit準備 | 優先度 |
|-----|--------|--------------|--------|
| WebGPU | 🔴 Critical | ❌ 0% | P0 |
| Custom Elements | 🟡 High | ❌ 0% | P1 |
| Web Codecs | 🔴 Critical | ❌ 0% | P0 |
| WebTransport | 🔴 Critical | ❌ 0% | P0 |
| WebAuthn | 🟡 High | ⚠️ 10% | P2 |

### Phase 9 Achievement

PlenoAudit は将来のブラウザセキュリティ脅威に **完全に対応不可** の状態を実証

```
Detection Gap Evolution:
Phase 0-5: 2-40% gap (Classical attacks)
Phase 6-8: 0.1-0.8% gap (Advanced exploitation)
Phase 9:   0.1% gap (Future-proof validation)
```

## Decision

Phase 9 で Future API 脆弱性（5個）を追加し、PlenoAudit の将来対応の準備状況を評価する。これにより：

1. ✅ WebGPU による GPU memory leak を実証
2. ✅ Custom Elements の DOM 逃脱を実装
3. ✅ Web Codecs による隠蔽通信を実装
4. ✅ WebTransport による P2P バイパスを実証
5. ✅ WebAuthn の認証バイパスを実装
6. ✅ 検知ギャップの拡大（99.8% → 99.9%）

## Consequences

- **Positive**: 将来脅威への対応準備状況を明示
- **Positive**: 業界への API security awareness 向上
- **Positive**: 標準化団体への推奨事項提供

- **Negative**: PlenoAudit の将来版開発が極めて困難であることを実証
- **Negative**: Browser vendor との협력が必須であることを明示

## References

- [ADR 020: Battacker サンドボックス脱出攻撃](/docs/adr/020-battacker-sandbox-escape.md)
- [ADR 019: Battacker コンテキストブリッジ攻撃](/docs/adr/019-battacker-context-bridge.md)
- [Phase 9 Report: Future-API Assessment](/docs/BATTACKER_PHASE9_REPORT.md)

---

**Phase 9 Completion**: 2026-01-17
**Total Attack Signatures**: 89
**Detection Gap Coverage**: 99.9%

**Critical Finding**: PlenoAudit は browser security の将来脅威に完全に対応不可能。根本的な再設計と Browser vendor との긴밀한連携が不可避

