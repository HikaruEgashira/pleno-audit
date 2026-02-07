import { ChevronRight } from 'lucide-react';
import {
  ARCHITECTURE_CALLOUTS,
  PACKAGE_ITEMS,
  TECH_STACK_ROWS,
} from '../data';

export default function ArchitectureSection() {
  return (
    <section id="architecture" className="space-y-8">
      <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
        アーキテクチャ
      </h1>

      <div className="space-y-8">
        {ARCHITECTURE_CALLOUTS.map((callout) => (
          <div
            key={callout.id}
            id={callout.id}
            className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6"
          >
            <h2 className="text-xl font-medium text-[#171717] dark:text-[#ededed] mb-4">
              {callout.title}
            </h2>
            <p className="text-[#666] dark:text-[#8f8f8f] mb-4">
              {callout.description}
            </p>
            {callout.chips && (
              <div className="flex flex-col md:flex-row gap-4 items-center justify-center py-4">
                {callout.chips.map((chip, index) => {
                  const ChipIcon = chip.icon;
                  return (
                    <div
                      key={chip.label}
                      className="flex items-center gap-4"
                    >
                      <div className={chip.className}>
                        <ChipIcon className={chip.iconClassName} />
                        <span className="text-sm font-medium">{chip.label}</span>
                      </div>
                      {index < callout.chips!.length - 1 && (
                        <ChevronRight className="h-5 w-5 text-[#666] dark:text-[#8f8f8f] rotate-90 md:rotate-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        <div
          id="tech-stack"
          className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6"
        >
          <h2 className="text-xl font-medium text-[#171717] dark:text-[#ededed] mb-4">
            技術スタック
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#eaeaea] dark:border-[#333]">
                  <th className="text-left py-3 px-4 font-medium text-[#171717] dark:text-[#ededed]">
                    項目
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[#171717] dark:text-[#ededed]">
                    選択
                  </th>
                </tr>
              </thead>
              <tbody className="text-[#666] dark:text-[#8f8f8f]">
                {TECH_STACK_ROWS.map((row, index) => (
                  <tr
                    key={row.label}
                    className={
                      index < TECH_STACK_ROWS.length - 1
                        ? 'border-b border-[#eaeaea] dark:border-[#333]'
                        : undefined
                    }
                  >
                    <td className="py-3 px-4">{row.label}</td>
                    <td className="py-3 px-4">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
          <h2 className="text-xl font-medium text-[#171717] dark:text-[#ededed] mb-4">
            パッケージ構成
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {PACKAGE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3">
                  <Icon className="h-5 w-5 mt-0.5 text-[#666] dark:text-[#8f8f8f]" />
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
      </div>
    </section>
  );
}
