import logging
import os
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .routers import (
    advance,
    base,
    basic,
    config,
    device,
    download,
    log,
    node,
    tutorial,
    user,
)

logging.basicConfig(
    level=getattr(
        logging, os.environ.get("LOG_LEVEL", "WARNING").upper(), logging.WARNING
    ),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI()

# All API routes live under /api so the original Joola app can reach them
api = APIRouter(prefix="/api")
api.include_router(user.router)
api.include_router(basic.router)
api.include_router(advance.router)
api.include_router(config.router)
api.include_router(node.router)
api.include_router(device.router)
api.include_router(base.router)
api.include_router(tutorial.router)
api.include_router(log.router)
api.include_router(download.router)
app.include_router(api)

# ── Web Frontend ──────────────────────────────────────────────
# Serve the SPA frontend alongside the API.  Static assets are
# mounted at /css and /js; every other non-API path falls through
# to index.html so client-side routing works.

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

if FRONTEND_DIR.is_dir():
    app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
    app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")
    app.mount("/fonts", StaticFiles(directory=FRONTEND_DIR / "fonts"), name="fonts")

    @app.get("/")
    async def frontend_index():
        return FileResponse(FRONTEND_DIR / "index.html")
