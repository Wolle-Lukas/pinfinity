import logging
from coffy.nosql import db
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
import json
import os
import re
from datetime import datetime
import time

from .utils import preserve_file_permissions

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/basic/skillLevel", tags=["basic"])
async def read_skillevel():
    data_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "basic-skillLevel.json"
    )
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)


@router.get("/basic/info", tags=["basic"])
async def read_info():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-info.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)


@router.get("/basic/list", tags=["basic"])
async def read_list(
    patternType: int = Query(-1, alias="patternType"),
    name: str = Query("", alias="name"),
    ball: int = Query(-1, alias="ball"),
    spin: int = Query(-1, alias="spin"),
    pageNum: int = Query(1, alias="pageNum"),
    pageSize: int = Query(100, alias="pageSize"),
):
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-list.json")
    metadata_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "basic-list-metadata.json"
    )

    basic_list = db("basic-list", path=data_path)
    with open(os.path.abspath(metadata_path), "r", encoding="utf-8") as f:
        metadata = json.load(f)

    filters = []
    if patternType == 0:
        filters.append(lambda q: q.where("uid").eq(0))
    elif patternType == 1:
        filters.append(lambda q: q.where("uid").ne(0))
    if name:
        regex = f"(?i).*{re.escape(name)}.*"
        filters.append(lambda q: q.where("name").matches(regex))
    if ball != -1:
        filters.append(lambda q: q.where("ball").eq(ball))
    if spin != -1:
        filters.append(lambda q: q.where("spin").eq(spin))

    logger.debug(
        "GET /basic/list: patternType=%d name=%r ball=%d spin=%d page=%d size=%d",
        patternType,
        name,
        ball,
        spin,
        pageNum,
        pageSize,
    )

    if filters:
        query = basic_list.match_all(*filters)
        totalCount = query.count()
        start = (pageNum - 1) * pageSize
        paged_records = query.offset(start).limit(pageSize).run().as_list()

    else:
        all_records = basic_list.all()
        totalCount = len(all_records)
        start = (pageNum - 1) * pageSize
        paged_records = all_records[start : start + pageSize]

    logger.debug(
        "GET /basic/list: returning %d/%d records", len(paged_records), totalCount
    )

    paged_records = sorted(
        paged_records, key=lambda x: x.get("lastPlayDate", 0), reverse=True
    )

    # Keep the original structure
    result = metadata.copy()
    if "data" in result:
        result["data"] = result["data"].copy()
        result["data"]["records"] = paged_records
        result["data"]["current"] = pageNum
        result["data"]["totalCount"] = totalCount
        result["data"]["size"] = pageSize
        result["data"]["pages"] = (
            (totalCount + pageSize - 1) // pageSize if pageSize > 0 else 1
        )

    return JSONResponse(content=result)


# Save endpoint for /api/basic/save
@router.post("/basic/save", tags=["basic"])
async def save_basic(request: Request):
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-list.json")
    basic_list = db("basic-list", path=data_path)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400, content={"code": 400, "msg": "Invalid JSON body"}
        )

    # Generate fields as in the sample response
    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    time_index = int(time.mktime(now.timetuple()))
    new_id = basic_list.max("id") + 1 if basic_list.max("id") is not None else 1
    uid = 123

    doc = body.copy()

    if body.get("id") == 0:
        logger.debug(
            "POST /basic/save: creating new training name=%r id=%d",
            body.get("name"),
            new_id,
        )
        doc.update(
            {
                "id": new_id,
                "uid": uid,
                "isFavourite": body.get("isFavourite", 0),
                "createDate": now_str,
                "updateDate": now_str,
                "subTime": 0,
                "collectFlag": 0,
                "lastPlayDate": time_index,
                "lastPlayDateUTC": now_str,
            }
        )
        basic_list.add(doc)
    else:
        logger.debug("POST /basic/save: updating training id=%d", body["id"])
        doc.update({"updateDate": now_str, "uid": uid})
        basic_list.where("id").eq(body["id"]).update(doc)

    # Preserve file permissions after write
    preserve_file_permissions(data_path)

    # Fetch the saved document to return
    response_doc = basic_list.where("id").eq(doc["id"]).first()

    response = {
        "code": 200,
        "msg": "SUCCESS",
        "data": response_doc,
        "subTime": 0,
        "source": "APP",
        "isDefault": 0,
    }
    return JSONResponse(content=response)


# Set favourite
@router.post("/basic/setFavourite", tags=["basic"])
async def set_favourite(request: Request):
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-list.json")
    basic_list = db("basic-list", path=data_path)
    try:
        body = await request.json()
        if "id" not in body or "favourite" not in body:
            return JSONResponse(
                status_code=400,
                content={"code": 400, "msg": "Missing field: id or favourite"},
            )
    except Exception:
        return JSONResponse(
            status_code=400, content={"code": 400, "msg": "Invalid JSON body"}
        )

    logger.debug(
        "POST /basic/setFavourite: id=%s favourite=%s", body["id"], body["favourite"]
    )
    basic_list.where("id").eq(body["id"]).update({"isFavourite": body["favourite"]})

    # Preserve file permissions after write
    preserve_file_permissions(data_path)

    response = {"code": 200, "msg": "SUCCESS"}
    return JSONResponse(content=response)


# Delete training
@router.delete("/basic/delete", tags=["basic"])
async def delete_item(request: Request):
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-list.json")
    basic_list = db("basic-list", path=data_path)
    try:
        body = await request.json()
        if "id" not in body:
            return JSONResponse(
                status_code=400, content={"code": 400, "msg": "Missing field: id"}
            )
    except Exception:
        return JSONResponse(
            status_code=400, content={"code": 400, "msg": "Invalid JSON body"}
        )

    logger.debug("DELETE /basic/delete: id=%s", body["id"])
    basic_list.where("id").eq(body["id"]).delete()

    response = {"code": 200, "msg": "SUCCESS"}
    return JSONResponse(content=response)
