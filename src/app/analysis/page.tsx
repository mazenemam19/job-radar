// src/app/analysis/page.tsx
import AnalysisView from "@/components/AnalysisView";

export default function AnalysisPage() {
  return <AnalysisView cronSecret={process.env.CRON_SECRET} />;
}
