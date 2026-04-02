import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user, has_sizepass
from exsize.models import AvatarItem, Family, User, UserInventory

router = APIRouter(prefix="/api/family", tags=["family"])


def _generate_pin() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


def _unique_pin(db: Session) -> str:
    for _ in range(100):
        pin = _generate_pin()
        if not db.query(Family).filter(Family.pin == pin).first():
            return pin
    raise RuntimeError("Could not generate unique PIN")


class FamilyResponse(BaseModel):
    id: int
    pin: str

    model_config = {"from_attributes": True}


@router.post("", response_model=FamilyResponse, status_code=status.HTTP_201_CREATED)
def create_family(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can create a family")
    if user.family_id is not None:
        raise HTTPException(status_code=409, detail="Already in a family")
    pin = _unique_pin(db)
    family = Family(pin=pin, created_by=user.id)
    db.add(family)
    db.flush()
    user.family_id = family.id
    db.commit()
    db.refresh(family)
    return family


class JoinRequest(BaseModel):
    pin: str


class JoinResponse(BaseModel):
    family_id: int


FREE_TIER_MAX_PARENTS = 2
FREE_TIER_MAX_CHILDREN = 1


@router.post("/join", response_model=JoinResponse)
def join_family(body: JoinRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.family_id is not None:
        raise HTTPException(status_code=409, detail="Already in a family")
    family = db.query(Family).filter(Family.pin == body.pin).first()
    if not family:
        raise HTTPException(status_code=404, detail="Invalid PIN")
    members = db.query(User).filter(User.family_id == family.id).all()
    if not has_sizepass(family.id, db):
        role_count = sum(1 for m in members if m.role == user.role)
        limit = FREE_TIER_MAX_PARENTS if user.role == "parent" else FREE_TIER_MAX_CHILDREN
        if role_count >= limit:
            raise HTTPException(status_code=403, detail=f"Free tier limit reached: max {limit} {user.role}(s). Upgrade to SizePass to add more.")
    user.family_id = family.id
    if user.role == "child":
        free_defaults = db.query(AvatarItem).filter(
            AvatarItem.is_default == True,
            AvatarItem.price == 0,
        ).all()
        for item in free_defaults:
            db.add(UserInventory(user_id=user.id, avatar_item_id=item.id))
            if item.type == "icon":
                user.equipped_icon_id = item.id
            elif item.type == "background":
                user.equipped_background_id = item.id
    db.commit()
    return JoinResponse(family_id=family.id)


class MemberResponse(BaseModel):
    id: int
    email: str
    role: str

    model_config = {"from_attributes": True}


class FamilyDetailResponse(BaseModel):
    id: int
    pin: str
    members: list[MemberResponse]


@router.get("", response_model=FamilyDetailResponse)
def get_family(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.family_id is None:
        raise HTTPException(status_code=404, detail="Not in a family")
    family = db.query(Family).filter(Family.id == user.family_id).first()
    members = db.query(User).filter(User.family_id == family.id).all()
    return FamilyDetailResponse(id=family.id, pin=family.pin, members=members)


@router.delete("/members/{user_id}")
def remove_member(user_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can remove members")
    if user.family_id is None:
        raise HTTPException(status_code=404, detail="Not in a family")
    target = db.query(User).filter(User.id == user_id, User.family_id == user.family_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found in your family")
    if target.role != "child":
        raise HTTPException(status_code=403, detail="Can only remove children")
    target.family_id = None
    db.commit()
    return {"detail": "Member removed"}
