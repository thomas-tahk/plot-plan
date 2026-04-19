interface PlotVisualizerProps {
  plotWidth: number
  plotLength: number
  spacingInRow: number  // inches between plants
  rowSpacing: number    // center-to-center between rows, inches
  bedWidth?: number     // growing strip width, inches (defaults to 55% of rowSpacing)
}

export function PlotVisualizer({ plotWidth, plotLength, spacingInRow, rowSpacing, bedWidth }: PlotVisualizerProps) {
  const PX_PER_FT = 14
  const PX_PER_IN = PX_PER_FT / 12
  const PAD = 44

  const plotW = plotWidth * PX_PER_FT
  const plotH = plotLength * PX_PER_FT
  const svgW = plotW + PAD * 2
  const svgH = plotH + PAD * 2

  const spacingXpx = spacingInRow * PX_PER_IN
  const spacingYpx = rowSpacing * PX_PER_IN
  const bedHeightPx = (bedWidth ?? rowSpacing * 0.55) * PX_PER_IN

  const rowYs: number[] = []
  for (let y = spacingYpx / 2; y < plotH - 0.5; y += spacingYpx) {
    rowYs.push(y)
  }

  const plants: { x: number; y: number }[] = []
  for (const ry of rowYs) {
    for (let x = spacingXpx / 2; x < plotW - 0.5; x += spacingXpx) {
      plants.push({ x: PAD + x, y: PAD + ry })
    }
  }

  const plantsInFirstRow = rowYs.length > 0
    ? plants.filter(p => Math.abs(p.y - (PAD + rowYs[0])) < 1).length
    : 0

  const aisleWidthIn = Math.max(0, rowSpacing - (bedWidth ?? rowSpacing * 0.55))

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

      {/* Plants */}
      {plants.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#2d6a4f" />
          <circle cx={p.x} cy={p.y} r={1.8} fill="#74c69d" />
        </g>
      ))}

      {/* Plant spacing annotation */}
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
          <line
            x1={PAD - 6} y1={PAD + rowYs[0] - bedHeightPx / 2}
            x2={PAD - 6} y2={PAD + rowYs[0] + bedHeightPx / 2}
            stroke="#4a7c59" strokeWidth={1}
          />
          <line x1={PAD - 9} y1={PAD + rowYs[0] - bedHeightPx / 2} x2={PAD - 3} y2={PAD + rowYs[0] - bedHeightPx / 2} stroke="#4a7c59" strokeWidth={1} />
          <line x1={PAD - 9} y1={PAD + rowYs[0] + bedHeightPx / 2} x2={PAD - 3} y2={PAD + rowYs[0] + bedHeightPx / 2} stroke="#4a7c59" strokeWidth={1} />
          <text
            x={PAD - 16}
            y={PAD + rowYs[0] + 3}
            textAnchor="middle" fontSize={7} fill="#4a7c59"
            transform={`rotate(-90, ${PAD - 16}, ${PAD + rowYs[0]})`}
          >
            {bedWidth ?? Math.round(rowSpacing * 0.55)}&quot; bed
          </text>
        </g>
      )}

      {/* Aisle annotation (right side, between rows 0 and 1) */}
      {rowYs.length >= 2 && aisleWidthIn > 0 && (
        <g>
          <line
            x1={PAD + plotW + 6} y1={PAD + rowYs[0] + bedHeightPx / 2}
            x2={PAD + plotW + 6} y2={PAD + rowYs[1] - bedHeightPx / 2}
            stroke="#6b4c28" strokeWidth={1}
          />
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
      <text x={PAD + plotW / 2} y={PAD - 15} textAnchor="middle" fontSize={10} fill="#555">
        {plotWidth} ft
      </text>

      {/* Length dimension */}
      <line x1={PAD - 10} y1={PAD} x2={PAD - 10} y2={PAD + plotH} stroke="#666" strokeWidth={1} />
      <line x1={PAD - 13} y1={PAD} x2={PAD - 7} y2={PAD} stroke="#666" strokeWidth={1} />
      <line x1={PAD - 13} y1={PAD + plotH} x2={PAD - 7} y2={PAD + plotH} stroke="#666" strokeWidth={1} />
      <text
        x={PAD - 22}
        y={PAD + plotH / 2}
        textAnchor="middle" fontSize={10} fill="#555"
        transform={`rotate(-90, ${PAD - 22}, ${PAD + plotH / 2})`}
      >
        {plotLength} ft
      </text>
    </svg>
  )
}
