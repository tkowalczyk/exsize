from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from exsize.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    exbucks: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="assigned")
    assigned_to: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    family_id: Mapped[int] = mapped_column(Integer, ForeignKey("families.id"), nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    day_of_week: Mapped[str | None] = mapped_column(String, nullable=True)


class Family(Base):
    __tablename__ = "families"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pin: Mapped[str] = mapped_column(String(6), unique=True, nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    language: Mapped[str] = mapped_column(String, nullable=False, default="en")
    family_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("families.id"), nullable=True)
    exbucks_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_completion_date: Mapped[str | None] = mapped_column(String, nullable=True)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    task_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tasks.id"), nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime, nullable=False, server_default=func.now())


class Reward(Base):
    __tablename__ = "rewards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)


class Purchase(Base):
    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    reward_id: Mapped[int] = mapped_column(Integer, ForeignKey("rewards.id"), nullable=False)
    created_at: Mapped[str] = mapped_column(DateTime, nullable=False, server_default=func.now())
