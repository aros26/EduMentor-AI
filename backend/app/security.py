import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext

pwd = CryptContext(
    schemes=["bcrypt_sha256", "bcrypt"],
    deprecated="auto"
)

SECRET = os.getenv("SECRET_KEY", "dev-only-change-me")
ALGORITHM = "HS256"


def hash_password(password: str):
    return pwd.hash(password)


def verify_password(password: str, hashed_password: str):
    return pwd.verify(password, hashed_password)


def make_token(user_id):
    return jwt.encode(
        {"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(hours=12)},
        SECRET,
        algorithm=ALGORITHM
    )


def token_user(token):
    try:
        return int(jwt.decode(token, SECRET, algorithms=[ALGORITHM])["sub"])
    except Exception:
        return None
