import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  Eye,
  AlertTriangle,
  Zap,
  Lock,
  LayoutDashboard,
  ChevronRight,
  Menu,
  X,
  ArrowLeft,
  Download,
  Server,
  Database,
  Chrome,
  Globe,
  FileText,
} from 'lucide-react';
import Footer from '../components/Footer';

// Types
interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  subsections?: { id: string; title: string }[];
}

// Navigation items
const docSections: DocSection[] = [
  {
    id: 'overview',
    title: '概要',
    icon: FileText,
  },
  {
    id: 'getting-started',
    title: 'インストール',
    icon: Download,
  },
  {
    id: 'features',
    title: '機能',
    icon: Zap,
    subsections: [
      { id: 'shadow-it', title: 'Shadow IT検出' },
      { id: 'csp', title: 'CSP監視' },
      { id: 'phishing', title: 'フィッシング検出' },
      { id: 'ai-prompt', title: 'AIプロンプト監視' },
      { id: 'auth', title: '認証フロー検出' },
      { id: 'dashboard', title: 'ダッシュボード' },
    ],
  },
  {
    id: 'architecture',
    title: 'アーキテクチャ',
    icon: Server,
    subsections: [
      { id: 'browser-only', title: 'ブラウザ完結型設計' },
      { id: 'detection-only', title: '検出のみアプローチ' },
      { id: 'tech-stack', title: '技術スタック' },
    ],
  },
  {
    id: 'privacy',
    title: 'プライバシー',
    icon: Lock,
  },
];

// Sidebar Component
const Sidebar = ({
  activeSection,
  onSectionChange,
  isMobileOpen,
  onMobileClose,
}: {
  activeSection: string;
  onSectionChange: (id: string) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['features', 'architecture'])
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-white dark:bg-[#0a0a0a] border-r border-[#eaeaea] dark:border-[#333] z-50
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#eaeaea] dark:border-[#333]">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#171717] dark:text-[#ededed]" />
            <span className="font-medium text-[#171717] dark:text-[#ededed]">
              Pleno Audit
            </span>
          </Link>
          <button
            onClick={onMobileClose}
            className="lg:hidden p-2 rounded-lg hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a]"
          >
            <X className="h-5 w-5 text-[#666] dark:text-[#8f8f8f]" />
          </button>
        </div>

        {/* Back to Home */}
        <div className="p-4 border-b border-[#eaeaea] dark:border-[#333]">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-[#666] dark:text-[#8f8f8f] hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>ホームに戻る</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 overflow-y-auto h-[calc(100%-120px)]">
          <ul className="space-y-1">
            {docSections.map((section) => {
              const Icon = section.icon;
              const isExpanded = expandedSections.has(section.id);
              const isActive = activeSection === section.id;

              return (
                <li key={section.id}>
                  <button
                    onClick={() => {
                      if (section.subsections) {
                        toggleSection(section.id);
                      }
                      onSectionChange(section.id);
                    }}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                      ${isActive
                        ? 'bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#171717] dark:text-[#ededed]'
                        : 'text-[#666] dark:text-[#8f8f8f] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] hover:text-[#171717] dark:hover:text-[#ededed]'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{section.title}</span>
                    </div>
                    {section.subsections && (
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''
                          }`}
                      />
                    )}
                  </button>

                  {/* Subsections */}
                  {section.subsections && isExpanded && (
                    <ul className="mt-1 ml-6 space-y-1">
                      {section.subsections.map((sub) => (
                        <li key={sub.id}>
                          <button
                            onClick={() => onSectionChange(sub.id)}
                            className={`
                              w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                              ${activeSection === sub.id
                                ? 'bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#171717] dark:text-[#ededed]'
                                : 'text-[#666] dark:text-[#8f8f8f] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a]'
                              }
                            `}
                          >
                            {sub.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
};

// Feature Card for docs
const FeatureDocCard = ({
  id,
  icon: Icon,
  title,
  description,
  details,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  details: string[];
}) => (
  <div id={id} className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6 scroll-mt-20">
    <div className="mb-4 inline-flex rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a] p-3">
      <Icon className="h-6 w-6 text-[#171717] dark:text-[#ededed]" />
    </div>
    <h3 className="mb-2 text-lg font-medium text-[#171717] dark:text-[#ededed]">
      {title}
    </h3>
    <p className="text-[#666] dark:text-[#8f8f8f] mb-4">{description}</p>
    <ul className="space-y-2">
      {details.map((detail, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-[#666] dark:text-[#8f8f8f]">
          <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{detail}</span>
        </li>
      ))}
    </ul>
  </div>
);

// Content Sections
const OverviewSection = () => (
  <section id="overview" className="space-y-6">
    <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
      概要
    </h1>
    <p className="text-lg text-[#666] dark:text-[#8f8f8f]">
      ブラウザのセキュリティ状態を可視化するChrome拡張機能。
      サーバー不要で、データは端末内に保存される。
    </p>

    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-[#fafafa] dark:bg-[#111] p-6">
        <Globe className="h-8 w-8 text-[#171717] dark:text-[#ededed] mb-4" />
        <h3 className="text-lg font-medium text-[#171717] dark:text-[#ededed] mb-2">
          ブラウザ完結型
        </h3>
        <p className="text-[#666] dark:text-[#8f8f8f]">
          サーバー不要。インストールするだけで即座に利用開始できます。
        </p>
      </div>
      <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-[#fafafa] dark:bg-[#111] p-6">
        <Lock className="h-8 w-8 text-[#171717] dark:text-[#ededed] mb-4" />
        <h3 className="text-lg font-medium text-[#171717] dark:text-[#ededed] mb-2">
          プライバシー重視
        </h3>
        <p className="text-[#666] dark:text-[#8f8f8f]">
          ブラウジングデータは端末に留まり、外部に送信されません。
        </p>
      </div>
    </div>

    <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
      <h3 className="text-lg font-medium text-[#171717] dark:text-[#ededed] mb-4">
        主な特徴
      </h3>
      <ul className="space-y-3">
        {[
          'Shadow IT（未許可SaaS）の検出と可視化',
          'Content Security Policy（CSP）違反の監視',
          'フィッシングサイト・悪意あるドメインの検出',
          'AIサービスへのプロンプト送信の監視',
          'OAuth/SAMLなどの認証フローの検出',
          'セキュリティイベントの一元管理ダッシュボード',
        ].map((item, i) => (
          <li key={i} className="flex items-center gap-3 text-[#666] dark:text-[#8f8f8f]">
            <div className="h-1.5 w-1.5 rounded-full bg-[#171717] dark:bg-[#ededed]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  </section>
);

const GettingStartedSection = () => (
  <section id="getting-started" className="space-y-6">
    <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
      インストール
    </h1>

    <div className="space-y-8">
      <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#0a0a0a] font-medium">
            1
          </div>
          <h3 className="text-lg font-medium text-[#171717] dark:text-[#ededed]">
            Chrome拡張機能をインストール
          </h3>
        </div>
        <p className="text-[#666] dark:text-[#8f8f8f] mb-4">
          Chrome Web Storeから拡張機能をインストールします。
        </p>
        <a
          href="https://github.com/HikaruEgashira/pleno-audit/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#0a0a0a] text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#cccccc] transition-colors whitespace-nowrap"
        >
          <Chrome className="h-4 w-4" />
          <span>Chrome Web Storeを開く</span>
        </a>
      </div>

      <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#0a0a0a] font-medium">
            2
          </div>
          <h3 className="text-lg font-medium text-[#171717] dark:text-[#ededed]">
            拡張機能を有効化
          </h3>
        </div>
        <p className="text-[#666] dark:text-[#8f8f8f]">
          インストール後、ブラウザのツールバーにシールドアイコンが表示されます。
          クリックしてポップアップを開き、初期設定を完了してください。
        </p>
      </div>

      <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#0a0a0a] font-medium">
            3
          </div>
          <h3 className="text-lg font-medium text-[#171717] dark:text-[#ededed]">
            ダッシュボードを確認
          </h3>
        </div>
        <p className="text-[#666] dark:text-[#8f8f8f]">
          ポップアップから「ダッシュボードを開く」をクリックすると、
          検出されたセキュリティイベントを一覧で確認できます。
        </p>
      </div>
    </div>
  </section>
);

const FeaturesSection = () => (
  <section id="features" className="space-y-8">
    <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
      機能
    </h1>

    <div className="space-y-8">
      <FeatureDocCard
        id="shadow-it"
        icon={Eye}
        title="Shadow IT検出"
        description="IT部門が把握していないSaaSの利用状況を可視化。"
        details={[
          'ログインページの検出（URLパターン、フォーム構造）',
          'セッションCookieの検出',
          'プライバシーポリシー・利用規約のリンク検出',
          'サービス分類（AI、ストレージ、コミュニケーション等）',
        ]}
      />

      <FeatureDocCard
        id="csp"
        icon={Shield}
        title="CSP監視"
        description="CSP違反イベントを記録し、ポリシー改善に役立てる。"
        details={[
          'CSP違反イベントのリアルタイム検出',
          '違反タイプ別の分類（script-src、img-src等）',
          'ポリシー生成のサポート',
          'SQLiteによるローカルストレージで高速な分析',
        ]}
      />

      <FeatureDocCard
        id="phishing"
        icon={AlertTriangle}
        title="フィッシング検出"
        description="新規登録ドメインやTyposquattingを検出。"
        details={[
          'NRD（Newly Registered Domain）検出',
          'Typosquatting検出（有名サービスの類似ドメイン）',
          'URLパターンマッチング',
        ]}
      />

      <FeatureDocCard
        id="ai-prompt"
        icon={Zap}
        title="AIプロンプト監視"
        description="ChatGPT等へのプロンプト送信を記録。機密情報の流出リスクを把握。"
        details={[
          'ChatGPT、Claude、Gemini等のAIサービスを自動検出',
          'リクエスト構造による汎用検出（URLパターン非依存）',
          'プロンプト送信・レスポンス受信のログ記録',
        ]}
      />

      <FeatureDocCard
        id="auth"
        icon={Lock}
        title="認証フロー検出"
        description="OAuth/SAML等の認証イベントを記録。"
        details={[
          'OAuthフローの検出（authorization_code、implicit等）',
          'SAMLアサーションの検出',
          'SSOログインの追跡',
        ]}
      />

      <FeatureDocCard
        id="dashboard"
        icon={LayoutDashboard}
        title="ダッシュボード"
        description="検出イベントの一覧表示とフィルタリング。"
        details={[
          'リアルタイムのイベント表示',
          'フィルタリング・検索機能',
          'SQLiteによる高速なクエリ処理',
          'ダークモード対応',
        ]}
      />
    </div>
  </section>
);

const ArchitectureSection = () => (
  <section id="architecture" className="space-y-8">
    <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
      アーキテクチャ
    </h1>

    <div className="space-y-8">
      <div id="browser-only" className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
        <h2 className="text-xl font-medium text-[#171717] dark:text-[#ededed] mb-4">
          ブラウザ完結型設計
        </h2>
        <p className="text-[#666] dark:text-[#8f8f8f]">
          サーバー連携不要のため、インストールするだけで使い始められる。
          データは端末のIndexedDB/SQLiteに保存され、外部に送信されない。
        </p>
      </div>

      <div id="detection-only" className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
        <h2 className="text-xl font-medium text-[#171717] dark:text-[#ededed] mb-4">
          検出のみ
        </h2>
        <p className="text-[#666] dark:text-[#8f8f8f] mb-4">
          デフォルトではブロックしないため、誤検知を気にせずに気軽に導入できます。
        </p>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-center py-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#e6f4ff] dark:bg-[#0a2a3d] text-[#0050b3] dark:text-[#60a5fa]">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">検出</span>
          </div>
          <ChevronRight className="h-5 w-5 text-[#666] dark:text-[#8f8f8f] rotate-90 md:rotate-0" />
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#d3f9d8] dark:bg-[#0a3d1a] text-[#0a7227] dark:text-[#4ade80]">
            <LayoutDashboard className="h-4 w-4" />
            <span className="text-sm font-medium">可視化</span>
          </div>
          <ChevronRight className="h-5 w-5 text-[#666] dark:text-[#8f8f8f] rotate-90 md:rotate-0" />
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#fff8e6] dark:bg-[#3d2e0a] text-[#915b00] dark:text-[#fbbf24]">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">レポート</span>
          </div>
        </div>
      </div>

      <div id="tech-stack" className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
        <h2 className="text-xl font-medium text-[#171717] dark:text-[#ededed] mb-4">
          技術スタック
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] dark:border-[#333]">
                <th className="text-left py-3 px-4 font-medium text-[#171717] dark:text-[#ededed]">項目</th>
                <th className="text-left py-3 px-4 font-medium text-[#171717] dark:text-[#ededed]">選択</th>
              </tr>
            </thead>
            <tbody className="text-[#666] dark:text-[#8f8f8f]">
              <tr className="border-b border-[#eaeaea] dark:border-[#333]">
                <td className="py-3 px-4">拡張機能</td>
                <td className="py-3 px-4">Chrome Manifest V3</td>
              </tr>
              <tr className="border-b border-[#eaeaea] dark:border-[#333]">
                <td className="py-3 px-4">ビルド</td>
                <td className="py-3 px-4">WXT</td>
              </tr>
              <tr className="border-b border-[#eaeaea] dark:border-[#333]">
                <td className="py-3 px-4">UI</td>
                <td className="py-3 px-4">Preact</td>
              </tr>
              <tr className="border-b border-[#eaeaea] dark:border-[#333]">
                <td className="py-3 px-4">DB</td>
                <td className="py-3 px-4">sql.js (SQLite WASM)</td>
              </tr>
              <tr>
                <td className="py-3 px-4">言語</td>
                <td className="py-3 px-4">TypeScript</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
        <h2 className="text-xl font-medium text-[#171717] dark:text-[#ededed] mb-4">
          パッケージ構成
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 mt-0.5 text-[#666] dark:text-[#8f8f8f]" />
            <div>
              <h4 className="font-medium text-[#171717] dark:text-[#ededed]">packages/detectors</h4>
              <p className="text-sm text-[#666] dark:text-[#8f8f8f]">CASBドメイン（サービス検出、認証検出）</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 mt-0.5 text-[#666] dark:text-[#8f8f8f]" />
            <div>
              <h4 className="font-medium text-[#171717] dark:text-[#ededed]">packages/csp</h4>
              <p className="text-sm text-[#666] dark:text-[#8f8f8f]">CSP監査（違反検出、ポリシー生成）</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 text-[#666] dark:text-[#8f8f8f]" />
            <div>
              <h4 className="font-medium text-[#171717] dark:text-[#ededed]">packages/nrd, typosquat</h4>
              <p className="text-sm text-[#666] dark:text-[#8f8f8f]">ドメイン検出アルゴリズム</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 mt-0.5 text-[#666] dark:text-[#8f8f8f]" />
            <div>
              <h4 className="font-medium text-[#171717] dark:text-[#ededed]">packages/ai-detector</h4>
              <p className="text-sm text-[#666] dark:text-[#8f8f8f]">AIサービス検出アルゴリズム</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Server className="h-5 w-5 mt-0.5 text-[#666] dark:text-[#8f8f8f]" />
            <div>
              <h4 className="font-medium text-[#171717] dark:text-[#ededed]">packages/api</h4>
              <p className="text-sm text-[#666] dark:text-[#8f8f8f]">REST API（Hono + sql.js）</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Chrome className="h-5 w-5 mt-0.5 text-[#666] dark:text-[#8f8f8f]" />
            <div>
              <h4 className="font-medium text-[#171717] dark:text-[#ededed]">app/extension</h4>
              <p className="text-sm text-[#666] dark:text-[#8f8f8f]">Chrome拡張機能（WXT + Preact）</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const PrivacySection = () => (
  <section id="privacy" className="space-y-6">
    <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
      プライバシー
    </h1>

    <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
      <h2 className="text-xl font-medium text-[#171717] dark:text-[#ededed] mb-4">
        データの取り扱い
      </h2>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-[#d3f9d8] dark:bg-[#0a3d1a] flex-shrink-0 mt-0.5">
            <Lock className="h-3 w-3 text-[#0a7227] dark:text-[#4ade80]" />
          </div>
          <div>
            <h4 className="font-medium text-[#171717] dark:text-[#ededed]">
              端末内完結
            </h4>
            <p className="text-sm text-[#666] dark:text-[#8f8f8f]">
              データは端末内のIndexedDB/SQLiteに保存。外部送信なし。
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-[#d3f9d8] dark:bg-[#0a3d1a] flex-shrink-0 mt-0.5">
            <Lock className="h-3 w-3 text-[#0a7227] dark:text-[#4ade80]" />
          </div>
          <div>
            <h4 className="font-medium text-[#171717] dark:text-[#ededed]">
              ユーザー管理
            </h4>
            <p className="text-sm text-[#666] dark:text-[#8f8f8f]">
              アンインストール時にデータ削除。
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-[#e6f4ff] dark:bg-[#0a2a3d] flex-shrink-0 mt-0.5">
            <Eye className="h-3 w-3 text-[#0050b3] dark:text-[#60a5fa]" />
          </div>
          <div>
            <h4 className="font-medium text-[#171717] dark:text-[#ededed]">
              サーバー連携（予定）
            </h4>
            <p className="text-sm text-[#666] dark:text-[#8f8f8f]">
              企業向けにオプションで提供予定。送信データはユーザー確認を経る。
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// Subsection IDs that should trigger scroll
const subsectionIds = new Set([
  'shadow-it',
  'csp',
  'phishing',
  'ai-prompt',
  'auth',
  'dashboard',
  'browser-only',
  'detection-only',
  'tech-stack',
]);

// Main Component
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Scroll to subsection when selected
  useEffect(() => {
    if (subsectionIds.has(activeSection)) {
      // Wait for DOM update
      setTimeout(() => {
        const element = document.getElementById(activeSection);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [activeSection]);

  // Get the main section key for motion animation (to avoid re-mount on subsection click)
  const getMainSectionKey = () => {
    if (['shadow-it', 'csp', 'phishing', 'ai-prompt', 'auth', 'dashboard'].includes(activeSection)) {
      return 'features';
    }
    if (['browser-only', 'detection-only', 'tech-stack'].includes(activeSection)) {
      return 'architecture';
    }
    return activeSection;
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewSection />;
      case 'getting-started':
        return <GettingStartedSection />;
      case 'features':
      case 'shadow-it':
      case 'csp':
      case 'phishing':
      case 'ai-prompt':
      case 'auth':
      case 'dashboard':
        return <FeaturesSection />;
      case 'architecture':
      case 'browser-only':
      case 'detection-only':
      case 'tech-stack':
        return <ArchitectureSection />;
      case 'privacy':
        return <PrivacySection />;
      default:
        return <OverviewSection />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0a0a0a]">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-[#0a0a0a] border-b border-[#eaeaea] dark:border-[#333] z-30 flex items-center px-4">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 rounded-lg hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a]"
        >
          <Menu className="h-5 w-5 text-[#666] dark:text-[#8f8f8f]" />
        </button>
        <span className="ml-3 font-medium text-[#171717] dark:text-[#ededed]">
          ドキュメント
        </span>
      </header>

      <div className="flex flex-1">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={(id) => {
            setActiveSection(id);
            setIsMobileMenuOpen(false);
          }}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        {/* Main content */}
        <main className="flex-1 pt-14 lg:pt-0 lg:ml-72">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <motion.div
              key={getMainSectionKey()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
