from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user
from exsize.models import Transaction, User

router = APIRouter(prefix="/api/exbucks", tags=["exbucks"])


class BalanceResponse(BaseModel):
    balance: int


class TransactionResponse(BaseModel):
    id: int
    type: str
    amount: int
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/balance", response_model=BalanceResponse)
def get_balance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return BalanceResponse(balance=user.exbucks_balance)


@router.get("/transactions", response_model=list[TransactionResponse])
def list_transactions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txns = db.query(Transaction).filter(Transaction.user_id == user.id).order_by(Transaction.created_at.desc()).all()
    return txns


@router.get("/transactions/{child_id}", response_model=list[TransactionResponse])
def list_child_transactions(child_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can view child transactions")
    child = db.query(User).filter(
        User.id == child_id,
        User.family_id == user.family_id,
        User.role == "child",
    ).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found in your family")
    txns = db.query(Transaction).filter(Transaction.user_id == child_id).order_by(Transaction.created_at.desc()).all()
    return txns
