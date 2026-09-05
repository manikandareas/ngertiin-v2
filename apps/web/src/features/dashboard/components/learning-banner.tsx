export function LearningBanner() {
  return (
    <section
      aria-labelledby="learning-banner-heading"
      className="relative mb-8 isolate overflow-hidden rounded-card border-2 border-spark-blue/30 bg-linear-to-br from-[color-mix(in_srgb,var(--color-spark-blue)_35%,var(--color-night-ink))] to-night-ink px-6 py-7 text-paper-white sm:min-h-44 sm:px-8 sm:py-8"
    >
      <div className="relative space-y-3 pb-12 text-left sm:pb-4 sm:pr-20">
        <h2
          id="learning-banner-heading"
          className="font-display text-heading-sm font-extrabold max-w-[16rem]"
        >
          Hal baru menunggu untuk dipahami.
        </h2>
        <p className="max-w-xs text-base leading-relaxed text-paper-white/80">
          Ikuti rasa penasaranmu. Pilih modul dan mulai belajar hari ini.
        </p>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-5 -bottom-8 -z-10 grid size-28 -rotate-12 place-items-center rounded-[38%_62%_32%_68%/55%_40%_60%_45%] bg-linear-to-br from-spark-blue to-primary-edge sm:size-32"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 64 64"
          fill="none"
          className="mb-5 size-14 text-paper-white sm:size-16"
        >
          <path
            d="M32 18C25 13 16 12 7 14v34c9-2 18-1 25 4 7-5 16-6 25-4V14c-9-2-18-1-25 4Z"
            fill="currentColor"
          />
          <path
            d="M32 20v26M15 23c4 0 7 1 10 2M15 31c4 0 7 1 10 2M39 25c3-1 6-2 10-2M39 33c3-1 6-2 10-2"
            className="stroke-primary-edge"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </section>
  );
}
