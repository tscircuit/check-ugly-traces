export type Point = { x: number; y: number }
export type Segment = { a: Point; b: Point }
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export function pointSegmentDistance(p: Point, { a, b }: Segment) {
  const denominator = distance(a, b) ** 2
  const t = denominator
    ? Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / denominator,
        ),
      )
    : 0
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
}
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x
const subtract = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y })
export function segmentDistance(s: Segment, t: Segment) {
  const r = subtract(s.b, s.a),
    q = subtract(t.b, t.a),
    offset = subtract(t.a, s.a)
  const denominator = cross(r, q)
  if (Math.abs(denominator) > 1e-12) {
    const u = cross(offset, r) / denominator,
      v = cross(offset, q) / denominator
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) return 0
  }
  return Math.min(
    pointSegmentDistance(s.a, t),
    pointSegmentDistance(s.b, t),
    pointSegmentDistance(t.a, s),
    pointSegmentDistance(t.b, s),
  )
}
export const segments = (points: Point[]) =>
  points.slice(1).map((b, i) => ({ a: points[i], b }))
export const pathLength = (points: Point[]) =>
  segments(points).reduce((sum, s) => sum + distance(s.a, s.b), 0)
export function isOctilinear({ a, b }: Segment) {
  const angle =
    Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 45
  return Math.min(angle, 45 - angle) < 3
}
export function replacements(a: Point, b: Point): Point[][] {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = Math.min(Math.abs(dx), Math.abs(dy))
  return [
    [a, b],
    [a, { x: a.x + Math.sign(dx) * d, y: a.y + Math.sign(dy) * d }, b],
    [a, { x: b.x - Math.sign(dx) * d, y: b.y - Math.sign(dy) * d }, b],
  ]
    .map((p) => p.filter((q, i) => !i || distance(q, p[i - 1]) > 1e-6))
    .filter((p) => segments(p).every(isOctilinear))
}
/** Connected segments may meet at one endpoint, but must not cross or double back. */
export function onlyTouchesAtSharedEndpoint(s: Segment, t: Segment) {
  if (segmentDistance(s, t) > 1e-8) return true
  const shared = [s.a, s.b].find(
    (p) => distance(p, t.a) < 1e-8 || distance(p, t.b) < 1e-8,
  )
  if (!shared) return false
  const otherS = distance(shared, s.a) < 1e-8 ? s.b : s.a
  const otherT = distance(shared, t.a) < 1e-8 ? t.b : t.a
  return (
    pointSegmentDistance(otherS, t) > 1e-8 &&
    pointSegmentDistance(otherT, s) > 1e-8
  )
}
