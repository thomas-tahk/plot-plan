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

type CropSection = {
  crop: string
  rowStart: number
  rowEnd: number
  spacingInRow: number
  bedWidth: number
  plantsPerRow: number
  totalPlants: number
  totalYieldEstimate: string
}

type CropPlan = {
  crop: string
  crops: string[]
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
  yieldBasis?: string
  waterSchedule: string
  plantingWindow: string
  cropSections: CropSection[]
  notes: string[]
}

type FormData = {
  plotWidth: string
  plotLength: string
  crops: string[]
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

function sectionPlantsPerRow(plotWidth: number, spacingInRow: number): number {
  return Math.max(1, Math.floor((plotWidth * 12 - spacingInRow) / spacingInRow) + 1)
}

function recalcCounts(plan: CropPlan): CropPlan {
  const plantsPerRow = sectionPlantsPerRow(plan.plotWidth, plan.spacingInRow)
  const totalRows = Math.max(1, Math.floor((plan.plotLength * 12 - plan.rowSpacing) / plan.rowSpacing) + 1)

  // Rescale cropSections to match new totalRows, preserving the original proportions
  let cropSections = plan.cropSections ?? []
  if (cropSections.length === 1) {
    const s = cropSections[0]
    const secPPR = sectionPlantsPerRow(plan.plotWidth, s.spacingInRow)
    cropSections = [{ ...s, rowStart: 1, rowEnd: totalRows, plantsPerRow: secPPR, totalPlants: secPPR * totalRows }]
  } else if (cropSections.length > 1) {
    const oldTotalRows = cropSections.reduce((m, s) => Math.max(m, s.rowEnd), 0) || totalRows
    let cursor = 1
    cropSections = cropSections.map((s, i) => {
      const oldRowCount = s.rowEnd - s.rowStart + 1
      const scaled = Math.max(1, Math.round((oldRowCount / oldTotalRows) * totalRows))
      const start = cursor
      const end = i === cropSections.length - 1 ? totalRows : Math.min(totalRows, cursor + scaled - 1)
      cursor = end + 1
      const secPPR = sectionPlantsPerRow(plan.plotWidth, s.spacingInRow)
      const rowCount = end - start + 1
      return { ...s, rowStart: start, rowEnd: end, plantsPerRow: secPPR, totalPlants: secPPR * rowCount }
    })
  }

  const totalPlants = cropSections.length > 0
    ? cropSections.reduce((sum, s) => sum + s.totalPlants, 0)
    : plantsPerRow * totalRows

  return { ...plan, plantsPerRow, totalRows, totalPlants, cropSections }
}

type Tab = "planner" | "my-plots"

export function CropPlanner() {
  const [tab, setTab] = useState<Tab>("planner")
  const [form, setForm] = useState<FormData>({
    plotWidth: "20",
    plotLength: "30",
    crops: ["Chile Pepper (Hatch)"],
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
    const width = Number(form.plotWidth)
    const length = Number(form.plotLength)
    if (!Number.isFinite(width) || width < 1 || !Number.isFinite(length) || length < 1) {
      alert("Please enter plot width and length (both at least 1 ft).")
      return
    }
    if (form.crops.length === 0) {
      alert("Please pick at least one crop.")
      return
    }
    setLoading(true)
    setSaved(false)
    setSavedPlotId(null)
    setIsEditing(false)
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plotWidth: width,
          plotLength: length,
          crops: form.crops,
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
    setEditedPlan(prev => prev ? { ...prev, [key]: value } : prev)
  }

  // Primary-crop spacing edit: also mirrors into cropSections[0]
  function updatePrimarySpacing(newSpacing: number) {
    setSaved(false)
    setEditedPlan(prev => {
      if (!prev) return prev
      const sections = prev.cropSections?.length
        ? prev.cropSections.map((s, i) => i === 0 ? { ...s, spacingInRow: newSpacing } : s)
        : prev.cropSections
      return recalcCounts({ ...prev, spacingInRow: newSpacing, cropSections: sections })
    })
  }

  // Bed width edit: keeps current aisle constant, so rowSpacing shifts with it.
  function updatePrimaryBedWidth(newBedWidth: number) {
    setSaved(false)
    setEditedPlan(prev => {
      if (!prev) return prev
      const prevBed = Number.isFinite(prev.cropSections?.[0]?.bedWidth)
        ? prev.cropSections![0].bedWidth
        : (Number.isFinite(prev.bedWidth) ? prev.bedWidth : newBedWidth)
      const prevRowSpacing = Number.isFinite(prev.rowSpacing) ? prev.rowSpacing : prevBed + 18
      const aisle = Math.max(0, prevRowSpacing - prevBed)
      const newRowSpacing = Math.max(1, newBedWidth + aisle)
      const sections = prev.cropSections?.length
        ? prev.cropSections.map((s, i) => i === 0 ? { ...s, bedWidth: newBedWidth } : s)
        : prev.cropSections
      return recalcCounts({ ...prev, bedWidth: newBedWidth, rowSpacing: newRowSpacing, cropSections: sections })
    })
  }

  // Aisle is a virtual field — rowSpacing = bedWidth + aisle.
  function updateAisle(newAisle: number) {
    setSaved(false)
    setEditedPlan(prev => {
      if (!prev) return prev
      const prevBed = Number.isFinite(prev.cropSections?.[0]?.bedWidth)
        ? prev.cropSections![0].bedWidth
        : (Number.isFinite(prev.bedWidth) ? prev.bedWidth : 18)
      const safeAisle = Math.max(0, newAisle)
      const newRowSpacing = Math.max(1, prevBed + safeAisle)
      return recalcCounts({ ...prev, bedWidth: prevBed, rowSpacing: newRowSpacing })
    })
  }

  // Per-section editing for multi-crop plans
  function updateSection(i: number, patch: Partial<CropSection>) {
    setSaved(false)
    setEditedPlan(prev => {
      if (!prev || !prev.cropSections) return prev
      const nextSections = prev.cropSections.map((s, idx) => idx === i ? { ...s, ...patch } : s)
      // Recompute per-section plantsPerRow + totalPlants with current spacing
      const recomputed = nextSections.map(s => {
        const ppr = sectionPlantsPerRow(prev.plotWidth, s.spacingInRow)
        const rowCount = Math.max(1, s.rowEnd - s.rowStart + 1)
        return { ...s, plantsPerRow: ppr, totalPlants: ppr * rowCount }
      })
      const totalPlants = recomputed.reduce((sum, s) => sum + s.totalPlants, 0)
      const primary = recomputed[0]
      return {
        ...prev,
        cropSections: recomputed,
        spacingInRow: primary.spacingInRow,
        bedWidth: primary.bedWidth,
        plantsPerRow: primary.plantsPerRow,
        totalPlants,
      }
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
    const clean: CropPlan = { ...editedPlan, notes: editedPlan.notes.map(n => n.trim()).filter(Boolean) }
    try {
      if (savedPlotId) {
        const { error } = await supabase.from("plots").update({ plan: clean, crop: clean.crop }).eq("id", savedPlotId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from("plots").insert({
          session_id: sessionId,
          crop: clean.crop,
          region: clean.region,
          plot_width: clean.plotWidth,
          plot_length: clean.plotLength,
          irrigation: form.irrigation,
          plan: clean,
        }).select("id").single()
        if (error) throw error
        if (data) setSavedPlotId(data.id)
      }
      setEditedPlan(clean)
      setSaved(true)
      setIsEditing(false)
    } catch {
      alert("Couldn't save your plan. Please try again.")
    } finally {
      setSaving(false)
    }
    fetchPlots()
  }

  async function deletePlot(id: string) {
    if (!confirm("Delete this saved plan?")) return
    const { error } = await supabase.from("plots").delete().eq("id", id)
    if (error) {
      alert("Couldn't delete the plan. Please try again.")
      return
    }
    if (savedPlotId === id) {
      setSavedPlotId(null)
      setSaved(false)
    }
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

  // Defensive: derive primary bed from sections (source of truth), fall back to top-level.
  // Guards against Claude responses missing plan.bedWidth, which would cascade to NaN aisle.
  const primaryBedWidth = plan
    ? (Number.isFinite(plan.cropSections?.[0]?.bedWidth)
        ? plan.cropSections![0].bedWidth
        : (Number.isFinite(plan.bedWidth) ? plan.bedWidth : 18))
    : 18
  const safeRowSpacing = plan && Number.isFinite(plan.rowSpacing) ? plan.rowSpacing : primaryBedWidth + 18
  const aisleWidth = Math.max(0, safeRowSpacing - primaryBedWidth)

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

            {/* Crops — multi-select list */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Crops</Label>
              <div className="space-y-2">
                {form.crops.map((crop, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select
                      value={crop}
                      onValueChange={v => { if (!v) return; setForm(f => {
                        const crops = [...f.crops]
                        crops[i] = v
                        return { ...f, crops }
                      }) }}
                    >
                      <SelectTrigger className="flex-1 h-12 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CROPS
                          .filter(o => o === crop || !form.crops.includes(o))
                          .map(o => (
                            <SelectItem key={o} value={o} className="text-base py-3">{o}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {form.crops.length > 1 && (
                      <button
                        onClick={() => setForm(f => ({ ...f, crops: f.crops.filter((_, idx) => idx !== i) }))}
                        className="text-muted-foreground hover:text-foreground text-xl leading-none shrink-0 w-8 h-8 flex items-center justify-center"
                        aria-label="Remove crop"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {form.crops.length < 4 && (
                  <button
                    onClick={() => setForm(f => ({ ...f, crops: [...f.crops, CROPS.find(c => !f.crops.includes(c)) ?? CROPS[1]] }))}
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    + Add another crop
                  </button>
                )}
              </div>
            </div>

            {([
              { label: "Region", key: "region" as const, options: REGIONS },
              { label: "Irrigation", key: "irrigation" as const, options: IRRIGATION_TYPES },
            ]).map(({ label, key, options }) => (
              <div key={key} className="space-y-2">
                <Label className="text-base font-medium">{label}</Label>
                <Select value={form[key] as string} onValueChange={v => setForm(f => ({ ...f, [key]: v }))}>
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
                    {plan.plotWidth} × {plan.plotLength} ft — {(plan.crops ?? [plan.crop]).join(", ")}
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
                    rowSpacing={safeRowSpacing}
                    bedWidth={primaryBedWidth}
                    cropSections={plan.cropSections}
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
                    <p className="text-4xl font-bold text-primary">{plan.totalYieldEstimate}</p>
                    <p className="text-base text-muted-foreground">est. total yield</p>
                    {plan.yieldBasis && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{plan.yieldBasis}</p>
                    )}
                  </div>
                </div>

                {/* Crop sections breakdown (multi-crop only) */}
                {plan.cropSections && plan.cropSections.length > 1 && (
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold">Crop Sections</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {plan.cropSections.map((section, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="mt-1 w-3 h-3 rounded-full shrink-0" style={{
                              background: ["#2d6a4f","#8B3A1F","#2d4a8a","#6a3d8a"][i % 4]
                            }} />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-base">{section.crop}</p>
                              {isEditing ? (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Spacing (in)</Label>
                                    <Input
                                      type="number" min={1}
                                      value={section.spacingInRow}
                                      onChange={e => updateSection(i, { spacingInRow: Math.max(1, +e.target.value || 1) })}
                                      className="h-9 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Bed width (in)</Label>
                                    <Input
                                      type="number" min={1}
                                      value={section.bedWidth}
                                      onChange={e => updateSection(i, { bedWidth: Math.max(1, +e.target.value || 1) })}
                                      className="h-9 text-sm"
                                    />
                                  </div>
                                  <p className="col-span-2 text-xs text-muted-foreground">
                                    Rows {section.rowStart}–{section.rowEnd} · {section.totalPlants} plants · {section.totalYieldEstimate}
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm text-muted-foreground">
                                    Rows {section.rowStart}–{section.rowEnd} · {section.totalPlants} plants · {section.spacingInRow}&quot; spacing · {section.bedWidth}&quot; bed
                                  </p>
                                  <p className="text-sm text-muted-foreground">{section.totalYieldEstimate}</p>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Spacing details (primary crop) */}
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
                          onChange={e => updatePrimarySpacing(Math.max(1, +e.target.value || 1))}
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
                          value={primaryBedWidth}
                          onChange={e => updatePrimaryBedWidth(Math.max(1, +e.target.value || 1))}
                          className="h-10 text-base"
                        />
                      ) : (
                        <p className="text-base font-semibold">{primaryBedWidth}&quot;</p>
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
                          type="number" min={0}
                          value={aisleWidth}
                          onChange={e => updateAisle(Math.max(0, +e.target.value || 0))}
                          className="h-10 text-base"
                        />
                      ) : (
                        <p className="text-base font-semibold">{aisleWidth}&quot;</p>
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
                  bedWidth={p.plan.cropSections?.[0]?.bedWidth ?? p.plan.bedWidth}
                  cropSections={p.plan.cropSections}
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
              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  variant="outline"
                  className="h-10 text-base"
                  onClick={() => loadPlot(p)}
                >
                  View &amp; Edit
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 text-sm text-muted-foreground hover:text-destructive"
                  onClick={() => deletePlot(p.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
