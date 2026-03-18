from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user
from exsize.models import Task, Transaction, User

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class TaskCreateRequest(BaseModel):
    name: str
    description: str
    exbucks: int
    assigned_to: int
    day_of_week: str | None = None


class TaskResponse(BaseModel):
    id: int
    name: str
    description: str
    exbucks: int
    status: str
    assigned_to: int
    day_of_week: str | None = None

    model_config = {"from_attributes": True}


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(body: TaskCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can create tasks")
    if user.family_id is None:
        raise HTTPException(status_code=400, detail="Must be in a family")
    child = db.query(User).filter(
        User.id == body.assigned_to,
        User.family_id == user.family_id,
        User.role == "child",
    ).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found in your family")
    task = Task(
        name=body.name,
        description=body.description,
        exbucks=body.exbucks,
        assigned_to=body.assigned_to,
        family_id=user.family_id,
        created_by=user.id,
        day_of_week=body.day_of_week,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("", response_model=list[TaskResponse])
def list_tasks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.family_id is None:
        raise HTTPException(status_code=400, detail="Must be in a family")
    query = db.query(Task).filter(Task.family_id == user.family_id)
    if user.role == "child":
        query = query.filter(Task.assigned_to == user.id)
    return query.all()


class TaskEditRequest(BaseModel):
    name: str
    description: str
    exbucks: int
    assigned_to: int
    day_of_week: str | None = None


def _get_family_task(task_id: int, user: User, db: Session) -> Task:
    task = db.query(Task).filter(Task.id == task_id, Task.family_id == user.family_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskResponse)
def edit_task(task_id: int, body: TaskEditRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can edit tasks")
    task = _get_family_task(task_id, user, db)
    if task.status in ("completed", "approved"):
        raise HTTPException(status_code=409, detail="Cannot edit a completed or approved task")
    child = db.query(User).filter(
        User.id == body.assigned_to,
        User.family_id == user.family_id,
        User.role == "child",
    ).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found in your family")
    task.name = body.name
    task.description = body.description
    task.exbucks = body.exbucks
    task.assigned_to = body.assigned_to
    task.day_of_week = body.day_of_week
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}/accept", response_model=TaskResponse)
def accept_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "child":
        raise HTTPException(status_code=403, detail="Only children can accept tasks")
    task = _get_family_task(task_id, user, db)
    if task.assigned_to != user.id:
        raise HTTPException(status_code=403, detail="Task not assigned to you")
    if task.status != "assigned":
        raise HTTPException(status_code=409, detail="Task is not in assigned state")
    task.status = "accepted"
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can delete tasks")
    task = _get_family_task(task_id, user, db)
    db.delete(task)
    db.commit()


@router.patch("/{task_id}/complete", response_model=TaskResponse)
def complete_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "child":
        raise HTTPException(status_code=403, detail="Only children can complete tasks")
    task = _get_family_task(task_id, user, db)
    if task.assigned_to != user.id:
        raise HTTPException(status_code=403, detail="Task not assigned to you")
    if task.status != "accepted":
        raise HTTPException(status_code=409, detail="Task is not in accepted state")
    task.status = "completed"
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}/approve", response_model=TaskResponse)
def approve_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can approve tasks")
    task = _get_family_task(task_id, user, db)
    if task.status != "completed":
        raise HTTPException(status_code=409, detail="Task is not in completed state")
    task.status = "approved"
    child = db.query(User).filter(User.id == task.assigned_to).first()
    child.exbucks_balance += task.exbucks
    txn = Transaction(
        user_id=child.id,
        type="earned",
        amount=task.exbucks,
        description=task.name,
        task_id=task.id,
    )
    db.add(txn)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}/reject", response_model=TaskResponse)
def reject_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = _get_family_task(task_id, user, db)
    if user.role == "child":
        if task.assigned_to != user.id:
            raise HTTPException(status_code=403, detail="Task not assigned to you")
        if task.status != "assigned":
            raise HTTPException(status_code=409, detail="Task is not in assigned state")
        task.status = "rejected"
    elif user.role == "parent":
        if task.status != "completed":
            raise HTTPException(status_code=409, detail="Task is not in completed state")
        task.status = "assigned"
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.commit()
    db.refresh(task)
    return task
