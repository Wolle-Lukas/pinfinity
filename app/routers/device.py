from fastapi import APIRouter
import json
import os

router = APIRouter()


@router.post("/device/list", tags=["device"])
async def read_device_list():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "device-list.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)
