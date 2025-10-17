from fastapi import APIRouter
import json
import os
from fastapi import Query

router = APIRouter()


@router.get("/base/conf", tags=["base"])
async def read_skillevel(version: int = Query(0)):
    print(f"Received version: {version}")
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "base-conf.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)
