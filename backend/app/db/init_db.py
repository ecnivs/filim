from __future__ import annotations
import asyncio
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
from app.db.session import engine
from app.models import Base, Profile


async def _init_db(db_engine: AsyncEngine) -> None:
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        try:
            await db.execute(
                text(
                    "ALTER TABLE profiles ADD COLUMN is_guest BOOLEAN DEFAULT 0 NOT NULL"
                )
            )
            await db.commit()
            print("Migration: Added is_guest column to profiles table")
        except Exception:
            await db.rollback()

        stmt = select(Profile).where(Profile.is_guest == True)
        result = await db.execute(stmt)
        guest = result.scalar_one_or_none()

        if guest is None:
            from uuid import uuid4

            guest_profile = Profile(
                id=str(uuid4()), name="Guest", is_guest=True, is_locked=False
            )
            db.add(guest_profile)
            await db.commit()


def main() -> None:
    asyncio.run(_init_db(engine))


if __name__ == "__main__":
    main()
