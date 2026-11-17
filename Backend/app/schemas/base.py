from copy import deepcopy

from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ConfigDict, ValidationError, create_model


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


def partial_model(name, model):
    fields = {}
    for field_name, field in model.model_fields.items():
        optional = deepcopy(field)
        optional.default = None
        fields[field_name] = (field.annotation, optional)
    return create_model(name, __base__=Input, **fields)


def validate_input(model, data):
    try:
        return model.model_validate(data)
    except ValidationError as error:
        raise RequestValidationError(error.errors()) from error
