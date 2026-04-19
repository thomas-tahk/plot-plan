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

interface PlotVisualizerProps {
  plotWidth: number
  plotLength: number
  spacingInRow: number
  rowSpacing: number
  bedWidth?: number
  cropSections?: CropSection[]
}

// Earthy, distinct palette per crop section
const SECTION_COLORS = [
  { outer: "#2d6a4f", inner: "#74c69d" },  // green
  { outer: "#8B3A1F", inner: "#E8906D" },  // terracotta
  { outer: "#2d4a8a", inner: "#7AAAE0" },  // slate blue
  { outer: "#6a3d8a", inner: "#C07ADE" },  // purple
]

export function PlotVisualizer({
  plotWidth, plotLength, spacingInRow, rowSpacing, bedWidth, cropSections,
}: PlotVisualizerProps) {
  const PX_PER_FT = 14
  const PX_PER_IN = PX_PER_FT / 12
  const PAD = 44

  const plotW = plotWidth * PX_PER_FT
  const plotH = plotLength * PX_PER_FT
  const svgW = plotW + PAD * 2 + 24  // extra right margin for aisle label
  const svgH = plotH + PAD * 2

  const spacingXpx = spacingInRow * PX_PER_IN
  const spacingYpx = rowSpacing * PX_PER_IN
  const resolvedBedWidth = bedWidth ?? rowSpacing * 0.55
  const bedHeightPx = resolvedBedWidth * PX_PER_IN

  // Row centers
  const rowYs: number[] = []
  for (let y = spacingYpx / 2; y < plotH - 0.5; y += spacingYpx) {
    rowYs.push(y)
  }

  function sectionIndexForRow(rowIdx: number): number {
    if (!cropSections || cropSections.length <= 1) return 0
    const s = cropSections.find(s => rowIdx + 1 >= s.rowStart && rowIdx + 1 <= s.rowEnd)
    return s ? cropSections.indexOf(s) : 0
  }

  // Plants per row use section-specific spacing when available
  const plants: { x: number; y: number; sIdx: number }[] = []
  for (let rowIdx = 0; rowIdx < rowYs.length; rowIdx++) {
    const sIdx = sectionIndexForRow(rowIdx)
    const section = cropSections?.[sIdx]
    const rowSpacingX = section ? section.spacingInRow * PX_PER_IN : spacingXpx
    for (let x = rowSpacingX / 2; x < plotW - 0.5; x += rowSpacingX) {
      plants.push({ x: PAD + x, y: PAD + rowYs[rowIdx], sIdx })
    }
  }

  const plantsInFirstRow = rowYs.length > 0
    ? plants.filter(p => Math.abs(p.y - (PAD + rowYs[0])) < 1).length
    : 0

  const aisleWidthIn = Math.max(0, rowSpacing - resolvedBedWidth)
  const isMultiCrop = cropSections && cropSections.length > 1

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-auto"
      aria-label={`Top-down plot: ${plotWidth}ft wide by ${plotLength}ft long`}
    >
      {/* Walkway/aisle background */}
      <rect x={PAD} y={PAD} width={plotW} height={plotH} fill="#9e7850" rx={3} />

      {/* Bed strips */}
      {rowYs.map((ry, i) => (
        <rect
          key={i}
          x={PAD}
          y={PAD + ry - bedHeightPx / 2}
          width={plotW}
          height={bedHeightPx}
          fill="#c9a96e"
          rx={2}
        />
      ))}

      {/* Section divider lines and labels (multi-crop only) */}
      {isMultiCrop && cropSections!.slice(0, -1).map((section, i) => {
        const lastRowY = rowYs[section.rowEnd - 1]
        if (lastRowY === undefined) return null
        const dividerY = PAD + lastRowY + spacingYpx / 2
        return (
          <line
            key={i}
            x1={PAD} y1={dividerY}
            x2={PAD + plotW} y2={dividerY}
            stroke="#6b4c28" strokeWidth={1.5} strokeDasharray="6 4"
          />
        )
      })}

      {/* Plants */}
      {plants.map((p, i) => {
        const colors = SECTION_COLORS[p.sIdx % SECTION_COLORS.length]
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} fill={colors.outer} />
            <circle cx={p.x} cy={p.y} r={1.8} fill={colors.inner} />
          </g>
        )
      })}

      {/* Section crop labels (right side, centered in each section) */}
      {isMultiCrop && cropSections!.map((section, i) => {
        const firstY = rowYs[section.rowStart - 1]
        const lastY = rowYs[section.rowEnd - 1]
        if (firstY === undefined || lastY === undefined) return null
        const midY = PAD + (firstY + lastY) / 2
        const colors = SECTION_COLORS[i % SECTION_COLORS.length]
        const shortName = section.crop.split(" ")[0]
        return (
          <text
            key={i}
            x={PAD + plotW - 4}
            y={midY + 4}
            textAnchor="end"
            fontSize={9}
            fill={colors.outer}
            fontWeight="700"
          >
            {shortName}
          </text>
        )
      })}

      {/* Plant spacing annotation (first row, first two plants) */}
      {plantsInFirstRow >= 2 && (
        <g>
          <line
            x1={plants[0].x} y1={plants[0].y + 8}
            x2={plants[1].x} y2={plants[1].y + 8}
            stroke="#c0562a" strokeWidth={1}
          />
          <line x1={plants[0].x} y1={plants[0].y + 5} x2={plants[0].x} y2={plants[0].y + 11} stroke="#c0562a" strokeWidth={1} />
          <line x1={plants[1].x} y1={plants[1].y + 5} x2={plants[1].x} y2={plants[1].y + 11} stroke="#c0562a" strokeWidth={1} />
          <text x={(plants[0].x + plants[1].x) / 2} y={plants[0].y + 20} textAnchor="middle" fontSize={8} fill="#c0562a">
            {spacingInRow}&quot;
          </text>
        </g>
      )}

      {/* Bed width annotation (left side) */}
      {rowYs.length > 0 && (
        <g>
          <line x1={PAD - 6} y1={PAD + rowYs[0] - bedHeightPx / 2} x2={PAD - 6} y2={PAD + rowYs[0] + bedHeightPx / 2} stroke="#4a7c59" strokeWidth={1} />
          <line x1={PAD - 9} y1={PAD + rowYs[0] - bedHeightPx / 2} x2={PAD - 3} y2={PAD + rowYs[0] - bedHeightPx / 2} stroke="#4a7c59" strokeWidth={1} />
          <line x1={PAD - 9} y1={PAD + rowYs[0] + bedHeightPx / 2} x2={PAD - 3} y2={PAD + rowYs[0] + bedHeightPx / 2} stroke="#4a7c59" strokeWidth={1} />
          <text
            x={PAD - 16} y={PAD + rowYs[0] + 3}
            textAnchor="middle" fontSize={7} fill="#4a7c59"
            transform={`rotate(-90, ${PAD - 16}, ${PAD + rowYs[0]})`}
          >
            {Math.round(resolvedBedWidth)}&quot; bed
          </text>
        </g>
      )}

      {/* Aisle annotation (right side) */}
      {rowYs.length >= 2 && aisleWidthIn > 0 && (
        <g>
          <line x1={PAD + plotW + 6} y1={PAD + rowYs[0] + bedHeightPx / 2} x2={PAD + plotW + 6} y2={PAD + rowYs[1] - bedHeightPx / 2} stroke="#6b4c28" strokeWidth={1} />
          <line x1={PAD + plotW + 3} y1={PAD + rowYs[0] + bedHeightPx / 2} x2={PAD + plotW + 9} y2={PAD + rowYs[0] + bedHeightPx / 2} stroke="#6b4c28" strokeWidth={1} />
          <line x1={PAD + plotW + 3} y1={PAD + rowYs[1] - bedHeightPx / 2} x2={PAD + plotW + 9} y2={PAD + rowYs[1] - bedHeightPx / 2} stroke="#6b4c28" strokeWidth={1} />
          <text
            x={PAD + plotW + 18}
            y={(PAD + rowYs[0] + bedHeightPx / 2 + PAD + rowYs[1] - bedHeightPx / 2) / 2 + 3}
            textAnchor="middle" fontSize={7} fill="#6b4c28"
            transform={`rotate(-90, ${PAD + plotW + 18}, ${(PAD + rowYs[0] + bedHeightPx / 2 + PAD + rowYs[1] - bedHeightPx / 2) / 2})`}
          >
            {Math.round(aisleWidthIn)}&quot; aisle
          </text>
        </g>
      )}

      {/* Width dimension */}
      <line x1={PAD} y1={PAD - 10} x2={PAD + plotW} y2={PAD - 10} stroke="#666" strokeWidth={1} />
      <line x1={PAD} y1={PAD - 13} x2={PAD} y2={PAD - 7} stroke="#666" strokeWidth={1} />
      <line x1={PAD + plotW} y1={PAD - 13} x2={PAD + plotW} y2={PAD - 7} stroke="#666" strokeWidth={1} />
      <text x={PAD + plotW / 2} y={PAD - 15} textAnchor="middle" fontSize={10} fill="#555">{plotWidth} ft</text>

      {/* Length dimension */}
      <line x1={PAD - 10} y1={PAD} x2={PAD - 10} y2={PAD + plotH} stroke="#666" strokeWidth={1} />
      <line x1={PAD - 13} y1={PAD} x2={PAD - 7} y2={PAD} stroke="#666" strokeWidth={1} />
      <line x1={PAD - 13} y1={PAD + plotH} x2={PAD - 7} y2={PAD + plotH} stroke="#666" strokeWidth={1} />
      <text
        x={PAD - 22} y={PAD + plotH / 2}
        textAnchor="middle" fontSize={10} fill="#555"
        transform={`rotate(-90, ${PAD - 22}, ${PAD + plotH / 2})`}
      >
        {plotLength} ft
      </text>
    </svg>
  )
}
