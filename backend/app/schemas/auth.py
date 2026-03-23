from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    login_id: str
    password: str
    remember_session: bool = True


class UserMeOut(BaseModel):
    user_id: str
    full_name: str
    is_active: bool
    role: str


class LoginOut(BaseModel):
    ok: bool
    user: UserMeOut


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=8)
    new_password: str = Field(min_length=8)