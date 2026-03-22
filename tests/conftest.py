import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).parent.parent
DEFAULT_DATA = ROOT / "app" / "default-data"
DATA_DIR = ROOT / "app" / "data"


@pytest.fixture(scope="session", autouse=True)
def setup_data_dir():
    """Populate app/data/ from default-data/ for the test session."""
    created = not DATA_DIR.exists()
    if created:
        shutil.copytree(DEFAULT_DATA, DATA_DIR)
    yield
    if created:
        shutil.rmtree(DATA_DIR)


@pytest.fixture(scope="session")
def client(setup_data_dir):
    from app.main import app

    return TestClient(app)


@pytest.fixture()
def restore_basic_list():
    """Restore basic-list.json after each test that modifies it."""
    snapshot = (DATA_DIR / "basic-list.json").read_bytes()
    yield
    (DATA_DIR / "basic-list.json").write_bytes(snapshot)


@pytest.fixture()
def restore_advance_list():
    """Restore advance-list.json after each test that modifies it."""
    snapshot = (DATA_DIR / "advance-list.json").read_bytes()
    yield
    (DATA_DIR / "advance-list.json").write_bytes(snapshot)
