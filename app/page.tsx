import { CropPlanner } from "@/components/crop-planner"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 px-5 py-4 bg-card">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <span className="text-2xl" aria-hidden>🌱</span>
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground">
              PlotPlan NM
            </h1>
            <p className="text-sm text-muted-foreground leading-tight">
              Plan your plot. Grow smarter.
            </p>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <CropPlanner />
      </main>
      <footer className="text-center text-xs text-muted-foreground py-4 border-t border-border/40">
        Results are estimates for typical NM growing conditions. Your results may vary.
      </footer>
    </div>
  )
}
