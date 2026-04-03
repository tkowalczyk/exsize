from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user, has_sizepass
from exsize.models import AvatarItem, User


def _get_avatar_values(user: User, db: Session) -> tuple[str | None, str | None]:
    """Return (icon_value, background_value) for a user's equipped avatar."""
    icon = db.query(AvatarItem.value).filter(AvatarItem.id == user.equipped_icon_id).scalar() if user.equipped_icon_id else None
    bg = db.query(AvatarItem.value).filter(AvatarItem.id == user.equipped_background_id).scalar() if user.equipped_background_id else None
    return icon, bg

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

TOP_N = 50


class LeaderboardEntry(BaseModel):
    id: int
    email: str
    nickname: str | None = None
    avatar_icon: str | None = None
    avatar_background: str | None = None
    xp: int
    level: int
    streak: int


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]


class GlobalLeaderboardEntry(BaseModel):
    id: int
    email: str
    nickname: str | None = None
    avatar_icon: str | None = None
    avatar_background: str | None = None
    xp: int
    level: int
    streak: int
    position: int


class GlobalLeaderboardResponse(BaseModel):
    entries: list[GlobalLeaderboardEntry]
    user_entry: GlobalLeaderboardEntry | None = None


@router.get("/global", response_model=GlobalLeaderboardResponse)
def get_global_leaderboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    top_children = db.query(User).filter(
        User.role == "child",
    ).order_by(User.xp.desc(), User.id).limit(TOP_N).all()

    entries = []
    for i, c in enumerate(top_children):
        icon, bg = _get_avatar_values(c, db)
        entries.append(GlobalLeaderboardEntry(
            id=c.id, email=c.email, nickname=c.nickname,
            avatar_icon=icon, avatar_background=bg,
            xp=c.xp, level=c.level, streak=c.streak,
            position=i + 1,
        ))

    top_ids = {c.id for c in top_children}
    user_entry = None
    if user.role == "child" and user.id not in top_ids:
        position = db.query(User).filter(
            User.role == "child",
            User.xp > user.xp,
        ).count() + 1
        # Account for ties — count users with same XP but lower id
        position += db.query(User).filter(
            User.role == "child",
            User.xp == user.xp,
            User.id < user.id,
        ).count()
        u_icon, u_bg = _get_avatar_values(user, db)
        user_entry = GlobalLeaderboardEntry(
            id=user.id, email=user.email, nickname=user.nickname,
            avatar_icon=u_icon, avatar_background=u_bg,
            xp=user.xp, level=user.level, streak=user.streak,
            position=position,
        )

    return GlobalLeaderboardResponse(entries=entries, user_entry=user_entry)


@router.get("", response_model=LeaderboardResponse)
def get_leaderboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.family_id is None:
        raise HTTPException(status_code=400, detail="Must be in a family")
    if not has_sizepass(user.family_id, db):
        raise HTTPException(status_code=403, detail="Sibling leaderboard requires SizePass. Upgrade to access.")
    children = db.query(User).filter(
        User.family_id == user.family_id,
        User.role == "child",
    ).order_by(User.xp.desc()).all()
    entries = []
    for c in children:
        icon, bg = _get_avatar_values(c, db)
        entries.append(LeaderboardEntry(
            id=c.id, email=c.email, nickname=c.nickname,
            avatar_icon=icon, avatar_background=bg,
            xp=c.xp, level=c.level, streak=c.streak,
        ))
    return LeaderboardResponse(entries=entries)
