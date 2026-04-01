from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()

from sqlalchemy.orm import Session

from exsize.database import Base, engine, SessionLocal
from exsize.models import AppSetting, User
from exsize.routers import account, admin_settings, auth, dashboard, exbucks, family, gamification, leaderboard, profile, rewards, settings, subscription, tasks
from exsize.security import hash_password


def _seed_app_settings(db: Session) -> None:
    if not db.query(AppSetting).filter(AppSetting.key == "max_exbucks_per_task").first():
        db.add(AppSetting(key="max_exbucks_per_task", value="50"))
        db.commit()


def _seed_admin(db: Session) -> None:
    if not db.query(User).filter(User.role == "admin").first():
        db.add(User(
            email="admin@exsize.app",
            password_hash=hash_password("unused"),
            role="admin",
            language="en",
        ))
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed_admin(db)
        _seed_app_settings(db)
    finally:
        db.close()
    yield


app = FastAPI(title="ExSize", lifespan=lifespan)
app.include_router(account.router)
app.include_router(admin_settings.router)
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(exbucks.router)
app.include_router(family.router)
app.include_router(gamification.router)
app.include_router(leaderboard.router)
app.include_router(profile.router)
app.include_router(rewards.router)
app.include_router(settings.router)
app.include_router(subscription.router)
app.include_router(tasks.router)
