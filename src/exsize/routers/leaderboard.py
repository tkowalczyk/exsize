from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user, has_sizepass
from exsize.models import User

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

TOP_N = 50


class LeaderboardEntry(BaseModel):
    id: int
    email: str
    nickname: str | None = None
    xp: int
    level: int


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

    entries = [
        GlobalLeaderboardEntry(
            id=c.id, email=c.email, nickname=c.nickname,
            avatar_icon=None, avatar_background=None,
            xp=c.xp, level=c.level, streak=c.streak,
            position=i + 1,
        )
        for i, c in enumerate(top_children)
    ]

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
        user_entry = GlobalLeaderboardEntry(
            id=user.id, email=user.email, nickname=user.nickname,
            avatar_icon=None, avatar_background=None,
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
    entries = [
        LeaderboardEntry(id=c.id, email=c.email, nickname=c.nickname, xp=c.xp, level=c.level)
        for c in children
    ]
    return LeaderboardResponse(entries=entries)
