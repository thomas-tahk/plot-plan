const NASS_BASE = "https://quickstats.nass.usda.gov/api/api_GET"

// Crops we know have NM state-level SURVEY yield data in NASS
const NASS_CROP_MAP: Record<string, { commodity: string; class_desc?: string }> = {
  "Chile Pepper (Hatch)": { commodity: "PEPPERS", class_desc: "CHILE" },
  "Alfalfa":              { commodity: "ALFALFA" },
  "Corn (Sweet)":         { commodity: "CORN, SWEET" },
  "Tomato":               { commodity: "TOMATOES" },
  "Lettuce":              { commodity: "LETTUCE" },
  "Squash":               { commodity: "SQUASH" },
  "Cucumber":             { commodity: "CUCUMBERS" },
  "Pumpkin":              { commodity: "PUMPKINS" },
  "Green Beans":          { commodity: "BEANS, SNAP" },
}

export type NassYield = {
  lbsPerAcre: number
  year: number
  source: string
}

// Simple in-process cache — NASS data changes annually, not per request
const cache = new Map<string, NassYield | null>()

export async function fetchNMCropYield(crop: string): Promise<NassYield | null> {
  if (cache.has(crop)) return cache.get(crop)!

  const mapping = NASS_CROP_MAP[crop]
  if (!mapping) {
    cache.set(crop, null)
    return null
  }

  const params = new URLSearchParams({
    key: process.env.NASS_API_KEY!,
    state_alpha: "NM",
    source_desc: "SURVEY",
    commodity_desc: mapping.commodity,
    statisticcat_desc: "YIELD",
    agg_level_desc: "STATE",
    freq_desc: "Annual",
    year__GE: "2018",
    format: "JSON",
  })
  if (mapping.class_desc) params.set("class_desc", mapping.class_desc)

  try {
    const res = await fetch(`${NASS_BASE}/?${params}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) { cache.set(crop, null); return null }

    const json = await res.json()
    const rows = (json.data ?? []) as Array<Record<string, string>>

    const valid = rows
      .filter(r => r.Value && r.Value !== "(D)" && r.Value !== "(NA)" && r.Value !== "(Z)")
      .sort((a, b) => Number(b.year) - Number(a.year))

    if (!valid.length) { cache.set(crop, null); return null }

    const row = valid[0]
    const raw = parseFloat(row.Value.replace(/,/g, ""))
    const unit = row.unit_desc

    let lbsPerAcre: number
    if (unit === "CWT / ACRE")  lbsPerAcre = raw * 100
    else if (unit === "LB / ACRE")  lbsPerAcre = raw
    else if (unit === "TON / ACRE") lbsPerAcre = raw * 2000
    else { cache.set(crop, null); return null }

    const result: NassYield = {
      lbsPerAcre,
      year: Number(row.year),
      source: `USDA NASS ${row.year} NM Survey`,
    }
    cache.set(crop, result)
    return result
  } catch {
    cache.set(crop, null)
    return null
  }
}
