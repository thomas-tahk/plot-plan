import Anthropic from "@anthropic-ai/sdk"
import { fetchNMCropYield } from "@/lib/nass"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an agricultural planning assistant specializing in New Mexico growing conditions.

KEY NM CONTEXT:
- Arid high-desert climate. Water is the #1 constraint — always factor scarcity into advice.
- Bernalillo County (Albuquerque): last frost ~April 15, first fall frost ~Oct 28, USDA zone 7b, avg 9" rain/year
- Doña Ana County (Las Cruces): last frost ~March 15, zone 8a, hottest/driest in NM
- Santa Fe County: last frost ~May 1, zone 6b, higher elevation (~7000ft), shorter season
- Taos County: last frost ~May 15, zone 5b-6a, high elevation, short season
- Sandoval County: similar to Bernalillo, slightly cooler
- Valencia County: similar to Bernalillo

SOILS: Alkaline (pH 7.5–8.5) across most of NM. Sandy loam to clay loam. Low organic matter.
WATER RIGHTS: Many NM farmers use acequia or well water. Drip irrigation is most efficient.

NATIVE/ADAPTED CROPS: Chile pepper (NM's signature crop), squash, beans, corn (Three Sisters), melons.
WATER-INTENSIVE CROPS: Alfalfa, cotton, pecans — flag these with a water warning note.

When calculating plant counts:
- Use half-spacing margins from all plot edges
- plantsPerRow = floor((plotWidth * 12 - spacingInRow) / spacingInRow) + 1
- totalRows = floor((plotLength * 12 - rowSpacing) / rowSpacing) + 1
- totalPlants = plantsPerRow * totalRows

When USDA NASS yield data is provided, use it to anchor your yield estimate for the plot:
- Plot acres = (plotWidth × plotLength) / 43560
- Expected yield = plot acres × NASS lbs/acre
- Use this as your midpoint — adjust ±20% for small-plot vs commercial scale differences
- Cite the NASS source in your totalYieldEstimate string, e.g. "~186 lbs (based on USDA NASS 2025 NM avg)"

Always include a note about row count (e.g. "15 rows of 13 plants each") as farmers often think in rows.
Always tailor advice to the specific region's frost dates, water situation, and soil.
Keep notes practical and actionable — no jargon.`

const PLAN_TOOL: Anthropic.Tool = {
  name: "generate_crop_plan",
  description: "Generate a detailed crop planting plan for a New Mexico plot",
  input_schema: {
    type: "object" as const,
    properties: {
      spacingInRow:       { type: "number", description: "Inches between plants within a row" },
      rowSpacing:         { type: "number", description: "Inches between rows" },
      plantsPerRow:       { type: "number", description: "Number of plants per row" },
      totalRows:          { type: "number", description: "Total number of rows" },
      totalPlants:        { type: "number", description: "Total plant count for the plot" },
      plantingDepth:      { type: "string", description: "Planting depth, e.g. '¼\" seeds · 4–6\" transplants'" },
      daysToHarvest:      { type: "number", description: "Days from transplant to first harvest" },
      yieldPerPlant:      { type: "string", description: "Expected yield per plant, e.g. '2–4 lbs'" },
      totalYieldEstimate: { type: "string", description: "Total estimated yield. If NASS data was provided, cite it." },
      waterSchedule:      { type: "string", description: "Watering frequency and amount" },
      plantingWindow:     { type: "string", description: "When to start/transplant, specific to the region" },
      notes: {
        type: "array",
        items: { type: "string" },
        description: "5–7 practical notes for NM conditions. First note must state row count and plants per row.",
      },
    },
    required: [
      "spacingInRow", "rowSpacing", "plantsPerRow", "totalRows", "totalPlants",
      "plantingDepth", "daysToHarvest", "yieldPerPlant", "totalYieldEstimate",
      "waterSchedule", "plantingWindow", "notes",
    ],
  },
}

export async function POST(req: Request) {
  const { plotWidth, plotLength, crop, region, irrigation } = await req.json()

  // Fetch real NASS yield data for NM if available for this crop
  const nassYield = await fetchNMCropYield(crop)
  const plotAcres = (plotWidth * plotLength) / 43560
  const nassContext = nassYield
    ? `\nUSDA NASS REAL DATA for ${crop} in NM (${nassYield.source}):
- State average yield: ${nassYield.lbsPerAcre.toLocaleString()} lbs/acre
- This plot (${plotWidth}×${plotLength} ft = ${plotAcres.toFixed(4)} acres): ~${Math.round(plotAcres * nassYield.lbsPerAcre).toLocaleString()} lbs expected at commercial scale
- Use this as your yield anchor. Cite "${nassYield.source}" in totalYieldEstimate.`
    : `\nNo NM-specific USDA NASS yield data available for ${crop} — use best agricultural knowledge.`

  const userPrompt = `Generate a planting plan for:
- Crop: ${crop}
- Plot: ${plotWidth} ft wide × ${plotLength} ft long
- Region: ${region}
- Irrigation: ${irrigation}
${nassContext}

Calculate exact plant counts using the plot dimensions. Tailor all timing and water advice to ${region}.`

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [PLAN_TOOL],
    tool_choice: { type: "tool", name: "generate_crop_plan" },
    messages: [{ role: "user", content: userPrompt }],
  })

  const toolUse = response.content.find(b => b.type === "tool_use")
  if (!toolUse || toolUse.type !== "tool_use") {
    return Response.json({ error: "No plan generated" }, { status: 500 })
  }

  return Response.json({
    crop,
    region,
    plotWidth,
    plotLength,
    irrigation,
    nassSource: nassYield?.source ?? null,
    ...(toolUse.input as Record<string, unknown>),
  })
}
