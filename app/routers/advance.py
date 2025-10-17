from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
import json
import os

from coffy.nosql import db
import re

router = APIRouter()


@router.get("/advance/info", tags=["advance"])
async def read_info():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "advance-info.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)

@router.get("/advance/list", tags=["advance"])
async def read_list(
    patternType: int = Query(-1, alias="patternType"),
    name: str = Query("", alias="name"),
    pageNum: int = Query(1, alias="pageNum"),
    pageSize: int = Query(100, alias="pageSize")
):
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "advance-list.json")
    metadata_path = os.path.join(os.path.dirname(__file__), "..", "data", "advance-list-metadata.json")

    advance_list = db("advance-list", path=data_path)
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

    if filters:
        query = advance_list.match_all(*filters)
        totalCount = query.count()
        start = (pageNum - 1) * pageSize
        paged_records = query.offset(start).limit(pageSize).run().as_list()
    else:
        all_records = advance_list.all()
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

# Delete training
@router.delete("/advance/delete", tags=["advance"])
async def delete_item(request: Request):
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "advance-list.json")
    advance_list = db("advance-list", path=data_path)
    body = await request.json()

    advance_list.where("id").eq(body["id"]).delete()

    response = {
        "code": 200,
        "msg": "SUCCESS"
    }
    return JSONResponse(content=response)
