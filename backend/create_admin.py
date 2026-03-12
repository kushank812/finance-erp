# create_admin.py
from app.core.database import SessionLocal
from app.models.user import User
from app.utils.security import hash_password

USER_ID = "ADMIN"
FULL_NAME = "SYSTEM ADMIN"
PASSWORD = "Admin@12345"


def main():
    db = SessionLocal()
    try:
        existing = db.get(User, USER_ID)
        if existing:
            print("Admin user already exists.")
            return

        user = User(
            user_id=USER_ID,
            full_name=FULL_NAME,
            password_hash=hash_password(PASSWORD),
            is_active=True,
            role="ADMIN",
        )
        db.add(user)
        db.commit()

        print("Admin user created.")
        print(f"User ID: {USER_ID}")
        print(f"Password: {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()