import logging
import os

logger = logging.getLogger(__name__)


def preserve_file_permissions(file_path):
    """Ensure basic-list.json and advance-list.json maintain rw-r--r-- (644) permissions."""
    if os.path.basename(file_path) in ["basic-list.json", "advance-list.json"]:
        try:
            os.chmod(file_path, 0o644)
        except Exception as e:
            logger.warning("Could not set permissions on %s: %s", file_path, e)
