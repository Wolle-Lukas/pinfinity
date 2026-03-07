from fastapi import APIRouter
import json
import os

router = APIRouter()


@router.post("/config/country", tags=["config"])
async def read_skillevel():
    data_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "config-country.json"
    )
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)
