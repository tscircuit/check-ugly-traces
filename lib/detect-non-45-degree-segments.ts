import {
  distance,
  segments,
  getSegmentAngle,
  ANGLE_EPSILON_DEGREES,
  type Point,
} from "./geometry"

export function detectNon45DegreeSegments(points: Point[]) {
  return segments(points).flatMap((segment, segmentIndex) => {
    if (distance(segment.a, segment.b) < 1e-6) return []
    const angle = getSegmentAngle(segment)
    return angle.deviationDegrees > ANGLE_EPSILON_DEGREES
      ? [{ segmentIndex, ...angle }]
      : []
  })
}
