import { GETTING_STARTED_STEPS } from '../data';

export default function GettingStartedSection() {
  return (
    <section id="getting-started" className="space-y-6">
      <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
        インストール
      </h1>

      <div className="space-y-8">
        {GETTING_STARTED_STEPS.map((step) => (
          <div
            key={step.step}
            className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#0a0a0a] font-medium">
                {step.step}
              </div>
              <h3 className="text-lg font-medium text-[#171717] dark:text-[#ededed]">
                {step.title}
              </h3>
            </div>
            <p className="text-[#666] dark:text-[#8f8f8f] mb-4">
              {step.description}
            </p>
            {step.cta && (
              <a
                href={step.cta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#0a0a0a] text-sm font-medium hover:bg-[#383838] dark:hover:bg-[#cccccc] transition-colors whitespace-nowrap"
              >
                <step.cta.icon className="h-4 w-4" />
                <span>{step.cta.label}</span>
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
