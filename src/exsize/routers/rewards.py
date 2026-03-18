from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user
from exsize.models import Purchase, Reward, Transaction, User

router = APIRouter(prefix="/api/rewards", tags=["rewards"])


class RewardCreateRequest(BaseModel):
    name: str
    description: str
    price: int


class RewardResponse(BaseModel):
    id: int
    name: str
    description: str
    price: int

    model_config = {"from_attributes": True}


@router.post("", response_model=RewardResponse, status_code=status.HTTP_201_CREATED)
def create_reward(body: RewardCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage rewards")
    reward = Reward(name=body.name, description=body.description, price=body.price)
    db.add(reward)
    db.commit()
    db.refresh(reward)
    return reward


@router.get("", response_model=list[RewardResponse])
def list_rewards(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Reward).all()


class PurchaseResponse(BaseModel):
    id: int
    reward_name: str
    price: int
    created_at: str


@router.get("/purchases", response_model=list[PurchaseResponse])
def list_purchases(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    purchases = db.query(Purchase).filter(Purchase.user_id == user.id).order_by(Purchase.created_at.desc()).all()
    result = []
    for p in purchases:
        reward = db.query(Reward).filter(Reward.id == p.reward_id).first()
        result.append({
            "id": p.id,
            "reward_name": reward.name if reward else "Deleted reward",
            "price": reward.price if reward else 0,
            "created_at": str(p.created_at),
        })
    return result


@router.get("/purchases/{child_id}", response_model=list[PurchaseResponse])
def list_child_purchases(child_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can view child purchases")
    child = db.query(User).filter(
        User.id == child_id,
        User.family_id == user.family_id,
        User.role == "child",
    ).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found in your family")
    purchases = db.query(Purchase).filter(Purchase.user_id == child_id).order_by(Purchase.created_at.desc()).all()
    result = []
    for p in purchases:
        reward = db.query(Reward).filter(Reward.id == p.reward_id).first()
        result.append({
            "id": p.id,
            "reward_name": reward.name if reward else "Deleted reward",
            "price": reward.price if reward else 0,
            "created_at": str(p.created_at),
        })
    return result


class RewardUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    price: int | None = None


@router.patch("/{reward_id}", response_model=RewardResponse)
def update_reward(reward_id: int, body: RewardUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage rewards")
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    if body.name is not None:
        reward.name = body.name
    if body.description is not None:
        reward.description = body.description
    if body.price is not None:
        reward.price = body.price
    db.commit()
    db.refresh(reward)
    return reward


@router.delete("/{reward_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reward(reward_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage rewards")
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    db.delete(reward)
    db.commit()


@router.post("/{reward_id}/purchase", status_code=status.HTTP_201_CREATED)
def purchase_reward(reward_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "child":
        raise HTTPException(status_code=403, detail="Only children can purchase rewards")
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    if user.exbucks_balance < reward.price:
        raise HTTPException(status_code=400, detail="Insufficient ExBucks balance")
    user.exbucks_balance -= reward.price
    purchase = Purchase(user_id=user.id, reward_id=reward.id)
    txn = Transaction(
        user_id=user.id,
        type="spent",
        amount=reward.price,
        description=reward.name,
    )
    db.add(purchase)
    db.add(txn)
    db.commit()
    db.refresh(purchase)
    return {
        "id": purchase.id,
        "reward_name": reward.name,
        "price": reward.price,
        "created_at": str(purchase.created_at),
    }
