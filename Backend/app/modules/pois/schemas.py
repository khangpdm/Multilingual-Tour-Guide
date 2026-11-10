import re

from pydantic import Field, model_validator

from app.schemas.base import Input


class Location(Input):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class ContentInput(Input):
    name: str = Field(min_length=1, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    text: str = Field(min_length=1, max_length=5000)


class PoiFields(Input):
    category: str = Field(min_length=1, max_length=50)
    zone_id: str = Field(min_length=1, max_length=100)
    location: Location
    geofence_radius_m: int = Field(ge=10, le=200, default=30)


class PoiCreate(PoiFields):
    content: dict[str, ContentInput]

    @model_validator(mode="after")
    def validate_content(self):
        if "vi" not in self.content or any(not re.fullmatch(r"[a-z]{2,3}(-[A-Z]{2})?", code) for code in self.content):
            raise ValueError("Vietnamese content and valid locale codes are required.")
        return self


class Reason(Input):
    reason: str = Field(min_length=5, max_length=500)


class QrInput(Input):
    regenerate: bool = False