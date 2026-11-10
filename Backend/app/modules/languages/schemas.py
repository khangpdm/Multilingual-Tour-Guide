from pydantic import Field

from app.schemas.base import Input


class LanguageFields(Input):
    name: str = Field(min_length=1, max_length=100)
    native_name: str = Field(min_length=1, max_length=100)
    is_active: bool = False
    is_default: bool = False
    display_order: int = Field(ge=0, le=10000)


class LanguageCreate(LanguageFields):
    code: str = Field(pattern=r"^[a-z]{2,3}(-[A-Z]{2})?$")