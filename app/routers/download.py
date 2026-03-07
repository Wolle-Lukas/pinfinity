import os
import zipfile
from io import BytesIO
from datetime import datetime
from fastapi import APIRouter
from fastapi.responses import FileResponse

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
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for filename in files_to_zip:
            file_path = os.path.join(data_dir, filename)
            if os.path.exists(file_path):
                # Add file to zip with just the filename (not the full path)
                zip_file.write(file_path, arcname=filename)
    
    zip_buffer.seek(0)
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"pinfinity-backup_{timestamp}.zip"
    
    return FileResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        filename=filename
    )
