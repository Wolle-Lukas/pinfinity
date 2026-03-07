from fastapi import APIRouter
import json
import os
from fastapi import Query

router = APIRouter()


@router.post("/tutorial/myTraining", tags=["tutorial"])
async def read_myTraining(version: int = Query(0)):
    print(f"Received version: {version}")
    data_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "tutorial-myTraining.json"
    )
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)


@router.post("/tutorial/list", tags=["tutorial"])
async def list():
    data_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "tutorial-list.json"
    )
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)


@router.post("/tutorial/recommend", tags=["tutorial"])
async def recommended():
    data_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "tutorial-recommended.json"
    )
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)


@router.get("/tutorial/filters", tags=["tutorial"])
async def filters():
    data_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "tutorial-filters.json"
    )
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)
