// src/components/dashboard/DashboardErrorState.tsx

interface DashboardErrorStateProps {
  error: string;
  onRetry: () => void;
}

export default function DashboardErrorState({ error, onRetry }: DashboardErrorStateProps) {
  return (
    <div className="p-12 text-center">
      <div className="mb-3 text-3xl">⚠️</div>
      <div className="mb-4 text-[15px] text-red-400">{error}</div>
      <button
        onClick={onRetry}
        className="rounded-lg border-none bg-indigo-500 px-6 py-2.5 text-sm text-white cursor-pointer"
      >
        Retry
      </button>
    </div>
  );
}
