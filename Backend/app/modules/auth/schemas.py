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


class EmailInput(Input):
    email: str = Field(min_length=3, max_length=255, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class EmailLogin(EmailInput):
    model_config = ConfigDict(str_strip_whitespace=False)
    password: str = Field(min_length=1, max_length=256)


class VerifyMfa(Input):
    challenge_token: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    code: str = Field(pattern=r"^[0-9]{6}$")


class ResetPassword(Input):
    model_config = ConfigDict(str_strip_whitespace=False)
    token: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    password: str = Field(min_length=8, max_length=72)
    confirmation: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value):
        if len(value.encode()) > 72 or not any(char.isalpha() for char in value) or not any(char.isdigit() for char in value):
            raise ValueError("Password must contain letters and digits and at most 72 UTF-8 bytes.")
        return value

    @field_validator("confirmation")
    @classmethod
    def same_password(cls, value, info):
        if value != info.data.get("password"):
            raise ValueError("Password confirmation must match.")
        return value
