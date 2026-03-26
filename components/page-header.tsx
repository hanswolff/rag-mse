import { TargetIcon } from "@/components/icons";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="page-header">
      <div className="page-header-media" aria-hidden="true" />
      <div className="page-header-pattern" aria-hidden="true" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        <span className="hidden sm:inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-semibold uppercase tracking-[0.22em] text-brand-gold-400">
          <TargetIcon className="mr-2 h-4 w-4" />
          RAG Schießsport MSE
        </span>
        <h1 className="sm:mt-4 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-base text-brand-blue-100 sm:text-lg">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
