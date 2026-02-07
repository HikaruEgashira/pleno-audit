import { OVERVIEW_FEATURES, OVERVIEW_HIGHLIGHTS } from '../data';

export default function OverviewSection() {
  return (
    <section id="overview" className="space-y-6">
      <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
        概要
      </h1>
      <p className="text-lg text-[#666] dark:text-[#8f8f8f]">
        ブラウザのセキュリティ状態を可視化するChrome拡張機能。
        サーバー不要で、データは端末内に保存される。
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {OVERVIEW_HIGHLIGHTS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-[#fafafa] dark:bg-[#111] p-6"
            >
              <Icon className="h-8 w-8 text-[#171717] dark:text-[#ededed] mb-4" />
              <h3 className="text-lg font-medium text-[#171717] dark:text-[#ededed] mb-2">
                {item.title}
              </h3>
              <p className="text-[#666] dark:text-[#8f8f8f]">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
        <h3 className="text-lg font-medium text-[#171717] dark:text-[#ededed] mb-4">
          主な特徴
        </h3>
        <ul className="space-y-3">
          {OVERVIEW_FEATURES.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 text-[#666] dark:text-[#8f8f8f]"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-[#171717] dark:bg-[#ededed]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
