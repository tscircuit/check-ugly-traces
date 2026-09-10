import type { AnyCircuitElement, LayerRef } from "circuit-json"
import {
  distance,
  segmentDistance,
  segments,
  type Point,
  type Segment,
} from "./geometry"
export type Obstacle = Segment & {
  radius: number
  layers?: string[]
  traceId?: string
  routeIndex?: number
}
export function getObstacles(circuitJson: AnyCircuitElement[]) {
  const obstacles: Obstacle[] = []
  let unsupportedCopper =
    circuitJson.filter((e) => e.type === "pcb_board").length > 1
  for (const elm of circuitJson) {
    if (elm.type === "pcb_trace") {
      for (let i = 0; i < elm.route.length - 1; i++) {
        const a = elm.route[i],
          b = elm.route[i + 1]
        if (
          a.route_type === "wire" &&
          b.route_type === "wire" &&
          a.layer === b.layer
        )
          obstacles.push({
            a,
            b,
            radius: Math.max(a.width, b.width) / 2,
            layers: [a.layer],
            traceId: elm.pcb_trace_id,
            routeIndex: i,
          })
      }
      for (const p of elm.route)
        if (p.route_type === "via")
          obstacles.push({
            a: p,
            b: p,
            radius:
              (p.outer_diameter ??
                ("via_diameter" in p && typeof p.via_diameter === "number"
                  ? p.via_diameter
                  : 0.6)) / 2,
          })
    } else if (elm.type === "pcb_via")
      obstacles.push({ a: elm, b: elm, radius: elm.outer_diameter / 2 })
    else if (
      elm.type === "pcb_smtpad" ||
      elm.type === "pcb_plated_hole" ||
      elm.type === "pcb_hole"
    ) {
      // Circumscribed circles deliberately overestimate rectangular/rotated pads.
      const width =
        "width" in elm ? elm.width : "outer_width" in elm ? elm.outer_width : 0
      const height =
        "height" in elm
          ? elm.height
          : "outer_height" in elm
            ? elm.outer_height
            : 0
      const diameter =
        "radius" in elm
          ? elm.radius * 2
          : "outer_diameter" in elm
            ? elm.outer_diameter
            : "hole_diameter" in elm
              ? elm.hole_diameter
              : 0
      const radius =
        Math.max(Math.hypot(width ?? 0, height ?? 0), diameter ?? 0) / 2
      if (!radius || !("x" in elm) || !("y" in elm)) {
        unsupportedCopper = true
        continue
      }
      obstacles.push({
        a: elm,
        b: elm,
        radius,
        layers: elm.type === "pcb_smtpad" ? [elm.layer] : undefined,
      })
    } else if (elm.type === "pcb_copper_pour" || elm.type === "pcb_keepout")
      unsupportedCopper = true
  }
  return { obstacles, unsupportedCopper }
}
export function pathIsClear(input: {
  path: Point[]
  layer: LayerRef
  width: number
  clearance: number
  obstacles: Obstacle[]
  board: AnyCircuitElement | undefined
}) {
  const { path, layer, width, clearance, obstacles, board } = input
  if (!board || board.type !== "pcb_board" || !board.width || !board.height)
    return false
  const { width: boardWidth, height: boardHeight } = board
  const margin = width / 2 + clearance
  const boardMargin =
    width / 2 + Math.max(clearance, board.min_board_edge_clearance ?? 0)
  // Unknown nonrectangular outlines are conservatively skipped for now.
  if (board.outline?.length) return false
  if (
    path.some(
      (p) =>
        Math.abs(p.x - board.center.x) > boardWidth / 2 - boardMargin ||
        Math.abs(p.y - board.center.y) > boardHeight / 2 - boardMargin,
    )
  )
    return false
  return segments(path).every((segment) =>
    obstacles.every(
      (o) =>
        (o.layers && !o.layers.includes(layer)) ||
        segmentDistance(segment, o) >= margin + o.radius,
    ),
  )
}
