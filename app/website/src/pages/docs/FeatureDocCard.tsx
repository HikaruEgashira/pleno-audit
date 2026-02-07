import { ChevronRight } from 'lucide-react';
import type { FeatureCard } from './types';

interface FeatureDocCardProps extends FeatureCard {}

export default function FeatureDocCard({
  id,
  icon: Icon,
  title,
  description,
  details,
}: FeatureDocCardProps) {
  return (
    <div
      id={id}
      className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6 scroll-mt-20"
    >
      <div className="mb-4 inline-flex rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a] p-3">
        <Icon className="h-6 w-6 text-[#171717] dark:text-[#ededed]" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-[#171717] dark:text-[#ededed]">
        {title}
      </h3>
      <p className="text-[#666] dark:text-[#8f8f8f] mb-4">{description}</p>
      <ul className="space-y-2">
        {details.map((detail) => (
          <li
            key={detail}
            className="flex items-start gap-2 text-sm text-[#666] dark:text-[#8f8f8f]"
          >
            <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
