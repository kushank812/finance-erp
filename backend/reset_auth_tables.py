# reset_auth_tables.py
from app.core.database import engine
from app.models.user import User, UserSession

def main():
    UserSession.__table__.drop(bind=engine, checkfirst=True)
    User.__table__.drop(bind=engine, checkfirst=True)

    User.__table__.create(bind=engine, checkfirst=True)
    UserSession.__table__.create(bind=engine, checkfirst=True)

    print("Auth tables reset successfully.")

if __name__ == "__main__":
    main()