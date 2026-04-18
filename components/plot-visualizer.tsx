interface PlotVisualizerProps {
  plotWidth: number
  plotLength: number
  spacingInRow: number  // inches
  rowSpacing: number    // inches
}

export function PlotVisualizer({ plotWidth, plotLength, spacingInRow, rowSpacing }: PlotVisualizerProps) {
  const PX_PER_FT = 13
  const PX_PER_IN = PX_PER_FT / 12
  const PAD = 42

  const plotW = plotWidth * PX_PER_FT
  const plotH = plotLength * PX_PER_FT
  const svgW = plotW + PAD * 2
  const svgH = plotH + PAD * 2

  const spacingXpx = spacingInRow * PX_PER_IN
  const spacingYpx = rowSpacing * PX_PER_IN

  const plants: { x: number; y: number }[] = []
  for (let y = spacingYpx / 2; y < plotH - 0.5; y += spacingYpx) {
    for (let x = spacingXpx / 2; x < plotW - 0.5; x += spacingXpx) {
      plants.push({ x: PAD + x, y: PAD + y })
    }
  }

  const plantsPerRow = plants.filter(p => Math.abs(p.y - plants[0]?.y) < 1).length

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-auto"
      aria-label={`Top-down plot: ${plotWidth}ft wide by ${plotLength}ft long`}
    >
      {/* Soil background */}
      <rect x={PAD} y={PAD} width={plotW} height={plotH} fill="#c9a96e" rx={3} />

      {/* Row guides */}
      {plants
        .filter((_, i) => i % plantsPerRow === 0)
        .map((p, i) => (
          <line
            key={i}
            x1={PAD} y1={p.y}
            x2={PAD + plotW} y2={p.y}
            stroke="#b08a55" strokeWidth={0.7} strokeDasharray="3 4"
          />
        ))}

      {/* Plants */}
      {plants.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#2d6a4f" />
          <circle cx={p.x} cy={p.y} r={1.8} fill="#74c69d" />
        </g>
      ))}

      {/* In-row spacing annotation */}
      {plantsPerRow >= 2 && (
        <g>
          <line
            x1={plants[0].x} y1={plants[0].y + 8}
            x2={plants[1].x} y2={plants[1].y + 8}
            stroke="#c0562a" strokeWidth={1}
          />
          <line x1={plants[0].x} y1={plants[0].y + 5} x2={plants[0].x} y2={plants[0].y + 11} stroke="#c0562a" strokeWidth={1} />
          <line x1={plants[1].x} y1={plants[1].y + 5} x2={plants[1].x} y2={plants[1].y + 11} stroke="#c0562a" strokeWidth={1} />
          <text
            x={(plants[0].x + plants[1].x) / 2}
            y={plants[0].y + 20}
            textAnchor="middle" fontSize={8} fill="#c0562a"
          >
            {spacingInRow}&quot;
          </text>
        </g>
      )}

      {/* Row spacing annotation (right side) */}
      {plantsPerRow > 0 && plants.length > plantsPerRow && (
        <g>
          <line
            x1={PAD + plotW - 6} y1={plants[0].y}
            x2={PAD + plotW - 6} y2={plants[plantsPerRow].y}
            stroke="#c0562a" strokeWidth={1}
          />
          <line x1={PAD + plotW - 9} y1={plants[0].y} x2={PAD + plotW - 3} y2={plants[0].y} stroke="#c0562a" strokeWidth={1} />
          <line x1={PAD + plotW - 9} y1={plants[plantsPerRow].y} x2={PAD + plotW - 3} y2={plants[plantsPerRow].y} stroke="#c0562a" strokeWidth={1} />
          <text
            x={PAD + plotW + 6}
            y={(plants[0].y + plants[plantsPerRow].y) / 2 + 3}
            textAnchor="start" fontSize={8} fill="#c0562a"
          >
            {rowSpacing}&quot;
          </text>
        </g>
      )}

      {/* Width dimension */}
      <line x1={PAD} y1={PAD - 9} x2={PAD + plotW} y2={PAD - 9} stroke="#666" strokeWidth={1} />
      <line x1={PAD} y1={PAD - 12} x2={PAD} y2={PAD - 6} stroke="#666" strokeWidth={1} />
      <line x1={PAD + plotW} y1={PAD - 12} x2={PAD + plotW} y2={PAD - 6} stroke="#666" strokeWidth={1} />
      <text x={PAD + plotW / 2} y={PAD - 14} textAnchor="middle" fontSize={10} fill="#555">
        {plotWidth} ft
      </text>

      {/* Length dimension */}
      <line x1={PAD - 9} y1={PAD} x2={PAD - 9} y2={PAD + plotH} stroke="#666" strokeWidth={1} />
      <line x1={PAD - 12} y1={PAD} x2={PAD - 6} y2={PAD} stroke="#666" strokeWidth={1} />
      <line x1={PAD - 12} y1={PAD + plotH} x2={PAD - 6} y2={PAD + plotH} stroke="#666" strokeWidth={1} />
      <text
        x={PAD - 20}
        y={PAD + plotH / 2}
        textAnchor="middle" fontSize={10} fill="#555"
        transform={`rotate(-90, ${PAD - 20}, ${PAD + plotH / 2})`}
      >
        {plotLength} ft
      </text>
    </svg>
  )
}
