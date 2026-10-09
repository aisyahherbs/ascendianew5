import logging
import os

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

ROOT = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT, ".env"))

import core  # noqa: E402
from core import db, hash_pw, new_id, now_iso  # noqa: E402
import routes_people  # noqa: E402
import routes_ops  # noqa: E402
import routes_stock  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mlm")

app = FastAPI(title="Hybrid MLM Backoffice API")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"app": "Hybrid MLM Backoffice", "status": "ok"}


@api.get("/health")
async def health():
    await db.command("ping")
    return {"status": "healthy"}


api.include_router(routes_people.router, tags=["people"])
api.include_router(routes_ops.router, tags=["ops"])
api.include_router(routes_stock.router, tags=["stock"])
app.include_router(api)

CORS = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("member_id", unique=True)
    await db.transactions.create_index("period_key")
    await db.transactions.create_index("member_id")
    await db.periods.create_index("key", unique=True)
    await core.get_settings()
    if not await db.users.find_one({"role": "admin_pusat"}):
        await db.users.insert_one({
            "id": new_id(), "member_id": "ADMIN", "name": "Admin Pusat",
            "role": "admin_pusat", "password_hash": hash_pw("admin123"),
            "active": True, "deleted": False, "province": "", "city": "",
            "phone": "", "email": "", "address": "", "bank_name": "", "bank_account": "",
            "sponsor_id": None, "placement_id": None, "stokis_id": None,
            "join_date": now_iso()[:10], "created_at": now_iso(),
            "stat_rank": "Member", "stat_membership": "None",
            "stat_appv": 0, "stat_appv_perkembangan": 0, "stat_atnpv": 0, "stat_carry": {},
        })
        logger.info("Seeded admin pusat ADMIN / admin123")
    await core.ensure_period(await core.current_period_key())


@app.on_event("shutdown")
async def shutdown():
    core.client.close()
