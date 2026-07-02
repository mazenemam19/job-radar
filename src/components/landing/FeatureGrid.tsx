// src/components/landing/FeatureGrid.tsx
// Server Component — feature grid shown on the landing page

const FEATURES = [
  {
    icon: "🧠",
    title: "AI-powered filtering",
    desc: "Your own Gemini API key and custom prompt. Job radar passes all fetched jobs through your filter before you ever see them.",
  },
  {
    icon: "🎯",
    title: "Per-skill scoring",
    desc: "Expert skills (React, TypeScript) score 3×. Recency and relocation bonus combine into one weighted total. Fully configurable.",
  },
  {
    icon: "🔭",
    title: "Pipeline transparency",
    desc: "See exactly how many jobs were fetched, date-filtered, settings-filtered, and AI-filtered. Understand why your feed looks the way it does.",
  },
  {
    icon: "📋",
    title: "Application tracker",
    desc: "Track Applied → Interviewing → Offer or Ghosted. All with a job snapshot that persists even after jobs expire from the pool.",
  },
  {
    icon: "💼",
    title: "Salary crowdsourcing",
    desc: "Anonymous salary reports from the community. Aggregated by role, experience band, and pipeline. Helps everyone get paid fairly.",
  },
  {
    icon: "⚡",
    title: "Instant after first load",
    desc: "Gemini runs once after each cron run and the results are cached. All subsequent dashboard opens are instant.",
  },
];

export default function FeatureGrid() {
  return (
    <section className="relative z-10 mx-auto max-w-[960px] px-8 py-20">
      <div className="mb-12 text-center">
        <h2 className="m-0 font-bold text-slate-200" style={{ fontSize: "clamp(22px, 3vw, 32px)" }}>
          Everything you need. Nothing you don&apos;t.
        </h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
        {FEATURES.map((f, i) => (
          <div
            key={i}
            className="feat-card rounded-2xl border border-white/5 bg-[#0d0d1a]/60 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.3)] backdrop-blur-xl"
            style={{ willChange: "transform" }}
          >
            <div className="mb-3 text-[28px]">{f.icon}</div>
            <h3 className="m-0 mb-2 text-base font-semibold text-slate-200">{f.title}</h3>
            <p className="m-0 text-[13px] leading-relaxed text-slate-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
