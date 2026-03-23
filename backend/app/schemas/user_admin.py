from pydantic import BaseModel, Field, ConfigDict


class UserCreateIn(BaseModel):
    user_id: str
    full_name: str
    email: str | None = None
    password: str = Field(min_length=8)
    role: str


class UserUpdateIn(BaseModel):
    full_name: str
    email: str | None = None
    role: str
    is_active: bool


class UserResetPasswordIn(BaseModel):
    new_password: str = Field(min_length=8)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    full_name: str
    email: str | None = None
    is_active: bool
    role: str