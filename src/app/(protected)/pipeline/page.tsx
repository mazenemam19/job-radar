// src/app/v2/pipeline/page.tsx
"use client";

import { useState, useEffect } from "react";
import FunnelView from "@/components/v2/pipeline/FunnelView";
import type { PipelineLog } from "@/lib/v2/types";

export default function PipelinePage() {
  const [log, setLog] = useState<PipelineLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Reuse the dashboard endpoint — it returns pipeline_log
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (data.ok) setLog(data.data.pipeline_log);
      setLoading(false);
    })();
  }, []);

  return <FunnelView log={log} loading={loading} />;
}
