import { BaseSolver } from "@tscircuit/solver-utils"
import type { PcbTrace } from "circuit-json"
import type { GraphicsObject } from "graphics-debug"
import {
  distance,
  onlyTouchesAtSharedEndpoint,
  isOctilinear,
  pathLength,
  replacements,
  segments,
} from "./geometry"
import { getObstacles, pathIsClear } from "./obstacles"
import type { CheckInput, UglyTraceFinding } from "./types"
export class UglyTracesSolver extends BaseSolver {
  private traces: PcbTrace[]
  private cursor = 0
  private findings: UglyTraceFinding[] = []
  private scene: ReturnType<typeof getObstacles>
  constructor(private input: CheckInput) {
    super()
    for (const [key, setting] of Object.entries(input.options ?? {})) {
      if (!Number.isFinite(setting) || setting < 0)
        throw new Error(`Invalid option ${key}`)
    }
    const window = input.options?.maxWindowSegments ?? 6
    if (!Number.isInteger(window) || window < 2 || window > 32)
      throw new Error("maxWindowSegments must be an integer between 2 and 32")
    this.traces = input.circuitJson.filter(
      (e): e is PcbTrace => e.type === "pcb_trace",
    )
    for (const trace of this.traces) {
      if (
        !Array.isArray(trace.route) ||
        trace.route.some(
          (p) =>
            (p.route_type === "wire" || p.route_type === "via") &&
            (!Number.isFinite(p.x) ||
              !Number.isFinite(p.y) ||
              (p.route_type === "wire" &&
                (!Number.isFinite(p.width) || p.width <= 0))),
        )
      )
        throw new Error(`Invalid route geometry in ${trace.pcb_trace_id}`)
    }
    this.scene = getObstacles(input.circuitJson)
    this.MAX_ITERATIONS = this.traces.length + 1
  }
  override _step() {
    const trace = this.traces[this.cursor++]
    if (trace && !this.scene.unsupportedCopper) this.checkTrace(trace)
    this.stats = {
      tracesChecked: Math.min(this.cursor, this.traces.length),
      findings: this.findings.length,
      unsupportedCopper: this.scene.unsupportedCopper,
    }
    if (this.cursor >= this.traces.length) this.solved = true
  }
  private checkTrace(trace: PcbTrace) {
    const board = this.input.circuitJson.find((e) => e.type === "pcb_board")
    const clearance = Math.max(
      this.input.options?.clearance ?? 0.15,
      board?.type === "pcb_board"
        ? (board.min_trace_to_pad_edge_clearance ?? 0)
        : 0,
    )
    for (let start = 0; start < trace.route.length - 2; start++) {
      for (
        let end = Math.min(
          start + (this.input.options?.maxWindowSegments ?? 6),
          trace.route.length - 1,
        );
        end >= start + 2;
        end--
      ) {
        const route = trace.route.slice(start, end + 1)
        const first = route[0]
        if (
          first.route_type !== "wire" ||
          route.some((p) => p.route_type !== "wire" || p.layer !== first.layer)
        )
          continue
        const wires = route.filter((p) => p.route_type === "wire")
        if (
          wires
            .slice(1, -1)
            .some((p) => p.start_pcb_port_id || p.end_pcb_port_id)
        )
          continue
        const width = Math.max(...wires.map((p) => p.width))
        if (wires.some((p) => Math.abs(p.width - width) > 1e-6)) continue
        const original = wires.map(({ x, y }) => ({ x, y }))
        if (segments(original).some((s) => distance(s.a, s.b) < 1e-6)) continue
        const strange = segments(original).some(
          (s) => distance(s.a, s.b) > 0.15 && !isOctilinear(s),
        )
        const obstacles = this.scene.obstacles.filter(
          (o) =>
            !(
              o.traceId === trace.pcb_trace_id &&
              o.routeIndex !== undefined &&
              o.routeIndex >= start - 1 &&
              o.routeIndex <= end
            ),
        )
        const adjacent = this.scene.obstacles.filter(
          (o) =>
            o.traceId === trace.pcb_trace_id &&
            (o.routeIndex === start - 1 || o.routeIndex === end),
        )
        const context = {
          layer: first.layer,
          width,
          clearance,
          obstacles,
          board,
        }
        // Require room around the existing path as well, suppressing crowded fanouts.
        if (
          !pathIsClear({
            path: original,
            ...context,
            clearance: clearance + 0.05,
          })
        )
          continue
        const suggested = replacements(original[0], original.at(-1)!).find(
          (path) => {
            const saved = pathLength(original) - pathLength(path)
            return (
              segments(path).every((s) =>
                adjacent.every((o) => onlyTouchesAtSharedEndpoint(s, o)),
              ) &&
              (strange
                ? saved >= -1e-6
                : saved >= (this.input.options?.minLengthSaved ?? 0.2)) &&
              path.length < original.length &&
              pathIsClear({ path, ...context })
            )
          },
        )
        if (!suggested) continue
        const lengthSaved = pathLength(original) - pathLength(suggested)
        const kind = strange ? "strange_angle" : "unnecessary_jitter"
        this.findings.push({
          id: `${trace.pcb_trace_id}-${start}-${end}`,
          pcb_trace_id: trace.pcb_trace_id,
          layer: first.layer,
          startRouteIndex: start,
          endRouteIndex: end,
          kind,
          original,
          suggested,
          width,
          lengthSaved,
          clearance,
          explanation: `${strange ? "Off-grid angles" : "Unnecessary bends"}: ${original.length - 2} bends can become ${suggested.length - 2}; saves ${Math.max(0, lengthSaved).toFixed(2)} mm. Clear alternative at ${clearance.toFixed(2)} mm clearance.`,
        })
        start = end - 1
        break
      }
    }
  }
  computeProgress() {
    return this.traces.length
      ? Math.min(1, this.cursor / this.traces.length)
      : 1
  }
  override getConstructorParams() {
    return [this.input]
  }
  override getOutput() {
    return {
      findings: this.findings,
      skippedUnsupportedGeometry: this.scene.unsupportedCopper,
    }
  }
  override visualize(): GraphicsObject {
    return {
      lines: [
        ...this.scene.obstacles
          .filter((o) => o.traceId)
          .map((o) => ({ points: [o.a, o.b], strokeColor: "#666" })),
        ...this.findings.flatMap((f) => [
          { points: f.original, strokeColor: "#ff3344" },
          { points: f.suggested, strokeColor: "#00ccbb" },
        ]),
      ],
    }
  }
}
export function checkUglyTraces(input: CheckInput) {
  const solver = new UglyTracesSolver(input)
  solver.solve()
  if (solver.failed) throw new Error(solver.error ?? "Solver failed")
  return solver.getOutput()
}
