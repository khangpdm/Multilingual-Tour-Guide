import type { Poi, Zone } from '../../admin/types'

export function validLocation(location: Poi['location']) {
  return Number.isFinite(location.lat) && Number.isFinite(location.lng) && Math.abs(location.lat) <= 90 && Math.abs(location.lng) <= 180
}

export function locationInZone(location: Poi['location'], zone: Zone) {
  if (!validLocation(location)) return false
  const [west, south, east, north] = zone.map_region.bbox
  if (location.lng < west || location.lng > east || location.lat < south || location.lat > north) return false
  if (!zone.boundary?.length) return true
  let inside = false
  for (let index = 0; index < zone.boundary.length - 1; index += 1) {
    const start = zone.boundary[index]
    const end = zone.boundary[index + 1]
    const cross = (location.lat - start[1]) * (end[0] - start[0]) - (location.lng - start[0]) * (end[1] - start[1])
    if (Math.abs(cross) < 1e-10 && location.lng >= Math.min(start[0], end[0]) && location.lng <= Math.max(start[0], end[0]) && location.lat >= Math.min(start[1], end[1]) && location.lat <= Math.max(start[1], end[1])) return true
    if ((start[1] > location.lat) !== (end[1] > location.lat)) {
      const crossing = start[0] + (location.lat - start[1]) * (end[0] - start[0]) / (end[1] - start[1])
      if (location.lng < crossing) inside = !inside
    }
  }
  return inside
}
