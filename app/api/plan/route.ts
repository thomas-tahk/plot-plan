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

SPACING DEFINITIONS (three distinct measurements):
- spacingInRow: inches between plants within a single row (e.g., 12" for chile)
- bedWidth: width of the planted growing strip in inches. Each crop has a standard bed width:
  Chile 24", Tomato 24", Squash 36", Corn 30", Lettuce 18", Green Beans 18", Pumpkin 48", Cucumber 24", Alfalfa 36"
- rowSpacing: center-to-center distance between rows in inches. Should equal bedWidth + typical aisle/walkway.
  Aisle (walkway) = rowSpacing − bedWidth. Typical aisle: 18–24" for row crops.

SINGLE-CROP plant count formulas:
- plantsPerRow = floor((plotWidth * 12 - spacingInRow) / spacingInRow) + 1
- totalRows = floor((plotLength * 12 - rowSpacing) / rowSpacing) + 1
- totalPlants = plantsPerRow * totalRows

MULTI-CROP plots:
- Divide total rows proportionally and agronomically between crops
- Use a single consistent rowSpacing for the whole plot (use the largest rowSpacing needed)
- Fill cropSections: one entry per crop with its row range, spacing, and yield
- totalRows and totalPlants are sums across all sections
- Notes should address all crops — compatibility, companion planting tips, water needs

When USDA NASS yield data is provided, use it to anchor yield estimates.
Always include a note about row count (e.g. "15 rows of 13 plants each") as farmers think in rows.
Always tailor advice to the specific region's frost dates, water situation, and soil.
Keep notes practical and actionable — no jargon.

YIELD FORMAT (strict):
- totalYieldEstimate MUST be a clean short value: "135 lbs", "2,400 lbs", "~180 lbs" — number + unit only.
- Do NOT embed source citations, math, or "based on" phrases inside totalYieldEstimate.
- Put the source into yieldBasis, short: "NM NASS 2025 (13,500 lbs/ac)", "typical NM yield", "grower-reported avg".
- Section totalYieldEstimate follows the same rule: "90 lbs" not "90 lbs (based on ...)".`

const PLAN_TOOL: Anthropic.Tool = {
  name: "generate_crop_plan",
  description: "Generate a detailed crop planting plan for a New Mexico plot",
  input_schema: {
    type: "object" as const,
    properties: {
      spacingInRow:       { type: "number", description: "Primary crop: inches between plants within a row" },
      bedWidth:           { type: "number", description: "Primary crop: growing strip width in inches" },
      rowSpacing:         { type: "number", description: "Consistent center-to-center row spacing for the whole plot in inches" },
      plantsPerRow:       { type: "number", description: "Primary crop: plants per row" },
      totalRows:          { type: "number", description: "Total rows across all crops" },
      totalPlants:        { type: "number", description: "Total plants across all crops" },
      plantingDepth:      { type: "string", description: "Primary crop planting depth" },
      daysToHarvest:      { type: "number", description: "Primary crop days from transplant to first harvest" },
      yieldPerPlant:      { type: "string", description: "Primary crop yield per plant" },
      totalYieldEstimate: { type: "string", description: "Clean total yield — number + unit only, e.g. '135 lbs'. No citations, no math, no 'based on'." },
      yieldBasis:         { type: "string", description: "Very short source note, max ~40 chars, e.g. 'NM NASS 2025 (13,500 lbs/ac)' or 'typical NM yield'." },
      waterSchedule:      { type: "string", description: "Watering schedule — note any differences between crops" },
      plantingWindow:     { type: "string", description: "Planting window — note if crops differ" },
      cropSections: {
        type: "array",
        description: "One entry per crop. Single-crop: one section covering all rows. Multi-crop: one section per crop.",
        items: {
          type: "object",
          properties: {
            crop:             { type: "string" },
            rowStart:         { type: "number", description: "First row number, 1-indexed" },
            rowEnd:           { type: "number", description: "Last row number, 1-indexed" },
            spacingInRow:     { type: "number" },
            bedWidth:         { type: "number" },
            plantsPerRow:     { type: "number" },
            totalPlants:      { type: "number" },
            totalYieldEstimate: { type: "string", description: "Clean yield for this section — number + unit only, e.g. '90 lbs'." },
          },
          required: ["crop","rowStart","rowEnd","spacingInRow","bedWidth","plantsPerRow","totalPlants","totalYieldEstimate"],
        },
      },
      notes: {
        type: "array",
        items: { type: "string" },
        description: "5–7 practical notes. First note must state row layout (e.g. '8 rows chile + 4 rows squash, 13 plants/row'). Address all crops.",
      },
    },
    required: [
      "spacingInRow", "bedWidth", "rowSpacing", "plantsPerRow", "totalRows", "totalPlants",
      "plantingDepth", "daysToHarvest", "yieldPerPlant", "totalYieldEstimate", "yieldBasis",
      "waterSchedule", "plantingWindow", "cropSections", "notes",
    ],
  },
}

export async function POST(req: Request) {
  const { plotWidth, plotLength, crops, region, irrigation } = await req.json()
  const cropList: string[] = Array.isArray(crops) ? crops : [crops]
  const primaryCrop = cropList[0]
  const isMultiCrop = cropList.length > 1

  const plotAcres = (plotWidth * plotLength) / 43560

  // Fetch NASS yield data for all crops in parallel
  const nassResults = await Promise.all(cropList.map(c => fetchNMCropYield(c)))
  const nassContext = cropList.map((crop, i) => {
    const n = nassResults[i]
    return n
      ? `${crop}: ${n.lbsPerAcre.toLocaleString()} lbs/acre (${n.source})`
      : `${crop}: no NM NASS data — use best knowledge`
  }).join("\n")

  const cropLine = isMultiCrop
    ? `Crops (intercropped by row): ${cropList.join(", ")}`
    : `Crop: ${primaryCrop}`

  const userPrompt = `Generate a planting plan for:
- ${cropLine}
- Plot: ${plotWidth} ft wide × ${plotLength} ft long
- Region: ${region}
- Irrigation: ${irrigation}

USDA NASS NM yield data:
${nassContext}
Plot size: ${plotAcres.toFixed(4)} acres

${isMultiCrop ? `Divide the plot rows agronomically between the ${cropList.length} crops. Use one consistent rowSpacing for the whole plot.` : ""}
Calculate exact plant counts. Tailor all timing and water advice to ${region}.`

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
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
    crop: primaryCrop,
    crops: cropList,
    region,
    plotWidth,
    plotLength,
    irrigation,
    ...(toolUse.input as Record<string, unknown>),
  })
}
