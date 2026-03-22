import logging
from coffy.nosql import db
from fastapi import APIRouter
from fastapi.responses import JSONResponse
import os
from fastapi import Request
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()


# Log last play
@router.post("/log", tags=["log"])
async def set_last_play_time(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400, content={"code": 400, "msg": "Invalid JSON body"}
        )

    required_fields = [
        "drillType",
        "pid",
        "pname",
        "ptype",
        "tmode",
        "stime",
        "etime",
        "startTime",
    ]
    for field in required_fields:
        if field not in body:
            return JSONResponse(
                status_code=400, content={"code": 400, "msg": f"Missing field: {field}"}
            )

    logger.debug(
        "POST /log: drillType=%s pid=%s pname=%s",
        body["drillType"],
        body["pid"],
        body["pname"],
    )

    if body["drillType"] == "basic":
        start_time_str = body["startTime"]
        start_time_utc = datetime.strptime(start_time_str, "%Y-%m-%dT%H:%M:%SZ")
        data_path = os.path.join(
            os.path.dirname(__file__), "..", "data", "basic-list.json"
        )
        basic_list = db("basic-list", path=data_path)
        basic_list.where("id").eq(body["pid"]).update(
            {"lastPlayDateUTC": str(start_time_utc)}
        )
        basic_list.where("id").eq(body["pid"]).update({"lastPlayDate": body["stime"]})
        logger.debug("Updated lastPlayDate for basic training id=%s", body["pid"])
    elif body["drillType"] == "advance":
        start_time_str = body["startTime"]
        start_time_utc = datetime.strptime(start_time_str, "%Y-%m-%dT%H:%M:%SZ")
        data_path = os.path.join(
            os.path.dirname(__file__), "..", "data", "advance-list.json"
        )
        advance_list = db("advance-list", path=data_path)
        advance_list.where("id").eq(body["pid"]).update(
            {"lastPlayDateUTC": str(start_time_utc)}
        )
        advance_list.where("id").eq(body["pid"]).update({"lastPlayDate": body["stime"]})
        logger.debug("Updated lastPlayDate for advance training id=%s", body["pid"])
    else:
        logger.debug(
            "Unknown drillType=%s, skipping lastPlayDate update", body["drillType"]
        )

    response = {
        "code": 200,
        "msg": "SUCCESS",
        "data": {
            "uid": 123,
            "region": "",  # Seems to be always empty in the original response
            "pid": body["pid"],
            "pname": body["pname"],
            "ptype": body["ptype"],
            "tmode": body["tmode"],
            "stime": body["stime"],
            "etime": body["etime"],
        },
    }
    return JSONResponse(content=response)
