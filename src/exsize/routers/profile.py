from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from sqlalchemy import func as sa_func

from exsize.database import get_db
from exsize.deps import get_current_user, has_sizepass
from exsize.models import Transaction, User
from exsize.routers.gamification import LEVEL_NAMES, progress_percent, xp_for_next_level

router = APIRouter(prefix="/api/profile", tags=["profile"])


NICKNAME_CHANGE_COST = 50


class NicknameRequest(BaseModel):
    nickname: str


class NicknameResponse(BaseModel):
    nickname: str
    nickname_changes: int


class TransactionItem(BaseModel):
    id: int
    type: str
    amount: int
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProfileResponse(BaseModel):
    nickname: str | None = None
    xp: int
    level: int
    level_name: str
    progress_percent: int
    xp_for_next_level: int
    streak: int
    exbucks_balance: int
    badges: list[str]
    transactions: list[TransactionItem]


SIZEPASS_MILESTONE_BADGES = {
    5: "Rising Star",
    10: "SizePass Pro",
    20: "SizePass Elite",
    30: "SizePass Master",
    40: "SizePass Hero",
    50: "SizePass Legend",
}


def _build_profile(child: User, db: Session) -> ProfileResponse:
    txns = db.query(Transaction).filter(
        Transaction.user_id == child.id,
    ).order_by(Transaction.created_at.desc()).all()

    if has_sizepass(child.family_id, db):
        badges = ["SizePass"]
        for level_threshold, badge_name in SIZEPASS_MILESTONE_BADGES.items():
            if child.level >= level_threshold:
                badges.append(badge_name)
    else:
        badges = ["Freemium"]

    return ProfileResponse(
        nickname=child.nickname,
        xp=child.xp,
        level=child.level,
        level_name=LEVEL_NAMES[child.level - 1],
        progress_percent=progress_percent(child.xp, child.level),
        xp_for_next_level=xp_for_next_level(child.level),
        streak=child.streak,
        exbucks_balance=child.exbucks_balance,
        badges=badges,
        transactions=txns,
    )


@router.get("", response_model=ProfileResponse)
def get_own_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "child":
        raise HTTPException(status_code=403, detail="Only children have profiles")
    return _build_profile(user, db)


@router.get("/{child_id}", response_model=ProfileResponse)
def get_child_profile(child_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can view child profiles")
    child = db.query(User).filter(
        User.id == child_id,
        User.family_id == user.family_id,
        User.role == "child",
    ).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found in your family")
    return _build_profile(child, db)


@router.patch("/nickname", response_model=NicknameResponse)
def set_nickname(body: NicknameRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "child":
        raise HTTPException(status_code=403, detail="Only children can set nicknames")

    existing = db.query(User).filter(
        sa_func.lower(User.nickname) == body.nickname.lower(),
        User.id != user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Nickname already taken")

    is_first_change = user.nickname_changes == 0
    if not is_first_change:
        if user.exbucks_balance < NICKNAME_CHANGE_COST:
            raise HTTPException(status_code=400, detail="Insufficient ExBucks balance")
        user.exbucks_balance -= NICKNAME_CHANGE_COST
        db.add(Transaction(
            user_id=user.id, type="spent", amount=-NICKNAME_CHANGE_COST,
            description="Nickname change",
        ))

    user.nickname = body.nickname
    user.nickname_changes += 1
    db.commit()
    db.refresh(user)
    return NicknameResponse(nickname=user.nickname, nickname_changes=user.nickname_changes)
