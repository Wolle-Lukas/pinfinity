import logging
import os

from fastapi import FastAPI

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

app = FastAPI(root_path="/api")

app.include_router(user.router)
app.include_router(basic.router)
app.include_router(advance.router)
app.include_router(config.router)
app.include_router(node.router)
app.include_router(device.router)
app.include_router(base.router)
app.include_router(tutorial.router)
app.include_router(log.router)
app.include_router(download.router)


@app.get("/")
async def root():
    return {"message": "Hello pinfinity!"}
