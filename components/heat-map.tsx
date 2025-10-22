"use client"

import { useMemo } from "react"

interface HeatMapProps {
  data: Array<{ x: string; y: string; value: number; fullName?: string }>
  xLabels: string[]
  yLabels: string[]
  xLabel?: string
  yLabel?: string
  valueLabel?: string
  fullNames?: string[]
}

export function HeatMap({
  data,
  xLabels,
  yLabels,
  xLabel = "X Axis",
  yLabel = "Y Axis",
  valueLabel = "Value",
  fullNames = [],
}: HeatMapProps) {
  const { minValue, maxValue, cellSize } = useMemo(() => {
    const values = data.map((d) => d.value).filter((v) => v > 0)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const size = Math.max(40, Math.min(80, 600 / Math.max(xLabels.length, yLabels.length)))

    return {
      minValue: min,
      maxValue: max,
      cellSize: size,
    }
  }, [data, xLabels.length, yLabels.length])

  const getColor = (value: number) => {
    if (value === 0) return "#f3f4f6" // gray-100
    const intensity = (value - minValue) / (maxValue - minValue)
    const opacity = 0.2 + intensity * 0.8
    return `rgba(34, 197, 94, ${opacity})` // green with varying opacity
  }

  const getTooltipContent = (item: { x: string; y: string; value: number; fullName?: string }) => {
    const xName = fullNames.length > 0 ? fullNames[xLabels.indexOf(item.x)] || item.x : item.x

    return `${xName} × ${item.y}: ${item.value.toFixed(2)}${valueLabel.includes("%") ? "%" : ""}`
  }

  return (
    <div className="w-full overflow-auto">
      <div className="relative" style={{ minWidth: xLabels.length * cellSize + 100 }}>
        {/* Y-axis label */}
        <div
          className="absolute left-0 top-1/2 transform -rotate-90 -translate-y-1/2 text-sm font-medium text-gray-600"
          style={{ transformOrigin: "center" }}
        >
          {yLabel}
        </div>

        {/* Main content */}
        <div className="ml-16">
          {/* Y-axis labels */}
          <div className="flex">
            <div className="flex flex-col justify-end" style={{ width: 80 }}>
              {yLabels.map((label, index) => (
                <div
                  key={label}
                  className="text-xs text-right pr-2 flex items-center justify-end"
                  style={{ height: cellSize }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Heat map grid */}
            <div className="flex flex-col">
              {yLabels.map((yLabel, yIndex) => (
                <div key={yLabel} className="flex">
                  {xLabels.map((xLabel, xIndex) => {
                    const dataPoint = data.find((d) => d.x === xLabel && d.y === yLabel)
                    const value = dataPoint?.value || 0

                    return (
                      <div
                        key={`${xLabel}-${yLabel}`}
                        className="border border-gray-200 flex items-center justify-center text-xs font-medium cursor-pointer hover:border-gray-400 transition-colors"
                        style={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: getColor(value),
                        }}
                        title={dataPoint ? getTooltipContent(dataPoint) : `${xLabel} × ${yLabel}: No data`}
                      >
                        {value > 0 ? value.toFixed(0) : ""}
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* X-axis labels */}
              <div className="flex mt-2">
                {xLabels.map((label, index) => (
                  <div
                    key={label}
                    className="text-xs text-center transform -rotate-45 origin-top-left"
                    style={{
                      width: cellSize,
                      height: 40,
                    }}
                  >
                    <span className="inline-block mt-2">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* X-axis label */}
          <div className="text-center mt-8 text-sm font-medium text-gray-600">{xLabel}</div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center space-x-4">
          <span className="text-xs text-gray-600">Low</span>
          <div className="flex space-x-1">
            {[0.2, 0.4, 0.6, 0.8, 1.0].map((opacity) => (
              <div
                key={opacity}
                className="w-4 h-4 border border-gray-200"
                style={{ backgroundColor: `rgba(34, 197, 94, ${opacity})` }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-600">High</span>
        </div>
      </div>
    </div>
  )
}
