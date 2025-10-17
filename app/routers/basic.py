from coffy.nosql import db
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
import json
import os
import re
from datetime import datetime
import time

router = APIRouter()

@router.get("/basic/skillLevel", tags=["basic"])
async def read_skillevel():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-skillLevel.json")
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
    pageSize: int = Query(100, alias="pageSize")
):
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-list.json")
    metadata_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-list-metadata.json")

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

    if filters:
        query = basic_list.match_all(*filters)
        totalCount = query.count()
        start = (pageNum - 1) * pageSize
        paged_records = query.offset(start).limit(pageSize).run().as_list()

    else:
        all_records = basic_list.all()
        totalCount = len(all_records)
        start = (pageNum - 1) * pageSize
        paged_records = all_records[start:start+pageSize]
    
    paged_records = sorted(paged_records, key=lambda x: x.get("lastPlayDate", 0), reverse=True)

    # Keep the original structure
    result = metadata.copy()
    if "data" in result:
        result["data"] = result["data"].copy()
        result["data"]["records"] = paged_records
        result["data"]["current"] = pageNum
        result["data"]["totalCount"] = totalCount
        result["data"]["size"] = pageSize
        result["data"]["pages"] = (totalCount + pageSize - 1) // pageSize if pageSize > 0 else 1

    return JSONResponse(content=result)


# Save endpoint for /api/basic/save
@router.post("/basic/save", tags=["basic"])
async def save_basic(request: Request):
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-list.json")
    basic_list = db("basic-list", path=data_path)
    body = await request.json()

    # Generate fields as in the sample response
    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    time_index = int(time.mktime(now.timetuple()))
    new_id = basic_list.max("id") + 1 if basic_list.max("id") is not None else 1
    uid = 123

    doc = body.copy()

    if body.get("id") == 0:
        doc.update({
            "id": new_id,
            "uid": uid,
            "isFavourite": body.get("isFavourite", 0),
            "createDate": now_str,
            "updateDate": now_str,
            "subTime": 0,
            "collectFlag": 0,
            "lastPlayDate": time_index,
            "lastPlayDateUTC": now_str
        })
        basic_list.add(doc)
    else:
        doc.update({
            "updateDate": now_str,
            "uid": uid
        })
        basic_list.where("id").eq(body["id"]).update(doc)

    # Fetch the saved document to return
    response_doc = basic_list.where("id").eq(doc["id"]).first()

    response = {
        "code": 200,
        "msg": "SUCCESS",
        "data": response_doc,
        "subTime": 0,
        "source": "APP",
        "isDefault": 0
    }
    return JSONResponse(content=response)

# Set favourite
@router.post("/basic/setFavourite", tags=["basic"])
async def set_favourite(request: Request):
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-list.json")
    basic_list = db("basic-list", path=data_path)
    body = await request.json()

    basic_list.where("id").eq(body["id"]).update({"isFavourite": body["favourite"]})

# Delete training
@router.delete("/basic/delete", tags=["basic"])
async def delete_item(request: Request):
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "basic-list.json")
    basic_list = db("basic-list", path=data_path)
    body = await request.json()

    basic_list.where("id").eq(body["id"]).delete()

    response = {
        "code": 200,
        "msg": "SUCCESS"
    }
    return JSONResponse(content=response)