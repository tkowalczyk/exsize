from fastapi import APIRouter, Depends

from exsize.deps import get_current_user
from exsize.models import User

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(user: User = Depends(get_current_user)):
    return {"message": "Dashboard shell", "user_id": user.id}
