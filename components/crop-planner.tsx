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

type CropPlan = {
  crop: string
  region: string
  plotWidth: number
  plotLength: number
  spacingInRow: number
  bedWidth: number
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

type FormData = {
  plotWidth: string
  plotLength: string
  crop: string
  region: string
  irrigation: string
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

const CROPS = [
  "Chile Pepper (Hatch)", "Tomato", "Squash", "Corn (Sweet)",
  "Lettuce", "Green Beans", "Pumpkin", "Cucumber", "Alfalfa",
]
const REGIONS = [
  "Bernalillo County", "Doña Ana County", "Santa Fe County",
  "Taos County", "Sandoval County", "Valencia County",
]
const IRRIGATION_TYPES = ["Drip", "Flood", "Sprinkler", "None (rain-fed)"]

function recalcCounts(plan: CropPlan): CropPlan {
  const plantsPerRow = Math.max(1, Math.floor((plan.plotWidth * 12 - plan.spacingInRow) / plan.spacingInRow) + 1)
  const totalRows = Math.max(1, Math.floor((plan.plotLength * 12 - plan.rowSpacing) / plan.rowSpacing) + 1)
  return { ...plan, plantsPerRow, totalRows, totalPlants: plantsPerRow * totalRows }
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
  const [editedPlan, setEditedPlan] = useState<CropPlan | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedPlotId, setSavedPlotId] = useState<string | null>(null)
  const [savedPlots, setSavedPlots] = useState<SavedPlot[]>([])
  const [loadingPlots, setLoadingPlots] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setSaved(false)
    setSavedPlotId(null)
    setIsEditing(false)
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
      setEditedPlan(data)
    } catch {
      alert("Something went wrong generating the plan. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function updatePlan<K extends keyof CropPlan>(key: K, value: CropPlan[K]) {
    setSaved(false)
    setEditedPlan(prev => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      if (key === "spacingInRow" || key === "rowSpacing") return recalcCounts(next)
      return next
    })
  }

  function updateNote(i: number, value: string) {
    setSaved(false)
    setEditedPlan(prev => {
      if (!prev) return prev
      const notes = [...prev.notes]
      notes[i] = value
      return { ...prev, notes }
    })
  }

  function removeNote(i: number) {
    setSaved(false)
    setEditedPlan(prev => {
      if (!prev) return prev
      return { ...prev, notes: prev.notes.filter((_, idx) => idx !== i) }
    })
  }

  function addNote() {
    setSaved(false)
    setEditedPlan(prev => {
      if (!prev) return prev
      return { ...prev, notes: [...prev.notes, ""] }
    })
  }

  async function handleSave() {
    if (!editedPlan || saving) return
    setSaving(true)
    const sessionId = getSessionId()
    if (savedPlotId) {
      await supabase.from("plots").update({ plan: editedPlan, crop: editedPlan.crop }).eq("id", savedPlotId)
    } else {
      const { data } = await supabase.from("plots").insert({
        session_id: sessionId,
        crop: editedPlan.crop,
        region: editedPlan.region,
        plot_width: editedPlan.plotWidth,
        plot_length: editedPlan.plotLength,
        irrigation: form.irrigation,
        plan: editedPlan,
      }).select("id").single()
      if (data) setSavedPlotId(data.id)
    }
    setSaving(false)
    setSaved(true)
    setIsEditing(false)
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

  function loadPlot(p: SavedPlot) {
    setEditedPlan(p.plan)
    setSavedPlotId(p.id)
    setSaved(true)
    setIsEditing(false)
    setTab("planner")
  }

  const plan = editedPlan

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-8">
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-muted rounded-xl p-1 w-fit">
        {(["planner", "my-plots"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-lg text-base font-medium transition-colors ${
              tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "planner" ? "Planner" : "My Plots"}
          </button>
        ))}
      </div>

      {/* ── PLANNER TAB ── */}
      {tab === "planner" && (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          {/* Form */}
          <div className="lg:w-72 shrink-0 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Your Plot</h2>
              <p className="text-sm text-muted-foreground mt-1">Enter your details to get a planting plan.</p>
            </div>

            <div className="flex gap-3">
              {(["plotWidth", "plotLength"] as const).map(key => (
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
                <Select value={form[key]} onValueChange={v => setForm(f => ({ ...f, [key]: v }))}>
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

            <Button className="w-full h-14 text-lg font-semibold rounded-xl" onClick={handleGenerate} disabled={loading}>
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
                <p className="text-base text-muted-foreground mt-1">Fill in your plot details and tap Generate Plan</p>
              </div>
            )}

            {plan && !loading && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">
                    {plan.plotWidth} × {plan.plotLength} ft — {plan.crop}
                  </h2>
                  <Badge className="text-sm px-2.5 py-1">{plan.region}</Badge>
                  {savedPlotId && <Badge variant="outline" className="text-sm px-2.5 py-1">Saved</Badge>}
                </div>

                {/* Prominent SVG */}
                <div className="bg-card rounded-2xl ring-1 ring-border p-4">
                  <PlotVisualizer
                    plotWidth={plan.plotWidth}
                    plotLength={plan.plotLength}
                    spacingInRow={plan.spacingInRow}
                    rowSpacing={plan.rowSpacing}
                    bedWidth={plan.bedWidth}
                  />
                </div>

                {/* Headline counts */}
                <div className="bg-card rounded-2xl ring-1 ring-border p-4 flex gap-8 items-center">
                  <div>
                    <p className="text-5xl font-bold text-primary">{plan.totalPlants}</p>
                    <p className="text-base text-muted-foreground">plants total</p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      {plan.totalRows} rows · {plan.plantsPerRow} plants/row
                    </p>
                  </div>
                  <div className="border-l border-border pl-8">
                    <p className="text-2xl font-bold">{plan.totalYieldEstimate}</p>
                    <p className="text-sm text-muted-foreground">estimated total yield</p>
                  </div>
                </div>

                {/* Spacing details */}
                <div className="grid grid-cols-3 gap-3">
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Plant Spacing</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isEditing ? (
                        <Input
                          type="number" min={1}
                          value={plan.spacingInRow}
                          onChange={e => updatePlan("spacingInRow", +e.target.value)}
                          className="h-10 text-base"
                        />
                      ) : (
                        <p className="text-base font-semibold">{plan.spacingInRow}&quot; in-row</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Bed Width</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isEditing ? (
                        <Input
                          type="number" min={1}
                          value={plan.bedWidth}
                          onChange={e => updatePlan("bedWidth", +e.target.value)}
                          className="h-10 text-base"
                        />
                      ) : (
                        <p className="text-base font-semibold">{plan.bedWidth}&quot;</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Aisle Width</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isEditing ? (
                        <Input
                          type="number" min={1}
                          value={plan.rowSpacing}
                          onChange={e => updatePlan("rowSpacing", +e.target.value)}
                          className="h-10 text-base"
                        />
                      ) : (
                        <p className="text-base font-semibold">{Math.max(0, plan.rowSpacing - plan.bedWidth)}&quot;</p>
                      )}
                      {isEditing && (
                        <p className="text-xs text-muted-foreground mt-1">row center-to-center</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Other stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {([
                    {
                      label: "Planting Depth",
                      view: <p className="text-base">{plan.plantingDepth}</p>,
                      edit: <Input value={plan.plantingDepth} onChange={e => updatePlan("plantingDepth", e.target.value)} className="h-10 text-base" />,
                    },
                    {
                      label: "Days to Harvest",
                      view: (
                        <>
                          <p className="text-3xl font-bold text-primary">{plan.daysToHarvest}</p>
                          <p className="text-sm text-muted-foreground">from transplant</p>
                        </>
                      ),
                      edit: <Input type="number" min={1} value={plan.daysToHarvest} onChange={e => updatePlan("daysToHarvest", +e.target.value)} className="h-10 text-base" />,
                    },
                    {
                      label: "Yield / Plant",
                      view: <p className="text-base font-semibold">{plan.yieldPerPlant}</p>,
                      edit: <Input value={plan.yieldPerPlant} onChange={e => updatePlan("yieldPerPlant", e.target.value)} className="h-10 text-base" />,
                    },
                    {
                      label: "Water",
                      view: <p className="text-base">{plan.waterSchedule}</p>,
                      edit: <Input value={plan.waterSchedule} onChange={e => updatePlan("waterSchedule", e.target.value)} className="h-10 text-base" />,
                    },
                    {
                      label: "Plant Window",
                      view: <p className="text-base">{plan.plantingWindow}</p>,
                      edit: <Input value={plan.plantingWindow} onChange={e => updatePlan("plantingWindow", e.target.value)} className="h-10 text-base" />,
                    },
                  ]).map(({ label, view, edit }) => (
                    <Card key={label} size="sm">
                      <CardHeader>
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</CardTitle>
                      </CardHeader>
                      <CardContent>{isEditing ? edit : view}</CardContent>
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
                        <li key={i} className="flex gap-3 items-start">
                          {isEditing ? (
                            <>
                              <Input
                                value={note}
                                onChange={e => updateNote(i, e.target.value)}
                                className="h-10 text-base flex-1"
                              />
                              <button
                                onClick={() => removeNote(i)}
                                className="text-muted-foreground hover:text-destructive text-lg leading-none mt-2 shrink-0"
                                aria-label="Remove note"
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-primary font-bold shrink-0 mt-0.5">•</span>
                              <span className="text-base leading-snug">{note}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                    {isEditing && (
                      <button
                        onClick={addNote}
                        className="mt-3 text-sm text-primary font-medium hover:underline"
                      >
                        + Add note
                      </button>
                    )}
                  </CardContent>
                </Card>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="h-12 text-base rounded-xl flex-1"
                    onClick={() => setIsEditing(e => !e)}
                  >
                    {isEditing ? "Done Editing" : "Edit Plan"}
                  </Button>
                  <Button
                    className="h-12 text-base rounded-xl flex-1"
                    onClick={handleSave}
                    disabled={saving || saved}
                  >
                    {saving ? "Saving…" : saved ? "Saved ✓" : savedPlotId ? "Save Changes" : "Save Plan"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MY PLOTS TAB ── */}
      {tab === "my-plots" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">My Plots</h2>

          {loadingPlots && <p className="text-muted-foreground animate-pulse">Loading your plots…</p>}

          {!loadingPlots && savedPlots.length === 0 && (
            <div className="text-center py-16">
              <span className="text-5xl">🪴</span>
              <p className="text-xl font-medium text-muted-foreground mt-4">No saved plots yet</p>
              <p className="text-base text-muted-foreground mt-1">Generate a plan and save it — it will appear here</p>
            </div>
          )}

          {savedPlots.map(p => (
            <div
              key={p.id}
              className="bg-card rounded-2xl ring-1 ring-border p-4 flex items-center gap-4"
            >
              {/* Mini plot thumbnail */}
              <div className="w-24 shrink-0 rounded-lg overflow-hidden">
                <PlotVisualizer
                  plotWidth={p.plan.plotWidth}
                  plotLength={p.plan.plotLength}
                  spacingInRow={p.plan.spacingInRow}
                  rowSpacing={p.plan.rowSpacing}
                  bedWidth={p.plan.bedWidth}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base">{p.crop}</p>
                <p className="text-sm text-muted-foreground">
                  {p.plot_width} × {p.plot_length} ft · {new Date(p.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.plan.totalPlants} plants · {p.plan.totalRows} rows
                </p>
              </div>
              <Button
                variant="outline"
                className="h-10 text-base shrink-0"
                onClick={() => loadPlot(p)}
              >
                View &amp; Edit
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
