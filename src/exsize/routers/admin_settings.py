from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user
from exsize.models import AppSetting, User

router = APIRouter(prefix="/api/admin/settings", tags=["admin-settings"])


def _settings_to_dict(rows: list[AppSetting]) -> dict:
    result = {}
    for row in rows:
        if row.key == "max_exbucks_per_task":
            result[row.key] = int(row.value)
        else:
            result[row.key] = row.value
    return result


@router.get("")
def get_app_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access app settings")
    return _settings_to_dict(db.query(AppSetting).all())


@router.get("/public")
def get_public_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns settings any authenticated user needs (e.g. task form limits)."""
    setting = db.query(AppSetting).filter(AppSetting.key == "max_exbucks_per_task").first()
    return {"max_exbucks_per_task": int(setting.value) if setting else None}


class UpdateAppSettingsRequest(BaseModel):
    max_exbucks_per_task: int | None = None


@router.patch("")
def update_app_settings(body: UpdateAppSettingsRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update app settings")
    if body.max_exbucks_per_task is not None:
        setting = db.query(AppSetting).filter(AppSetting.key == "max_exbucks_per_task").first()
        if setting:
            setting.value = str(body.max_exbucks_per_task)
        else:
            db.add(AppSetting(key="max_exbucks_per_task", value=str(body.max_exbucks_per_task)))
        db.commit()
    return _settings_to_dict(db.query(AppSetting).all())
