export function DashboardHeader() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent" />
      <div className="relative px-4 py-2 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight">Dashboard</h1>
          <p className="text-blue-100 text-[11px]">Welcome to VIBRO, your operational excellence tool.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-blue-100 font-medium">Live</span>
        </div>
      </div>
    </div>
  )
}
