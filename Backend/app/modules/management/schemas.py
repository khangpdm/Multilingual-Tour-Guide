from pydantic import ConfigDict, Field, field_validator

from app.schemas.base import Input


class RoleCreate(Input):
    role_id: str = Field(pattern=r"^[a-z][a-z0-9_]{2,31}$")
    name: str = Field(min_length=1, max_length=100)
    level: int = Field(ge=1, le=2)
    permission_ids: list[str] = Field(default_factory=list, max_length=100)


class PermissionChanges(Input):
    grant: list[str] = Field(default_factory=list, max_length=100)
    revoke: list[str] = Field(default_factory=list, max_length=100)


class UserInvite(Input):
    email: str = Field(min_length=3, max_length=255, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    full_name: str | None = Field(default=None, max_length=255)
    role_id: str = Field(min_length=1, max_length=50)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.lower()


class UserEdit(Input):
    full_name: str | None = Field(default=None, max_length=255)
    role_id: str | None = Field(default=None, min_length=1, max_length=50)


class Activation(Input):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    token: str = Field(min_length=32, max_length=128)
    password: str = Field(min_length=10, max_length=72)
    full_name: str = Field(min_length=1, max_length=255)

    @field_validator("password", mode="before")
    @classmethod
    def validate_password(cls, value):
        if not isinstance(value, str) or len(value.encode()) > 72 or not any(char.isalpha() for char in value) or not any(char.isdigit() for char in value):
            raise ValueError("Password must contain letters and digits and at most 72 UTF-8 bytes.")
        return value

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, value):
        if not value.strip():
            raise ValueError("Enter a full name.")
        return value.strip()
