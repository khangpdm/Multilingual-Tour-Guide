from typing import Annotated

from pydantic import Field, model_validator

from app.schemas.base import Input, partial_model
from app.modules.zones.geometry import intersects


class MapRegion(Input):
    bbox: list[float] = Field(min_length=4, max_length=4)
    min_zoom: int = Field(ge=0, le=22)
    max_zoom: int = Field(ge=0, le=22)

    @model_validator(mode="after")
    def validate_bounds(self):
        west, south, east, north = self.bbox
        if not (-180 <= west < east <= 180 and -90 <= south < north <= 90 and east - west <= 1 and north - south <= 1 and self.min_zoom <= self.max_zoom):
            raise ValueError("Invalid map bounds or zoom range.")
        return self


class ZoneInput(Input):
    name: str = Field(min_length=1, max_length=100)
    names: dict[Annotated[str, Field(pattern=r"^[a-z]{2,3}(-[A-Z]{2})?$")], Annotated[str, Field(min_length=1, max_length=100)]] | None = Field(default=None, max_length=30)
    description: str | None = Field(default=None, max_length=2000)
    cover_image: str | None = Field(default=None, max_length=500)
    map_region: MapRegion
    is_active: bool = True
    boundary: list[tuple[float, float]] | None = Field(default=None, min_length=4, max_length=500)

    @model_validator(mode="after")
    def validate_boundary(self):
        if self.boundary is None:
            return self
        west, south, east, north = self.map_region.bbox
        if self.boundary[0] != self.boundary[-1] or any(not (west <= longitude <= east and south <= latitude <= north) for longitude, latitude in self.boundary):
            raise ValueError("Boundary must be a closed polygon inside the bbox.")
        segments = list(zip(self.boundary, self.boundary[1:]))
        if len(set(self.boundary[:-1])) != len(segments) or abs(sum(start[0] * end[1] - end[0] * start[1] for start, end in segments)) < 1e-12:
            raise ValueError("Boundary must have distinct vertices and nonzero area.")
        for index, (start, end) in enumerate(segments):
            for other_index in range(index + 2, len(segments)):
                if index == 0 and other_index == len(segments) - 1:
                    continue
                if intersects(start, end, *segments[other_index]):
                    raise ValueError("Boundary must not intersect itself.")
        return self

ZonePatch = partial_model("ZonePatch", ZoneInput)
