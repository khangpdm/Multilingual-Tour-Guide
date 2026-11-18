def on_segment(point, start, end):
    cross = (point[1] - start[1]) * (end[0] - start[0]) - (point[0] - start[0]) * (end[1] - start[1])
    return abs(cross) < 1e-10 and min(start[0], end[0]) <= point[0] <= max(start[0], end[0]) and min(start[1], end[1]) <= point[1] <= max(start[1], end[1])


def contains(zone, longitude, latitude):
    west, south, east, north = zone["map_region"]["bbox"]
    if not (west <= longitude <= east and south <= latitude <= north):
        return False
    boundary = zone.get("boundary")
    if not boundary:
        return True
    point = (longitude, latitude)
    inside = False
    for start, end in zip(boundary, boundary[1:]):
        if on_segment(point, start, end):
            return True
        if (start[1] > latitude) != (end[1] > latitude):
            crossing = start[0] + (latitude - start[1]) * (end[0] - start[0]) / (end[1] - start[1])
            if longitude < crossing:
                inside = not inside
    return inside


def intersects(first, second, third, fourth):
    def direction(start, end, point):
        return (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0])
    if any((on_segment(third, first, second), on_segment(fourth, first, second), on_segment(first, third, fourth), on_segment(second, third, fourth))):
        return True
    return direction(first, second, third) * direction(first, second, fourth) < 0 and direction(third, fourth, first) * direction(third, fourth, second) < 0
