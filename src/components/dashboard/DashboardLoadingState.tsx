// src/components/dashboard/DashboardLoadingState.tsx

interface DashboardLoadingStateProps {
  rebuilding: boolean;
}

export default function DashboardLoadingState({ rebuilding }: DashboardLoadingStateProps) {
  return (
    <div className="p-12 text-center">
      <div className="mb-4 text-3xl">🔄</div>
      <div className="text-base font-semibold text-indigo-400">
        {rebuilding ? "Running your Gemini filter…" : "Loading your job feed…"}
      </div>
      <div className="mt-2 text-[13px] text-slate-600">
        {rebuilding
          ? "This takes 10–15 seconds on first load after a cron run. Subsequent opens are instant."
          : "Checking your cached results…"}
      </div>
    </div>
  );
}
