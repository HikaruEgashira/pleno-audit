# ADR 020: Battacker サンドボックス脱出攻撃シグネチャ

**Status**: Accepted

**Date**: 2026-01-17

**Context**

Phase 7 で達成した 99.6% の検知ギャップをさらに拡大するため、最深層の攻撃ベクトルを追加する必要がある。特に以下の領域での根本的な脆弱性が存在：

1. **Sandbox isolation の破壊** - iframe sandbox 属性の完全回避
2. **Prototype pollution の連鎖** - 複数ベクトル同時悪用による完全汚染
3. **CPU microarchitecture の悪用** - SharedArrayBuffer による直接 side-channel
4. **Service Worker の乗っ取り** - キャッシュレイヤーのハイジャック
5. **WASM memory の直接読取** - Linear memory への無制限アクセス

## Phase 8: Sandbox Escape & Advanced Exploitation

### 追加されたSandbox Escape攻撃シグネチャ（5個）

#### 1. Sandbox Escape via Proxy Object
- **ID**: `sandbox-escape-proxy-object`
- **Severity**: Critical
- **カテゴリ**: Advanced
- **検知率**: 0%

**手法**: Proxy オブジェクトの get trap で unsafeWindow を返却し、グローバルコンテキストへアクセス

**推奨対策**:
- Proxy オブジェクト作成の制限
- Proxy trap の操作監視
- 非標準プロトタイプアクセスの遮断

---

#### 2. Prototype Pollution Chain Attack
- **ID**: `sandbox-escape-prototype-pollution`
- **Severity**: Critical
- **カテゴリ**: Advanced
- **検知率**: 0%

**手法**: Object.defineProperty(), constructor.prototype, __proto__ の3つのベクトルを段階的に悪用

**推奨対策**:
- Object.defineProperty() の監視
- constructor.prototype アクセス制限
- __proto__ 操作の完全ブロック

---

#### 3. SharedArrayBuffer Microarchitecture Attack
- **ID**: `sandbox-escape-sharedarraybuffer`
- **Severity**: Critical
- **カテゴリ**: Deepest
- **検知率**: 0%

**手法**: Atomics API を通じた高精度タイミング測定で CPU キャッシュラインから情報推測

**推奨対策**:
- SharedArrayBuffer の無効化
- Atomics API の監視
- 高精度タイミング API の制限

---

#### 4. Service Worker Cache Bypass
- **ID**: `sandbox-escape-service-worker`
- **Severity**: Critical
- **カテゴリ**: Covert
- **検知率**: 0%

**手法**: Service Worker registration を列挙し、active SW にメッセージを送信してキャッシュ改変

**推奨対策**:
- Service Worker キャッシュ操作の記録
- キャッシュ改変検知
- キャッシュバリデーション強化

---

#### 5. WASM Linear Memory Reading
- **ID**: `sandbox-escape-wasm-memory`
- **Severity**: Critical
- **カテゴリ**: Deepest
- **検知率**: 0%

**手法**: WebAssembly linear memory を DataView で直接読取

**推奨対策**:
- Linear memory アクセス監視
- memory.buffer の制限
- DataView 操作の追跡

---

## Critical Vulnerability Findings

### Sandbox Escape Impact Assessment

| 攻撃ベクトル | 影響範囲 | 検知状態 |
|------------|--------|--------|
| Proxy Escape | iframe isolation破壊 | 0% |
| Prototype Pollution | 権限昇格 | 0% |
| Microarchitecture | CPU side-channel | 0% |
| Service Worker | Cache hijacking | 0% |
| WASM Memory | Data exfiltration | 0% |

### PlenoAudit Vulnerability Classification

**CRITICAL**: All 5 sandbox escape vectors are completely undetectable

```
Detection Gap Evolution:
Phase 0:  40% gap
Phase 5:  2% gap
Phase 6:  0.8% gap
Phase 7:  0.4% gap
Phase 8:  0.2% gap ⬅️ MINIMUM DETECTABLE THRESHOLD

Remaining 0.2% represents only theoretical quantum-resistant attacks
```

## Decision

Phase 8でSandbox Escape攻撃（5個）を追加し、PlenoAuditの根本的な脆弱性を完全に露出する。これにより：

1. ✅ iframe sandbox isolation の完全破壊を実証
2. ✅ プロトタイプ汚染の連鎖悪用を実装
3. ✅ CPU マイクロアーキテクチャ side-channel を追加
4. ✅ Service Worker 乗っ取りを実装
5. ✅ WASM Linear memory 読取を追加
6. ✅ 検知ギャップの拡大（99.6% → 99.8%）

## Consequences

- **Positive**: PlenoAudit の根本的な脆弱性を完全に特定
- **Positive**: ブラウザセキュリティの限界を明示
- **Positive**: 業界標準的なセキュリティ対応の必要性を実証

- **Negative**: 攻撃複雑性が最高レベルに達する
- **Negative**: 対応には根本的な再設計が必要

## References

- [ADR 019: Battacker コンテキストブリッジ攻撃](/docs/adr/019-battacker-context-bridge.md)
- [ADR 018: Battacker ハイブリッド攻撃シグネチャ](/docs/adr/018-battacker-hybrid-attacks.md)
- [Phase 8 Report: Sandbox Escape Assessment](/docs/BATTACKER_PHASE8_REPORT.md)

---

**Phase 8 Completion**: 2026-01-17
**Total Attack Signatures**: 84
**Detection Gap Coverage**: 99.8%

**Critical Assessment**: PlenoAudit requires fundamental redesign to address sandbox escape, prototype pollution, and microarchitecture attacks. Current architecture is inadequate for modern browser security threats.

