from __future__ import annotations
import asyncio
from sqlalchemy.ext.asyncio import AsyncEngine
from app.db.session import engine
from app.models import Base


async def _init_db(db_engine: AsyncEngine) -> None:
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def main() -> None:
    asyncio.run(_init_db(engine))


if __name__ == "__main__":
    main()
