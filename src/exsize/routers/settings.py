from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user
from exsize.models import User

router = APIRouter(prefix="/api", tags=["settings"])


class SettingsResponse(BaseModel):
    language: str
    model_config = {"from_attributes": True}


class UpdateSettingsRequest(BaseModel):
    language: Literal["en", "pl"]


@router.get("/settings", response_model=SettingsResponse)
def get_settings(user: User = Depends(get_current_user)):
    return SettingsResponse(language=user.language)


@router.patch("/settings", response_model=SettingsResponse)
def update_settings(
    body: UpdateSettingsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.language = body.language
    db.add(user)
    db.commit()
    db.refresh(user)
    return SettingsResponse(language=user.language)
