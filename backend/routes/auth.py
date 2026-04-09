from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import ChangePasswordRequest, LoginRequest, LogoutRequest, RefreshTokenRequest, TokenResponse, UserOut
from ..security import create_access_token, create_refresh_token, decode_refresh_token, hash_password, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    claims = {"role": user.role.value.lower(), "tv": user.token_version}
    access_token = create_access_token(user.email, claims)
    refresh_token = create_refresh_token(user.email, {"tv": user.token_version})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    token_payload = decode_refresh_token(payload.refresh_token)
    subject = token_payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.email == subject).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    token_version = int(token_payload.get("tv", 0))
    if user.token_version != token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalidated")

    claims = {"role": user.role.value.lower(), "tv": user.token_version}
    access_token = create_access_token(user.email, claims)
    refresh_token = create_refresh_token(user.email, {"tv": user.token_version})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=UserOut.model_validate(user))


@router.post("/logout")
def logout(payload: LogoutRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.refresh_token:
        refresh_payload = decode_refresh_token(payload.refresh_token)
        refresh_sub = refresh_payload.get("sub")
        if refresh_sub != current_user.email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token does not match user")

    current_user.token_version += 1
    db.commit()
    return {"message": "Logged out"}


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different")

    current_user.hashed_password = hash_password(payload.new_password)
    current_user.token_version += 1
    db.commit()
    return {"message": "Password updated"}
