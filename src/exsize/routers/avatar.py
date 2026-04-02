from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from exsize.database import get_db
from exsize.deps import get_current_user
from exsize.models import AvatarItem, Transaction, User, UserInventory

router = APIRouter(prefix="/api/avatar", tags=["avatar"])


class AvatarItemCreate(BaseModel):
    type: str  # "icon" or "background"
    value: str
    label: str
    price: int


class AvatarItemUpdate(BaseModel):
    label: str | None = None
    price: int | None = None
    active_in_shop: bool | None = None


class AvatarItemResponse(BaseModel):
    id: int
    type: str
    value: str
    label: str
    price: int
    is_default: bool
    active_in_shop: bool

    model_config = {"from_attributes": True}


@router.get("/items", response_model=list[AvatarItemResponse])
def list_items(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return db.query(AvatarItem).order_by(AvatarItem.type, AvatarItem.price).all()


@router.post("/items", response_model=AvatarItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(body: AvatarItemCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    item = AvatarItem(
        type=body.type,
        value=body.value,
        label=body.label,
        price=body.price,
        is_default=False,
        active_in_shop=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=AvatarItemResponse)
def update_item(item_id: int, body: AvatarItemUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    item = db.query(AvatarItem).filter(AvatarItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if body.label is not None:
        item.label = body.label
    if body.price is not None:
        item.price = body.price
    if body.active_in_shop is not None:
        item.active_in_shop = body.active_in_shop
    db.commit()
    db.refresh(item)
    return item


class EquippedAvatarResponse(BaseModel):
    icon: AvatarItemResponse | None = None
    background: AvatarItemResponse | None = None


@router.get("/equipped/{user_id}", response_model=EquippedAvatarResponse)
def get_equipped(user_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Allow: admin, same user, or parent in same family
    if user.role != "admin" and user.id != user_id:
        if user.family_id is None or user.family_id != target.family_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    icon = db.query(AvatarItem).filter(AvatarItem.id == target.equipped_icon_id).first() if target.equipped_icon_id else None
    background = db.query(AvatarItem).filter(AvatarItem.id == target.equipped_background_id).first() if target.equipped_background_id else None
    return EquippedAvatarResponse(icon=icon, background=background)


@router.delete("/items/{item_id}")
def delete_item(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    item = db.query(AvatarItem).filter(AvatarItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.active_in_shop = False
    db.commit()
    return {"detail": "Item removed from shop"}


# --- Shop, Inventory, Purchase, Equip ---


@router.get("/shop", response_model=list[AvatarItemResponse])
def get_shop(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(AvatarItem).filter(AvatarItem.active_in_shop == True).order_by(AvatarItem.type, AvatarItem.price).all()


@router.get("/inventory", response_model=list[AvatarItemResponse])
def get_inventory(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    inventory = db.query(UserInventory).filter(UserInventory.user_id == user.id).all()
    item_ids = [inv.avatar_item_id for inv in inventory]
    if not item_ids:
        return []
    return db.query(AvatarItem).filter(AvatarItem.id.in_(item_ids)).all()


@router.post("/purchase/{item_id}")
def purchase_item(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "child":
        raise HTTPException(status_code=403, detail="Only children can purchase")
    item = db.query(AvatarItem).filter(AvatarItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not item.active_in_shop:
        raise HTTPException(status_code=400, detail="Item not available in shop")
    if user.exbucks_balance < item.price:
        raise HTTPException(status_code=400, detail="Insufficient ExBucks")
    already_owned = db.query(UserInventory).filter(
        UserInventory.user_id == user.id, UserInventory.avatar_item_id == item_id
    ).first()
    if already_owned:
        raise HTTPException(status_code=409, detail="Already owned")
    user.exbucks_balance -= item.price
    db.add(UserInventory(user_id=user.id, avatar_item_id=item.id))
    db.add(Transaction(
        user_id=user.id, type="spent", amount=-item.price,
        description=f"Avatar: {item.label}",
    ))
    db.commit()
    return {"detail": "Purchased"}


@router.post("/equip/{item_id}")
def equip_item(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "child":
        raise HTTPException(status_code=403, detail="Only children can equip")
    owned = db.query(UserInventory).filter(
        UserInventory.user_id == user.id, UserInventory.avatar_item_id == item_id
    ).first()
    if not owned:
        raise HTTPException(status_code=400, detail="Item not in inventory")
    item = db.query(AvatarItem).filter(AvatarItem.id == item_id).first()
    if item.type == "icon":
        user.equipped_icon_id = item.id
    else:
        user.equipped_background_id = item.id
    db.commit()
    return {"detail": "Equipped"}


@router.post("/unequip/{item_type}")
def unequip_item(item_type: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "child":
        raise HTTPException(status_code=403, detail="Only children can unequip")
    if item_type not in ("icon", "background"):
        raise HTTPException(status_code=400, detail="Invalid type")
    free_default = db.query(AvatarItem).filter(
        AvatarItem.type == item_type, AvatarItem.price == 0, AvatarItem.is_default == True
    ).first()
    if item_type == "icon":
        user.equipped_icon_id = free_default.id if free_default else None
    else:
        user.equipped_background_id = free_default.id if free_default else None
    db.commit()
    return {"detail": "Unequipped"}
