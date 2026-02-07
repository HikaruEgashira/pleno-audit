import FeatureDocCard from '../FeatureDocCard';
import { FEATURE_CARDS } from '../data';

export default function FeaturesSection() {
  return (
    <section id="features" className="space-y-8">
      <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
        機能
      </h1>

      <div className="space-y-8">
        {FEATURE_CARDS.map((feature) => (
          <FeatureDocCard key={feature.id} {...feature} />
        ))}
      </div>
    </section>
  );
}
