// src/app/page.tsx
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return <Dashboard cronSecret={process.env.CRON_SECRET} />;
}
