import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { applyToPoint, compose, scale, translate } from "transformation-matrix"
import type { UglyTraceFinding } from "./types"
const escapeXml = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  )
export function renderUglyTraceFinding(
  circuitJson: AnyCircuitElement[],
  finding: UglyTraceFinding,
) {
  const points = [...finding.original, ...finding.suggested]
  const minX = Math.min(...points.map((p) => p.x)) - 1,
    maxX = Math.max(...points.map((p) => p.x)) + 1
  const minY = Math.min(...points.map((p) => p.y)) - 1,
    maxY = Math.max(...points.map((p) => p.y)) + 1
  const width = 960,
    height = 600
  const factor = Math.min(width / (maxX - minX), height / (maxY - minY))
  const transform = compose(
    translate(
      (width - (maxX - minX) * factor) / 2 - minX * factor,
      height - (height - (maxY - minY) * factor) / 2 + minY * factor,
    ),
    scale(factor, -factor),
  )
  const svg = convertCircuitJsonToPcbSvg(
    circuitJson.filter((e) => !e.type.startsWith("pcb_silkscreen")),
    {
      width,
      height,
      layer: finding.layer,
      viewport: { minX, minY, maxX, maxY },
      includeVersion: false,
      shouldDrawErrors: false,
      showSolderMask: false,
    },
  )
  const overlay = [
    { points: finding.original, color: "#ff4167", dash: "" },
    {
      points: finding.suggested,
      color: "#36ffe0",
      dash: 'stroke-dasharray="8 5"',
    },
  ]
    .map(
      (path) =>
        `<polyline points="${path.points
          .map((p) => {
            const q = applyToPoint(transform, p)
            return `${q.x},${q.y}`
          })
          .join(
            " ",
          )}" fill="none" stroke="${path.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" ${path.dash}/>`,
    )
    .join("")
  // Extend the root viewBox for the explanation without covering the board crop.
  return svg
    .replace(/height="600"/, 'height="690"')
    .replace(/\sviewBox="[^"]*"/, "")
    .replace("<svg ", '<svg viewBox="0 0 960 690" ')
    .replace(
      "</svg>",
      `${overlay}<rect x="0" y="600" width="960" height="90" fill="#101827"/><g fill="white" font-family="sans-serif" font-size="15"><text x="20" y="624">${escapeXml(finding.pcb_trace_id)} · ${escapeXml(finding.layer)} · route ${finding.startRouteIndex}–${finding.endRouteIndex}</text><text x="20" y="648">${escapeXml(finding.explanation)}</text><text x="20" y="674" fill="#b9c8da">Pink: offending section. Dashed mint: clear ${finding.kind === "strange_angle" ? "45°" : "simpler"} alternative (advisory).</text></g></svg>`,
    )
}
