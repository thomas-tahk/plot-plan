"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PlotVisualizer } from "@/components/plot-visualizer"
import { supabase } from "@/lib/supabase"
import { getSessionId } from "@/lib/session"

type FormData = {
  plotWidth: string
  plotLength: string
  crop: string
  region: string
  irrigation: string
}

type CropPlan = {
  crop: string
  region: string
  plotWidth: number
  plotLength: number
  spacingInRow: number
  rowSpacing: number
  plantsPerRow: number
  totalRows: number
  totalPlants: number
  plantingDepth: string
  daysToHarvest: number
  yieldPerPlant: string
  totalYieldEstimate: string
  waterSchedule: string
  plantingWindow: string
  notes: string[]
}

type SavedPlot = {
  id: string
  created_at: string
  nickname: string | null
  plan: CropPlan
  crop: string
  plot_width: number
  plot_length: number
}

const MOCK_PLAN: CropPlan = {
  crop: "Chile Pepper (Hatch)",
  region: "Bernalillo County",
  plotWidth: 20,
  plotLength: 30,
  spacingInRow: 18,
  rowSpacing: 24,
  plantsPerRow: 13,
  totalRows: 15,
  totalPlants: 195,
  plantingDepth: "¼\" seeds · 4–6\" transplants",
  daysToHarvest: 75,
  yieldPerPlant: "2–4 lbs",
  totalYieldEstimate: "390–780 lbs",
  waterSchedule: "Every 2–3 days in summer (~1 gal/plant)",
  plantingWindow: "Start indoors Feb · Transplant mid-April",
  notes: [
    "Mulch 3–4\" deep to retain moisture — critical in NM heat",
    "Chile thrives in NM's alkaline soil (pH 6–8) — no amendment needed",
    "Watch for aphids and spider mites during dry spells",
    "Harvest green at 75 days, or leave to ripen red (~30 more days)",
    "With drip irrigation, water at base — avoid wetting foliage",
  ],
}

const CROPS = [
  "Chile Pepper (Hatch)", "Tomato", "Squash", "Corn (Sweet)",
  "Lettuce", "Green Beans", "Pumpkin", "Cucumber", "Alfalfa",
]
const REGIONS = [
  "Bernalillo County", "Doña Ana County", "Santa Fe County",
  "Taos County", "Sandoval County", "Valencia County",
]
const IRRIGATION_TYPES = ["Drip", "Flood", "Sprinkler", "None (rain-fed)"]
const STAT_LABELS = [
  "Spacing", "Planting Depth", "Water",
  "Days to Harvest", "Est. Yield", "Plant Window",
] as const

function StatContent({ plan, label }: { plan: CropPlan; label: typeof STAT_LABELS[number] }) {
  switch (label) {
    case "Spacing":
      return (
        <>
          <p className="font-semibold text-base">{plan.spacingInRow}&quot; between plants</p>
          <p className="font-semibold text-base">{plan.rowSpacing}&quot; between rows</p>
        </>
      )
    case "Planting Depth":
      return <p className="text-base">{plan.plantingDepth}</p>
    case "Water":
      return <p className="text-base">{plan.waterSchedule}</p>
    case "Days to Harvest":
      return (
        <>
          <p className="text-3xl font-bold text-primary">{plan.daysToHarvest}</p>
          <p className="text-sm text-muted-foreground">days from transplant</p>
        </>
      )
    case "Est. Yield":
      return (
        <>
          <p className="font-semibold text-base">{plan.totalYieldEstimate}</p>
          <p className="text-sm text-muted-foreground">{plan.yieldPerPlant} per plant</p>
        </>
      )
    case "Plant Window":
      return <p className="text-base">{plan.plantingWindow}</p>
  }
}

type Tab = "planner" | "my-plots"

export function CropPlanner() {
  const [tab, setTab] = useState<Tab>("planner")
  const [form, setForm] = useState<FormData>({
    plotWidth: "20",
    plotLength: "30",
    crop: "Chile Pepper (Hatch)",
    region: "Bernalillo County",
    irrigation: "Drip",
  })
  const [plan, setPlan] = useState<CropPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedPlots, setSavedPlots] = useState<SavedPlot[]>([])
  const [loadingPlots, setLoadingPlots] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setSaved(false)
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plotWidth: Number(form.plotWidth),
          plotLength: Number(form.plotLength),
          crop: form.crop,
          region: form.region,
          irrigation: form.irrigation,
        }),
      })
      if (!res.ok) throw new Error("Failed to generate plan")
      const data = await res.json()
      setPlan(data)
    } catch {
      alert("Something went wrong generating the plan. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!plan || saved) return
    setSaving(true)
    const sessionId = getSessionId()
    await supabase.from("plots").insert({
      session_id: sessionId,
      crop: plan.crop,
      region: plan.region,
      plot_width: plan.plotWidth,
      plot_length: plan.plotLength,
      irrigation: form.irrigation,
      plan,
    })
    setSaving(false)
    setSaved(true)
    setTab("my-plots")
    fetchPlots()
  }

  async function fetchPlots() {
    setLoadingPlots(true)
    const sessionId = getSessionId()
    const { data } = await supabase
      .from("plots")
      .select("id, created_at, nickname, plan, crop, plot_width, plot_length")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
    setSavedPlots((data as SavedPlot[]) ?? [])
    setLoadingPlots(false)
  }

  useEffect(() => {
    if (tab === "my-plots") fetchPlots()
  }, [tab])

  function loadPlot(saved: SavedPlot) {
    setPlan(saved.plan)
    setTab("planner")
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-8">
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-muted rounded-xl p-1 w-fit">
        {(["planner", "my-plots"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-lg text-base font-medium transition-colors ${
              tab === t
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "planner" ? "Planner" : "My Plots"}
          </button>
        ))}
      </div>

      {/* Planner tab */}
      {tab === "planner" && (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          {/* Form */}
          <div className="lg:w-72 shrink-0 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Your Plot</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your details to get a planting plan.
              </p>
            </div>

            <div className="flex gap-3">
              {(["plotWidth", "plotLength"] as const).map((key) => (
                <div key={key} className="flex-1 space-y-2">
                  <Label htmlFor={key} className="text-base font-medium">
                    {key === "plotWidth" ? "Width (ft)" : "Length (ft)"}
                  </Label>
                  <Input
                    id={key}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="h-12 text-lg"
                  />
                </div>
              ))}
            </div>

            {([
              { label: "Crop", key: "crop" as const, options: CROPS },
              { label: "Region", key: "region" as const, options: REGIONS },
              { label: "Irrigation", key: "irrigation" as const, options: IRRIGATION_TYPES },
            ]).map(({ label, key, options }) => (
              <div key={key} className="space-y-2">
                <Label className="text-base font-medium">{label}</Label>
                <Select
                  value={form[key]}
                  onValueChange={v => setForm(f => ({ ...f, [key]: v }))}
                >
                  <SelectTrigger className="w-full h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map(o => (
                      <SelectItem key={o} value={o} className="text-base py-3">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <Button
              className="w-full h-14 text-lg font-semibold rounded-xl"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? "Generating…" : "Generate Plan"}
            </Button>
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {loading && (
              <div className="flex items-center justify-center h-48">
                <p className="text-muted-foreground text-lg animate-pulse">Building your plan…</p>
              </div>
            )}

            {!plan && !loading && (
              <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                <span className="text-6xl mb-4">🌾</span>
                <p className="text-xl font-medium text-muted-foreground">Your plan will appear here</p>
                <p className="text-base text-muted-foreground mt-1">
                  Fill in your plot details and tap Generate Plan
                </p>
              </div>
            )}

            {plan && !loading && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">
                    {plan.plotWidth} × {plan.plotLength} ft — {plan.crop}
                  </h2>
                  <Badge className="text-sm px-2.5 py-1">{plan.region}</Badge>
                </div>

                {/* Visualizer + headline stats */}
                <div className="bg-card rounded-2xl ring-1 ring-border p-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="w-full sm:w-52 shrink-0">
                      <PlotVisualizer
                        plotWidth={plan.plotWidth}
                        plotLength={plan.plotLength}
                        spacingInRow={plan.spacingInRow}
                        rowSpacing={plan.rowSpacing}
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-4 py-2">
                      <div>
                        <p className="text-4xl font-bold text-primary">{plan.totalPlants}</p>
                        <p className="text-base text-muted-foreground">plants total</p>
                        {plan.totalRows > 0 && plan.plantsPerRow > 0 && (
                          <p className="text-sm font-semibold text-foreground mt-1">
                            {plan.totalRows} rows · {plan.plantsPerRow} plants/row
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{plan.totalYieldEstimate}</p>
                        <p className="text-sm text-muted-foreground">estimated total yield</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {STAT_LABELS.map(label => (
                    <Card key={label} size="sm">
                      <CardHeader>
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                          {label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <StatContent plan={plan} label={label} />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Growing notes */}
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Growing Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {plan.notes.map((note, i) => (
                        <li key={i} className="flex gap-3 text-base leading-snug">
                          <span className="text-primary font-bold shrink-0 mt-0.5">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Button
                  className="w-full h-12 text-base rounded-xl"
                  onClick={handleSave}
                  disabled={saving || saved}
                >
                  {saving ? "Saving…" : saved ? "Plan Saved ✓" : "Save This Plan"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* My Plots tab */}
      {tab === "my-plots" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">My Plots</h2>

          {loadingPlots && (
            <p className="text-muted-foreground animate-pulse">Loading your plots…</p>
          )}

          {!loadingPlots && savedPlots.length === 0 && (
            <div className="text-center py-16">
              <span className="text-5xl">🪴</span>
              <p className="text-xl font-medium text-muted-foreground mt-4">No saved plots yet</p>
              <p className="text-base text-muted-foreground mt-1">
                Generate a plan and save it — it will appear here
              </p>
            </div>
          )}

          {savedPlots.map(p => (
            <div
              key={p.id}
              className="bg-card rounded-2xl ring-1 ring-border p-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-semibold text-base">{p.crop}</p>
                <p className="text-sm text-muted-foreground">
                  {p.plot_width} × {p.plot_length} ft ·{" "}
                  {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="outline"
                className="h-10 text-base shrink-0"
                onClick={() => loadPlot(p)}
              >
                View
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
