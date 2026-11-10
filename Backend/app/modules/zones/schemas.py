from pydantic import Field, model_validator

from app.schemas.base import Input


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
    map_region: MapRegion
    is_active: bool = True