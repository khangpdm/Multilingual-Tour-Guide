from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime

# =====================================================
# TELEMETRY SCHEMAS
# =====================================================

class TelematryEvent(BaseModel):
    model_config = ConfigDict(extra='forbid')

    client_event_id: str
    event_type: str

    poi_id: Optional[str] = None
    zone_id: Optional[str] = None
    language_code: Optional[str] = None

    trigger_source: Optional[str] = None
    audio_tier: Optional[str] = None

    occurred_at: datetime

class TelemetryEventRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    events: list[TelematryEvent] = Field(min_length=1)

class POIVisit(BaseModel):
    model_config = ConfigDict(extra='forbid')

    poi_id: str
    occurred_at: datetime

class POIVisitRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    visits: list[POIVisit] = Field(min_length=1)