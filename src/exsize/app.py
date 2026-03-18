from contextlib import asynccontextmanager

from fastapi import FastAPI

from exsize.database import Base, engine
from exsize.routers import auth, dashboard, exbucks, family, rewards, settings, tasks

# ensure models are imported so Base.metadata knows about them
import exsize.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="ExSize", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(exbucks.router)
app.include_router(family.router)
app.include_router(rewards.router)
app.include_router(settings.router)
app.include_router(tasks.router)
