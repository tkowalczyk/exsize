from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user
from exsize.models import User

router = APIRouter(prefix="/api/gamification", tags=["gamification"])

LEVEL_NAMES = [
    "Beginner",        # 1
    "Starter",         # 2
    "Rookie",          # 3
    "Apprentice",      # 4
    "Explorer",        # 5
    "Adventurer",      # 6
    "Challenger",      # 7
    "Fighter",         # 8
    "Warrior",         # 9
    "Brave",           # 10
    "Bold",            # 11
    "Tough",           # 12
    "Fierce",          # 13
    "Mighty",          # 14
    "Powerful",        # 15
    "Strong",          # 16
    "Fearless",        # 17
    "Relentless",      # 18
    "Unstoppable",     # 19
    "Titan",           # 20
    "Gladiator",       # 21
    "Conqueror",       # 22
    "Dominator",       # 23
    "Crusher",         # 24
    "Destroyer",       # 25
    "Vanquisher",      # 26
    "Overlord",        # 27
    "Warlord",         # 28
    "Commander",       # 29
    "General",         # 30
    "Marshal",         # 31
    "Captain",         # 32
    "Sentinel",        # 33
    "Guardian",        # 34
    "Protector",       # 35
    "Defender",        # 36
    "Paladin",         # 37
    "Knight",          # 38
    "Champion",        # 39
    "Hero",            # 40
    "Superstar",       # 41
    "Icon",            # 42
    "Prodigy",         # 43
    "Phenom",          # 44
    "Virtuoso",        # 45
    "Master",          # 46
    "Grandmaster",     # 47
    "Elite",           # 48
    "Mythic",          # 49
    "Legend",          # 50
]


def xp_threshold_for_level(level: int) -> int:
    """Total XP needed to reach a given level. Level 1 = 0, level 2 = 100, level 3 = 300, level 4 = 600..."""
    return sum(i * 100 for i in range(1, level))


def xp_for_next_level(level: int) -> int:
    """XP required to go from current level to next level."""
    return level * 100


def progress_percent(xp: int, level: int) -> int:
    """Percentage progress toward the next level (0-100)."""
    if level >= 50:
        return 100
    threshold = xp_threshold_for_level(level)
    xp_into_level = xp - threshold
    needed = xp_for_next_level(level)
    return int(xp_into_level * 100 / needed) if needed > 0 else 100


def compute_level(xp: int) -> int:
    """Determine what level a given XP total corresponds to."""
    level = 1
    while level < 50 and xp >= xp_threshold_for_level(level + 1):
        level += 1
    return level


class GamificationProfileResponse(BaseModel):
    xp: int
    level: int
    level_name: str
    progress_percent: int
    xp_for_next_level: int
    streak: int


@router.get("/profile", response_model=GamificationProfileResponse)
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "child":
        raise HTTPException(status_code=403, detail="Only children have gamification profiles")
    return GamificationProfileResponse(
        xp=user.xp,
        level=user.level,
        level_name=LEVEL_NAMES[user.level - 1],
        progress_percent=progress_percent(user.xp, user.level),
        xp_for_next_level=xp_for_next_level(user.level),
        streak=user.streak,
    )
