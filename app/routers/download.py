import json
import os
import zipfile
from io import BytesIO
from datetime import datetime
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

router = APIRouter()


@router.get("/download/lists", tags=["download"])
async def download_lists():
    """
    Download basic-list.json and advance-list.json as a zip file.
    """
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")

    # Files to include in the zip
    files_to_zip = ["basic-list.json", "advance-list.json"]

    # Create a zip file in memory
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for filename in files_to_zip:
            file_path = os.path.join(data_dir, filename)
            if os.path.exists(file_path):
                # Add file to zip with just the filename (not the full path)
                zip_file.write(file_path, arcname=filename)

    zip_buffer.seek(0)

    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"pinfinity-backup_{timestamp}.zip"

    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/upload/lists", tags=["upload"])
async def upload_lists(file: UploadFile = File(...)):
    """
    Accept a pinfinity backup zip and restore basic-list.json / advance-list.json.
    """
    if not (file.filename or "").endswith(".zip"):
        raise HTTPException(status_code=400, detail="Expected a .zip file")

    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    allowed = {"basic-list.json", "advance-list.json"}

    content = await file.read()
    try:
        with zipfile.ZipFile(BytesIO(content), "r") as zf:
            found = set(zf.namelist()) & allowed
            if not found:
                raise HTTPException(
                    status_code=400, detail="No valid list files found in archive"
                )
            for name in found:
                data = zf.read(name)
                json.loads(data)  # validate JSON before writing
                with open(os.path.join(data_dir, name), "wb") as f:
                    f.write(data)
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file")
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Archive contains invalid JSON")

    return {"imported": sorted(found)}
