from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user
from exsize.models import Task, Transaction, User

router = APIRouter(prefix="/api", tags=["dashboard"])

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class ChildStats(BaseModel):
    id: int
    email: str
    tasks_completed_percent: int
    streak: int
    exbucks_earned: int
    exbucks_spent: int


class DayChild(BaseModel):
    child_id: int
    email: str
    total: int
    approved: int


class DashboardResponse(BaseModel):
    children: list[ChildStats]
    weekly_overview: dict[str, list[DayChild]]


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can view the dashboard")
    if user.family_id is None:
        raise HTTPException(status_code=400, detail="Must be in a family")

    children = db.query(User).filter(
        User.family_id == user.family_id,
        User.role == "child",
    ).all()

    tasks = db.query(Task).filter(Task.family_id == user.family_id).all()

    child_stats = []
    for child in children:
        child_tasks = [t for t in tasks if t.assigned_to == child.id]
        total = len(child_tasks)
        approved = sum(1 for t in child_tasks if t.status == "approved")
        pct = int(approved * 100 / total) if total > 0 else 0

        txns = db.query(Transaction).filter(Transaction.user_id == child.id).all()
        earned = sum(t.amount for t in txns if t.type == "earned")
        spent = sum(t.amount for t in txns if t.type == "spent")

        child_stats.append(ChildStats(
            id=child.id,
            email=child.email,
            tasks_completed_percent=pct,
            streak=child.streak,
            exbucks_earned=earned,
            exbucks_spent=spent,
        ))

    weekly_overview: dict[str, list[DayChild]] = {day: [] for day in DAYS}
    for child in children:
        for day in DAYS:
            day_tasks = [t for t in tasks if t.assigned_to == child.id and t.day_of_week == day]
            if day_tasks:
                weekly_overview[day].append(DayChild(
                    child_id=child.id,
                    email=child.email,
                    total=len(day_tasks),
                    approved=sum(1 for t in day_tasks if t.status == "approved"),
                ))

    return DashboardResponse(children=child_stats, weekly_overview=weekly_overview)
