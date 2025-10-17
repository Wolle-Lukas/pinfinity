from coffy.nosql import db
from fastapi import APIRouter
from fastapi.responses import JSONResponse
import os
from fastapi import Request
from datetime import datetime

router = APIRouter()

# Log last play
@router.post("/log", tags=["log"])
async def set_last_play_time(request: Request):
    body = await request.json()

    if body["drillType"] == "basic":
        start_time_str = body["startTime"]
        start_time_utc = datetime.strptime(start_time_str, "%Y-%m-%dT%H:%M:%SZ")
        data_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-list.json")
        basic_list = db("basic-list", path=data_path)
        basic_list.where("id").eq(body["pid"]).update({"lastPlayDateUTC": str(start_time_utc)})
        basic_list.where("id").eq(body["pid"]).update({"lastPlayDate": body["stime"]})
    elif body["drillType"] == "advance":
        start_time_str = body["startTime"]
        start_time_utc = datetime.strptime(start_time_str, "%Y-%m-%dT%H:%M:%SZ")
        data_path = os.path.join(os.path.dirname(__file__), "..", "data", "advance-list.json")
        advance_list = db("advance_list-list", path=data_path)
        advance_list.where("id").eq(body["pid"]).update({"lastPlayDateUTC": str(start_time_utc)})
        advance_list.where("id").eq(body["pid"]).update({"lastPlayDate": body["stime"]})
    else:
        pass

    response = {
        "code": 200,
        "msg": "SUCCESS",
        "data": {
                "uid": 123,
                "region": body["region"],
                "pid": body["pid"],
                "pname": body["pname"],
                "ptype": body["ptype"],
                "tmode": body["tmode"],
                "stime": body["stime"],
                "etime": body["etime"],
        },
    }
    return JSONResponse(content=response)