from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user
from exsize.models import Subscription, User

router = APIRouter(prefix="/api/subscription", tags=["subscription"])


class SubscriptionResponse(BaseModel):
    plan: str
    status: str

    model_config = {"from_attributes": True}


class CheckoutRequest(BaseModel):
    plan: Literal["monthly", "yearly"]


@router.post("/checkout", response_model=SubscriptionResponse)
def checkout(body: CheckoutRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in ("parent", "admin"):
        raise HTTPException(status_code=403, detail="Only parents can purchase SizePass")
    if user.family_id is None:
        raise HTTPException(status_code=400, detail="You must belong to a family to subscribe")
    existing = db.query(Subscription).filter(
        Subscription.family_id == user.family_id,
        Subscription.status == "active",
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Family already has an active subscription")
    sub = Subscription(family_id=user.family_id, plan=body.plan, status="active")
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return SubscriptionResponse(plan=sub.plan, status=sub.status)


@router.post("/cancel", response_model=SubscriptionResponse)
def cancel(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in ("parent", "admin"):
        raise HTTPException(status_code=403, detail="Only parents can cancel SizePass")
    if user.family_id is None:
        raise HTTPException(status_code=400, detail="You must belong to a family")
    sub = db.query(Subscription).filter(
        Subscription.family_id == user.family_id,
        Subscription.status == "active",
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription to cancel")
    sub.status = "cancelled"
    db.commit()
    db.refresh(sub)
    return SubscriptionResponse(plan=sub.plan, status=sub.status)


@router.get("", response_model=SubscriptionResponse)
def get_subscription(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.family_id is None:
        return SubscriptionResponse(plan="free", status="free")
    sub = db.query(Subscription).filter(Subscription.family_id == user.family_id).first()
    if not sub:
        return SubscriptionResponse(plan="free", status="free")
    return SubscriptionResponse(plan=sub.plan, status=sub.status)
