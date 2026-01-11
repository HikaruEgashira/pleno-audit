import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, ArrowRight, Eye, AlertTriangle, Zap, Chrome, Github } from 'lucide-react';

const GITHUB_URL = 'https://github.com/HikaruEgashira/pleno-audit';

// Button Component
const Button = ({
  variant = 'primary',
  size = 'medium',
  children,
  suffix,
  onClick,
  to,
}: {
  variant?: 'primary' | 'secondary';
  size?: 'medium' | 'large';
  children: React.ReactNode;
  suffix?: React.ReactNode;
  onClick?: () => void;
  to?: string;
}) => {
  const sizeClasses = {
    medium: 'px-4 h-10 text-sm',
    large: 'px-6 h-12 text-base',
  };

  const variantClasses = {
    primary:
      'bg-[#171717] dark:bg-[#ededed] hover:bg-[#383838] dark:hover:bg-[#cccccc] text-white dark:text-[#0a0a0a]',
    secondary:
      'bg-white dark:bg-[#171717] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] text-[#171717] dark:text-[#ededed] border border-[#eaeaea] dark:border-[#333]',
  };

  const className = `flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150 ${sizeClasses[size]} ${variantClasses[variant]}`;

  if (to) {
    return (
      <Link to={to} className={className}>
        <span>{children}</span>
        {suffix}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      <span>{children}</span>
      {suffix}
    </button>
  );
};

// Feature Card Component
const FeatureCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) => (
  <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
    <div className="mb-4 inline-flex rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a] p-3">
      <Icon className="h-6 w-6 text-[#171717] dark:text-[#ededed]" />
    </div>
    <h3 className="mb-2 text-lg font-medium text-[#171717] dark:text-[#ededed]">{title}</h3>
    <p className="text-[#666] dark:text-[#8f8f8f]">{description}</p>
  </div>
);

// Hero Section
const HeroSection = () => (
  <section className="relative w-full overflow-hidden bg-white dark:bg-[#0a0a0a] pb-16 pt-32 md:pb-24 md:pt-40">
    <div
      className="absolute right-0 top-0 h-1/2 w-1/2"
      style={{
        background:
          'radial-gradient(circle at 70% 30%, rgba(23, 23, 23, 0.05) 0%, rgba(255, 255, 255, 0) 60%)',
      }}
    />

    <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] px-4 py-2 text-sm">
          <Shield className="h-4 w-4 text-[#171717] dark:text-[#ededed]" />
          <span className="text-[#171717] dark:text-[#ededed]">Personal Browser Security</span>
        </div>

        <h1 className="mx-auto mb-6 max-w-4xl text-5xl font-normal tracking-tight text-[#171717] dark:text-[#ededed] md:text-6xl lg:text-7xl">
          Secure Your Browser.
          <br />
          <span className="text-[#666] dark:text-[#8f8f8f]">Protect Your Data.</span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-[#666] dark:text-[#8f8f8f] md:text-xl">
          フィッシングサイトやプライバシーリスクをリアルタイムで検出し、
          あなたのブラウジングを守るセキュリティ拡張機能
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="primary" size="large" suffix={<Chrome className="h-4 w-4" />}>
            Chrome拡張をインストール
          </Button>
          <Button variant="secondary" size="large" suffix={<ArrowRight className="h-4 w-4" />} to="/docs">
            詳しく見る
          </Button>
        </div>
      </motion.div>

      <motion.div
        className="relative mt-16 md:mt-24"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
      >
        <div className="relative z-10 mx-auto max-w-5xl overflow-hidden rounded-2xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-2 shadow-lg dark:shadow-none">
          <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#f5f5f5] to-[#e5e5e5] dark:from-[#1a1a1a] dark:to-[#0a0a0a]">
            <div className="flex flex-col items-center gap-4">
              <Lock className="h-16 w-16 text-[#171717] dark:text-[#ededed]" />
              <p className="text-sm text-[#666] dark:text-[#8f8f8f]">Security Dashboard</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

// Features Section
const FeaturesSection = () => (
  <section className="bg-[#fafafa] dark:bg-[#111] py-24">
    <div className="container mx-auto max-w-6xl px-4 md:px-6">
      <motion.div
        className="mb-16 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="mb-4 text-3xl font-normal text-[#171717] dark:text-[#ededed] md:text-4xl">
          主要機能
        </h2>
        <p className="mx-auto max-w-2xl text-[#666] dark:text-[#8f8f8f]">
          あなたのブラウジングを守る機能を搭載
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <FeatureCard
            icon={Eye}
            title="サービス利用可視化"
            description="どのWebサービスを利用しているか一目で把握し、利用状況を可視化します"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <FeatureCard
            icon={Shield}
            title="セキュリティ監視"
            description="Webサイトのセキュリティ設定を自動チェックし、潜在的なリスクを検出"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <FeatureCard
            icon={AlertTriangle}
            title="フィッシング検出"
            description="NRDアルゴリズムとTyposquatting検出で悪意あるドメインを特定"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <FeatureCard
            icon={Zap}
            title="AIプロンプト監視"
            description="ChatGPTなどのAIサービスへの個人情報送信リスクを検出"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <FeatureCard
            icon={Lock}
            title="ログイン追跡"
            description="どのサービスにどの認証方法でログインしているか把握できます"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <FeatureCard
            icon={Eye}
            title="ダッシュボード"
            description="セキュリティ状況を一目で把握できるシンプルな管理画面"
          />
        </motion.div>
      </div>
    </div>
  </section>
);

// Footer
const Footer = () => (
  <footer className="border-t border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#0a0a0a] py-12">
    <div className="container mx-auto max-w-6xl px-4 md:px-6">
      <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#171717] dark:text-[#ededed]" />
            <span className="font-medium text-[#171717] dark:text-[#ededed]">Pleno Audit</span>
          </div>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] transition-colors"
            aria-label="GitHub"
          >
            <Github className="h-5 w-5 text-[#666] dark:text-[#8f8f8f] hover:text-[#171717] dark:hover:text-[#ededed]" />
          </a>
        </div>
        <div className="flex items-center gap-6 text-sm text-[#666] dark:text-[#8f8f8f]">
          <Link
            to="/docs"
            className="hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
          >
            ドキュメント
          </Link>
          <Link
            to="/privacy"
            className="hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
          >
            プライバシーポリシー
          </Link>
          <Link
            to="/terms"
            className="hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
          >
            利用規約
          </Link>
        </div>
      </div>
    </div>
  </footer>
);

// Main App
export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <HeroSection />
      <FeaturesSection />
      <Footer />
    </div>
  );
}
