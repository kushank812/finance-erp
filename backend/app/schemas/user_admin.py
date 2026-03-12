from pydantic import BaseModel, Field


class UserCreateIn(BaseModel):
    user_id: str
    full_name: str
    password: str = Field(min_length=8)
    role: str


class UserUpdateIn(BaseModel):
    full_name: str
    role: str
    is_active: bool


class UserResetPasswordIn(BaseModel):
    new_password: str = Field(min_length=8)


class UserOut(BaseModel):
    user_id: str
    full_name: str
    is_active: bool
    role: str