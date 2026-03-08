from fastapi import APIRouter
import json
import os

router = APIRouter()


@router.get("/user/info", tags=["user"])
async def read_users():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "user-info.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)


@router.get("/user/{username}", tags=["user"])
async def read_user(username: str):
    return {"username": username}
