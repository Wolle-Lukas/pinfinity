"""Edge-case tests for advance training endpoints.

Mirrors test_basic_edge_cases.py and adds advance-specific cases:
ballList serialisation into the "json" field, update of that field.
"""

import json
import time

SAMPLE = {
    "id": 0,
    "name": "Edge Test",
    "repeatNum": 2,
    "repeatDelay": 1,
    "intervalTrain": 0,
    "isFavourite": 0,
    "ballList": [
        {
            "ball": 1,
            "spin": 1,
            "power": 2,
            "landType": 0,
            "points": [{"x": 8, "y": 2}],
            "ballTime": 9,
            "random": 0,
            "adjustSpin": 0,
            "adjustPosition": 0,
        }
    ],
}


# ── List: pagination boundaries ──────────────────────────────


class TestAdvanceListPagination:
    def test_pagesize_at_max_allowed_returns_200(self, client):
        r = client.get("/api/advance/list?pageSize=500")
        assert r.status_code == 200

    def test_pagesize_above_max_returns_422(self, client):
        r = client.get("/api/advance/list?pageSize=501")
        assert r.status_code == 422

    def test_pagesize_zero_returns_422(self, client):
        r = client.get("/api/advance/list?pageSize=0")
        assert r.status_code == 422

    def test_pagenum_beyond_total_returns_empty_records(self, client):
        r = client.get("/api/advance/list?pageNum=99999&pageSize=100")
        assert r.status_code == 200
        assert r.json()["data"]["records"] == []

    def test_pagenum_zero_returns_200(self, client):
        r = client.get("/api/advance/list?pageNum=0&pageSize=1")
        assert r.status_code == 200

    def test_total_count_is_consistent_across_pages(self, client):
        r1 = client.get("/api/advance/list?pageNum=1&pageSize=1")
        r2 = client.get("/api/advance/list?pageNum=2&pageSize=1")
        assert r1.json()["data"]["totalCount"] == r2.json()["data"]["totalCount"]

    def test_pages_field_equals_ceil_of_total_over_size(self, client):
        import math

        r = client.get("/api/advance/list?pageSize=3")
        data = r.json()["data"]
        assert data["pages"] == math.ceil(data["totalCount"] / 3)


# ── List: filters ────────────────────────────────────────────


class TestAdvanceListFilters:
    def test_name_filter_is_case_insensitive(self, client):
        r_lower = client.get("/api/advance/list?name=bh")
        r_upper = client.get("/api/advance/list?name=BH")
        assert (
            r_lower.json()["data"]["totalCount"] == r_upper.json()["data"]["totalCount"]
        )

    def test_name_filter_with_regex_special_chars_does_not_crash(self, client):
        r = client.get("/api/advance/list?name=test%28%29%5B%5D%2B")
        assert r.status_code == 200

    def test_records_sorted_by_last_play_date_descending(self, client):
        records = client.get("/api/advance/list").json()["data"]["records"]
        dates = [rec.get("lastPlayDate", 0) for rec in records]
        assert dates == sorted(dates, reverse=True)

    def test_nonexistent_name_returns_empty(self, client):
        r = client.get("/api/advance/list?name=ZZZNOMATCH99999")
        assert r.status_code == 200
        assert r.json()["data"]["records"] == []


# ── Save: response structure ─────────────────────────────────


class TestAdvanceSaveResponseStructure:
    def test_response_has_required_top_level_fields(self, client, restore_advance_list):
        r = client.post("/api/advance/save", json=SAMPLE)
        body = r.json()
        assert "code" in body
        assert "msg" in body
        assert "data" in body

    def test_new_record_has_timestamp_fields(self, client, restore_advance_list):
        r = client.post("/api/advance/save", json=SAMPLE)
        data = r.json()["data"]
        assert "createDate" in data
        assert "updateDate" in data
        assert "lastPlayDate" in data

    def test_new_record_uid_is_123(self, client, restore_advance_list):
        r = client.post("/api/advance/save", json=SAMPLE)
        assert r.json()["data"]["uid"] == 123

    def test_new_record_preserves_is_favourite(self, client, restore_advance_list):
        r = client.post("/api/advance/save", json={**SAMPLE, "isFavourite": 1})
        assert r.json()["data"]["isFavourite"] == 1

    def test_new_record_collect_flag_is_zero(self, client, restore_advance_list):
        r = client.post("/api/advance/save", json=SAMPLE)
        assert r.json()["data"]["collectFlag"] == 0


# ── Save: ballList serialisation ─────────────────────────────


class TestAdvanceBallListSerialisation:
    def test_json_field_is_stringified_ball_list(self, client, restore_advance_list):
        r = client.post("/api/advance/save", json=SAMPLE)
        data = r.json()["data"]
        assert "json" in data
        parsed = json.loads(data["json"])
        assert parsed == SAMPLE["ballList"]

    def test_update_refreshes_json_field(self, client, restore_advance_list):
        r = client.post("/api/advance/save", json=SAMPLE)
        new_id = r.json()["data"]["id"]

        new_ball_list = [{**SAMPLE["ballList"][0], "ball": 0}]
        r = client.post(
            "/api/advance/save",
            json={**SAMPLE, "id": new_id, "ballList": new_ball_list},
        )
        parsed = json.loads(r.json()["data"]["json"])
        assert parsed[0]["ball"] == 0

    def test_empty_ball_list_is_stored_as_empty_array(
        self, client, restore_advance_list
    ):
        r = client.post("/api/advance/save", json={**SAMPLE, "ballList": []})
        parsed = json.loads(r.json()["data"]["json"])
        assert parsed == []


# ── Save: timestamp semantics ────────────────────────────────


class TestAdvanceSaveTimestamps:
    def test_update_does_not_change_create_date(self, client, restore_advance_list):
        r = client.post("/api/advance/save", json=SAMPLE)
        saved = r.json()["data"]
        create_date = saved["createDate"]
        new_id = saved["id"]

        time.sleep(1)

        r = client.post(
            "/api/advance/save", json={**SAMPLE, "id": new_id, "name": "Updated"}
        )
        assert r.json()["data"]["createDate"] == create_date

    def test_update_changes_update_date(self, client, restore_advance_list):
        r = client.post("/api/advance/save", json=SAMPLE)
        saved = r.json()["data"]
        create_date = saved["createDate"]
        new_id = saved["id"]

        time.sleep(1)

        r = client.post(
            "/api/advance/save", json={**SAMPLE, "id": new_id, "name": "Updated"}
        )
        assert r.json()["data"]["updateDate"] >= create_date


# ── Save: ID assignment ───────────────────────────────────────


class TestAdvanceSaveIdAssignment:
    def test_ids_are_strictly_increasing(self, client, restore_advance_list):
        ids = [
            client.post("/api/advance/save", json=SAMPLE).json()["data"]["id"]
            for _ in range(3)
        ]
        assert ids == sorted(ids)
        assert len(set(ids)) == 3

    def test_update_returns_same_id(self, client, restore_advance_list):
        r = client.post("/api/advance/save", json=SAMPLE)
        new_id = r.json()["data"]["id"]
        r = client.post("/api/advance/save", json={**SAMPLE, "id": new_id, "name": "X"})
        assert r.json()["data"]["id"] == new_id


# ── Non-existent IDs ─────────────────────────────────────────


class TestAdvanceNonExistentId:
    def test_update_nonexistent_id_returns_200_with_null_data(
        self, client, restore_advance_list
    ):
        r = client.post("/api/advance/save", json={**SAMPLE, "id": 999999})
        assert r.status_code == 200
        assert r.json()["data"] is None

    def test_delete_nonexistent_id_returns_200(self, client):
        r = client.request("DELETE", "/api/advance/delete", json={"id": 999999})
        assert r.status_code == 200
        assert r.json()["code"] == 200

    def test_setfavourite_nonexistent_id_returns_200(self, client):
        r = client.post(
            "/api/advance/setFavourite", json={"id": 999999, "favourite": 1}
        )
        assert r.status_code == 200
        assert r.json()["code"] == 200
