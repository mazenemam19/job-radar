// src/components/landing/PipelineFunnel.tsx
// Server Component — pipeline transparency funnel shown on the landing page

const PIPELINE_STAGES = [
  { label: "847", sub: "fetched from\n95 companies", color: "#6366f1" },
  { label: "312", sub: "after\ndate filter", color: "#818cf8" },
  { label: "89", sub: "after your\nsettings", color: "#a78bfa" },
  { label: "23", sub: "after your\nGemini filter", color: "#c4b5fd" },
];

export default function PipelineFunnel() {
  return (
    <section className="relative z-10 border-y border-white/[0.04] bg-[#0d0d1a]/60 px-8 py-16 text-center backdrop-blur-xl">
      <div className="mb-2 text-xs uppercase tracking-widest text-slate-600">
        Pipeline transparency
      </div>
      <h2
        className="m-0 mb-10 font-bold text-slate-200"
        style={{ fontSize: "clamp(20px, 3vw, 28px)" }}
      >
        See exactly what happened to every job
      </h2>
      <div className="flex flex-wrap items-center justify-center gap-0">
        {PIPELINE_STAGES.map((stage, i) => (
          <div key={i} className="flex items-center">
            {i > 0 && <div className="px-2 text-2xl text-slate-600">→</div>}
            <div
              className="funnel-node flex min-w-[110px] flex-col items-center rounded-2xl bg-[#0d0d1a]/80 px-4 py-5 backdrop-blur-md"
              style={{ border: `1px solid ${stage.color}30`, willChange: "transform" }}
            >
              <div
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-[22px] font-extrabold"
                style={{
                  border: `2px solid ${stage.color}`,
                  background: `${stage.color}10`,
                  color: stage.color,
                }}
              >
                {stage.label}
              </div>
              <div className="mt-2.5 whitespace-pre-line text-center text-[11px] leading-tight text-slate-500">
                {stage.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
