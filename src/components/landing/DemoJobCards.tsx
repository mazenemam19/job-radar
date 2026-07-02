// src/components/landing/DemoJobCards.tsx
// Server Component — sample job cards shown on the landing page

const DEMO_JOBS = [
  {
    title: "Senior Frontend Engineer",
    company: "Vercel",
    flag: "🇺🇸",
    score: 94,
    skills: ["React", "Next.js", "TypeScript"],
    mode: "global" as const,
  },
  {
    title: "React Developer",
    company: "N26",
    flag: "🇩🇪",
    score: 87,
    skills: ["React", "TypeScript", "CSS"],
    mode: "global" as const,
  },
  {
    title: "Senior UI Engineer",
    company: "Spotify",
    flag: "🇸🇪",
    score: 82,
    skills: ["React", "Redux", "TypeScript"],
    mode: "global" as const,
  },
  {
    title: "Frontend Lead",
    company: "Paymob",
    flag: "🇪🇬",
    score: 79,
    skills: ["React", "JavaScript", "Sass"],
    mode: "local" as const,
  },
];

const MODE_COLOR: Record<string, string> = { global: "#f59e0b", local: "#22c55e" };
const MODE_LABEL: Record<string, string> = {
  global: "🌐 Remote",
  local: "🇪🇬 Local",
};

export default function DemoJobCards() {
  return (
    <section className="relative z-10 mx-auto max-w-[800px] px-8 pb-20">
      <div className="mb-7 text-center text-xs uppercase tracking-widest text-slate-600">
        Sample from today&apos;s feed
      </div>
      <div style={{ perspective: 1000 }}>
        {DEMO_JOBS.map((job, i) => (
          <div
            key={i}
            className="demo-card mb-3 rounded-xl border border-white/[0.06] bg-[#0d0d1a]/70 px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl"
            style={{ borderLeft: `3px solid ${MODE_COLOR[job.mode]}`, willChange: "transform" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[15px] font-semibold text-slate-200">{job.title}</div>
                <div className="mt-0.5 text-[13px] text-slate-500">
                  {job.company} · {job.flag} · {MODE_LABEL[job.mode]}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {job.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-400"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(${MODE_COLOR[job.mode]} ${job.score * 3.6}deg, #1e1e30 0deg)`,
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0d0d1a] text-[13px] font-bold text-slate-200">
                  {job.score}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-center text-xs text-slate-600">
        Sign in to see real matches filtered for your own skills and preferences
      </div>
    </section>
  );
}
