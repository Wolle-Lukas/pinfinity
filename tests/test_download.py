"""Tests for the /api/download/lists endpoint."""

import io
import json
import re
import zipfile


class TestDownloadLists:
    def test_returns_200(self, client):
        r = client.get("/api/download/lists")
        assert r.status_code == 200

    def test_content_type_is_zip(self, client):
        r = client.get("/api/download/lists")
        assert "application/zip" in r.headers["content-type"]

    def test_response_is_valid_zip_archive(self, client):
        r = client.get("/api/download/lists")
        assert zipfile.is_zipfile(io.BytesIO(r.content))

    def test_zip_contains_both_list_files(self, client):
        r = client.get("/api/download/lists")
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            names = zf.namelist()
        assert "basic-list.json" in names
        assert "advance-list.json" in names

    def test_zip_contains_exactly_the_two_expected_files(self, client):
        r = client.get("/api/download/lists")
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            names = zf.namelist()
        assert sorted(names) == ["advance-list.json", "basic-list.json"]

    def test_basic_list_inside_zip_is_valid_json(self, client):
        r = client.get("/api/download/lists")
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            data = json.loads(zf.read("basic-list.json"))
        assert isinstance(data, (dict, list))

    def test_advance_list_inside_zip_is_valid_json(self, client):
        r = client.get("/api/download/lists")
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            data = json.loads(zf.read("advance-list.json"))
        assert isinstance(data, (dict, list))

    def test_basic_list_inside_zip_is_a_non_empty_list(self, client):
        r = client.get("/api/download/lists")
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            data = json.loads(zf.read("basic-list.json"))
        assert isinstance(data, list)
        assert len(data) > 0

    def test_advance_list_inside_zip_is_a_non_empty_list(self, client):
        r = client.get("/api/download/lists")
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            data = json.loads(zf.read("advance-list.json"))
        assert isinstance(data, list)
        assert len(data) > 0

    def test_content_disposition_header_is_present(self, client):
        r = client.get("/api/download/lists")
        assert "content-disposition" in r.headers

    def test_content_disposition_filename_format(self, client):
        r = client.get("/api/download/lists")
        disposition = r.headers["content-disposition"]
        # Expected: attachment; filename=pinfinity-backup_YYYYMMDD_HHMMSS.zip
        assert re.search(r"filename=pinfinity-backup_\d{8}_\d{6}\.zip", disposition), (
            f"Unexpected Content-Disposition: {disposition}"
        )

    def test_zip_record_count_matches_api_total(self, client):
        """Record count in the ZIP must match what the API reports as totalCount."""
        r_zip = client.get("/api/download/lists")
        with zipfile.ZipFile(io.BytesIO(r_zip.content)) as zf:
            basic_in_zip = json.loads(zf.read("basic-list.json"))
            advance_in_zip = json.loads(zf.read("advance-list.json"))

        basic_total = client.get("/api/basic/list").json()["data"]["totalCount"]
        advance_total = client.get("/api/advance/list").json()["data"]["totalCount"]

        assert len(basic_in_zip) == basic_total
        assert len(advance_in_zip) == advance_total
