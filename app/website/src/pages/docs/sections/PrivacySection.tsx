import { PRIVACY_ITEMS } from '../data';

export default function PrivacySection() {
  return (
    <section id="privacy" className="space-y-6">
      <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
        プライバシー
      </h1>

      <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
        <h2 className="text-xl font-medium text-[#171717] dark:text-[#ededed] mb-4">
          データの取り扱い
        </h2>
        <div className="space-y-4">
          {PRIVACY_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-start gap-3">
                <div
                  className={`flex items-center justify-center h-6 w-6 rounded-full flex-shrink-0 mt-0.5 ${item.badgeClassName}`}
                >
                  <Icon className={item.iconClassName} />
                </div>
                <div>
                  <h4 className="font-medium text-[#171717] dark:text-[#ededed]">
                    {item.title}
                  </h4>
                  <p className="text-sm text-[#666] dark:text-[#8f8f8f]">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
