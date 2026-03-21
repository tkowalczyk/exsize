from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user
from exsize.models import DeletionRequest, Family, Purchase, Subscription, Task, Transaction, User

router = APIRouter(prefix="/api/account", tags=["account"])


def _age_from_dob(dob_str: str | None) -> int | None:
    if not dob_str:
        return None
    dob = date.fromisoformat(dob_str)
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _delete_user_data(user_id: int, db: Session):
    """Delete all data associated with a user."""
    db.query(DeletionRequest).filter(DeletionRequest.child_id == user_id).delete()
    db.query(Transaction).filter(Transaction.user_id == user_id).delete()
    db.query(Purchase).filter(Purchase.user_id == user_id).delete()
    db.query(Task).filter(Task.assigned_to == user_id).delete()
    db.query(Task).filter(Task.created_by == user_id).delete()
    db.query(User).filter(User.id == user_id).delete()


@router.delete("/children/{child_id}")
def delete_child_account(
    child_id: int,
    confirm: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can delete child accounts")
    if user.family_id is None:
        raise HTTPException(status_code=404, detail="Not in a family")
    child = db.query(User).filter(
        User.id == child_id, User.family_id == user.family_id, User.role == "child"
    ).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found in your family")
    if not confirm:
        return {"warning": "This will permanently delete the child's account and all their data. Set confirm=true to proceed."}
    _delete_user_data(child_id, db)
    db.commit()
    return {"detail": "Child account and all associated data have been permanently deleted"}


def _is_last_parent(user: User, db: Session) -> bool:
    if user.role != "parent" or user.family_id is None:
        return False
    other_parents = db.query(User).filter(
        User.family_id == user.family_id, User.role == "parent", User.id != user.id
    ).count()
    return other_parents == 0


def _delete_family_data(family_id: int, db: Session):
    """Delete all data for every member of a family, then the family itself."""
    members = db.query(User).filter(User.family_id == family_id).all()
    for member in members:
        _delete_user_data(member.id, db)
    db.query(Task).filter(Task.family_id == family_id).delete()
    db.query(DeletionRequest).filter(DeletionRequest.family_id == family_id).delete()
    db.query(Subscription).filter(Subscription.family_id == family_id).delete()
    db.query(Family).filter(Family.id == family_id).delete()


@router.delete("/me")
def delete_own_account(
    confirm: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role == "child":
        age = _age_from_dob(user.date_of_birth)
        if age is None or age < 16:
            raise HTTPException(
                status_code=403,
                detail="Children under 16 cannot delete their own account. Please ask a parent to approve your deletion request.",
            )
    last_parent = _is_last_parent(user, db)
    if not confirm:
        if last_parent:
            return {"warning": "You are the last parent in your family. This will permanently delete your account AND all family data including all children's accounts. Set confirm=true to proceed."}
        return {"warning": "This will permanently delete your account and all your data. Set confirm=true to proceed."}
    if last_parent:
        _delete_family_data(user.family_id, db)
    else:
        _delete_user_data(user.id, db)
    db.commit()
    return {"detail": "Your account and all associated data have been permanently deleted"}


class DeletionRequestResponse(BaseModel):
    id: int
    child_id: int
    status: str

    model_config = {"from_attributes": True}


@router.post("/deletion-requests", response_model=DeletionRequestResponse, status_code=status.HTTP_201_CREATED)
def request_deletion(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "child":
        raise HTTPException(status_code=403, detail="Only children can request deletion")
    if user.family_id is None:
        raise HTTPException(status_code=400, detail="Not in a family")
    existing = db.query(DeletionRequest).filter(
        DeletionRequest.child_id == user.id, DeletionRequest.status == "pending"
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Deletion request already pending")
    req = DeletionRequest(child_id=user.id, family_id=user.family_id)
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/deletion-requests", response_model=list[DeletionRequestResponse])
def list_deletion_requests(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can view deletion requests")
    if user.family_id is None:
        raise HTTPException(status_code=404, detail="Not in a family")
    return db.query(DeletionRequest).filter(
        DeletionRequest.family_id == user.family_id, DeletionRequest.status == "pending"
    ).all()


@router.post("/deletion-requests/{request_id}/approve")
def approve_deletion_request(
    request_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can approve deletion requests")
    if user.family_id is None:
        raise HTTPException(status_code=404, detail="Not in a family")
    req = db.query(DeletionRequest).filter(
        DeletionRequest.id == request_id,
        DeletionRequest.family_id == user.family_id,
        DeletionRequest.status == "pending",
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Deletion request not found")
    _delete_user_data(req.child_id, db)
    req.status = "approved"
    db.commit()
    return {"detail": "Deletion request approved. Child account has been permanently deleted."}
