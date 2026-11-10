import re

from pydantic import ConfigDict, Field, field_validator

from app.schemas.base import Input


class Login(Input):
    model_config = ConfigDict(str_strip_whitespace=False)
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value):
        if not isinstance(value, str):
            raise ValueError("Enter a valid username.")
        value = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{2,49}", value):
            raise ValueError("Username must contain 3-50 letters, digits, dots, underscores or hyphens and start with a letter or digit.")
        return value
