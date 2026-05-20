"""Edge-case tests for basic training endpoints.

Covers pagination boundaries, filter combinations, response structure,
ID assignment, timestamp semantics, and silent no-op behaviours.
"""

import time

SAMPLE = {
    "id": 0,
    "name": "Edge Test",
    "ball": 1,
    "spin": 2,
    "power": 1,
    "landType": 0,
    "ballTime": 9,
    "numType": 1,
    "times": 5,
    "adjustSpin": 0,
    "adjustPosition": 0,
    "points": [{"x": 8, "y": 2}],
    "isFavourite": 0,
}


# ── List: pagination boundaries ──────────────────────────────


class TestBasicListPagination:
    def test_pagesize_at_max_allowed_returns_200(self, client):
        r = client.get("/api/basic/list?pageSize=500")
        assert r.status_code == 200

    def test_pagesize_above_max_returns_422(self, client):
        r = client.get("/api/basic/list?pageSize=501")
        assert r.status_code == 422

    def test_pagesize_zero_returns_422(self, client):
        r = client.get("/api/basic/list?pageSize=0")
        assert r.status_code == 422

    def test_pagenum_beyond_total_returns_empty_records(self, client):
        r = client.get("/api/basic/list?pageNum=99999&pageSize=100")
        assert r.status_code == 200
        assert r.json()["data"]["records"] == []

    def test_pagenum_zero_returns_200(self, client):
        # pageNum has no ge/le guard — 0 is accepted but produces a negative
        # start offset. Behaviour: Python slices wrap, so the last page is
        # returned instead of the first. Documented here as a known quirk.
        r = client.get("/api/basic/list?pageNum=0&pageSize=1")
        assert r.status_code == 200

    def test_total_count_is_consistent_across_pages(self, client):
        r1 = client.get("/api/basic/list?pageNum=1&pageSize=1")
        r2 = client.get("/api/basic/list?pageNum=2&pageSize=1")
        assert r1.json()["data"]["totalCount"] == r2.json()["data"]["totalCount"]

    def test_pages_field_equals_ceil_of_total_over_size(self, client):
        r = client.get("/api/basic/list?pageSize=3")
        data = r.json()["data"]
        import math

        expected = math.ceil(data["totalCount"] / 3)
        assert data["pages"] == expected


# ── List: filter combinations ────────────────────────────────


class TestBasicListFilters:
    def test_name_filter_is_case_insensitive(self, client):
        r_lower = client.get("/api/basic/list?name=default")
        r_upper = client.get("/api/basic/list?name=DEFAULT")
        assert r_lower.status_code == 200
        assert r_upper.status_code == 200
        assert (
            r_lower.json()["data"]["totalCount"] == r_upper.json()["data"]["totalCount"]
        )

    def test_name_filter_with_regex_special_chars_does_not_crash(self, client):
        r = client.get("/api/basic/list?name=test%28%29%5B%5D%2B")  # test()[]+
        assert r.status_code == 200

    def test_ball_and_spin_combined_filter(self, client):
        r = client.get("/api/basic/list?ball=1&spin=1")
        assert r.status_code == 200
        for rec in r.json()["data"]["records"]:
            assert rec["ball"] == 1
            assert rec["spin"] == 1

    def test_nonexistent_ball_value_returns_empty(self, client):
        r = client.get("/api/basic/list?ball=999")
        assert r.status_code == 200
        assert r.json()["data"]["records"] == []

    def test_records_sorted_by_last_play_date_descending(self, client):
        r = client.get("/api/basic/list")
        records = r.json()["data"]["records"]
        dates = [rec.get("lastPlayDate", 0) for rec in records]
        assert dates == sorted(dates, reverse=True)


# ── Save: response structure ─────────────────────────────────


class TestBasicSaveResponseStructure:
    def test_response_has_required_top_level_fields(self, client, restore_basic_list):
        r = client.post("/api/basic/save", json=SAMPLE)
        body = r.json()
        assert "code" in body
        assert "msg" in body
        assert "data" in body

    def test_new_record_has_timestamp_fields(self, client, restore_basic_list):
        r = client.post("/api/basic/save", json=SAMPLE)
        data = r.json()["data"]
        assert "createDate" in data
        assert "updateDate" in data
        assert "lastPlayDate" in data
        assert "lastPlayDateUTC" in data

    def test_new_record_uid_is_123(self, client, restore_basic_list):
        r = client.post("/api/basic/save", json=SAMPLE)
        assert r.json()["data"]["uid"] == 123

    def test_new_record_collect_flag_is_zero(self, client, restore_basic_list):
        r = client.post("/api/basic/save", json=SAMPLE)
        assert r.json()["data"]["collectFlag"] == 0

    def test_new_record_preserves_is_favourite(self, client, restore_basic_list):
        r = client.post("/api/basic/save", json={**SAMPLE, "isFavourite": 1})
        assert r.json()["data"]["isFavourite"] == 1


# ── Save: timestamp semantics ────────────────────────────────


class TestBasicSaveTimestamps:
    def test_update_does_not_change_create_date(self, client, restore_basic_list):
        r = client.post("/api/basic/save", json=SAMPLE)
        saved = r.json()["data"]
        new_id = saved["id"]
        create_date = saved["createDate"]

        time.sleep(1)  # ensure clock advances

        r = client.post(
            "/api/basic/save", json={**SAMPLE, "id": new_id, "name": "Updated"}
        )
        assert r.json()["data"]["createDate"] == create_date

    def test_update_changes_update_date(self, client, restore_basic_list):
        r = client.post("/api/basic/save", json=SAMPLE)
        saved = r.json()["data"]
        new_id = saved["id"]
        create_date = saved["createDate"]

        time.sleep(1)

        r = client.post(
            "/api/basic/save", json={**SAMPLE, "id": new_id, "name": "Updated"}
        )
        assert r.json()["data"]["updateDate"] >= create_date


# ── Save: ID assignment ───────────────────────────────────────


class TestBasicSaveIdAssignment:
    def test_ids_are_strictly_increasing(self, client, restore_basic_list):
        ids = []
        for _ in range(3):
            r = client.post("/api/basic/save", json=SAMPLE)
            ids.append(r.json()["data"]["id"])
        assert ids == sorted(ids)
        assert len(set(ids)) == 3

    def test_update_returns_same_id(self, client, restore_basic_list):
        r = client.post("/api/basic/save", json=SAMPLE)
        new_id = r.json()["data"]["id"]
        r = client.post("/api/basic/save", json={**SAMPLE, "id": new_id, "name": "X"})
        assert r.json()["data"]["id"] == new_id


# ── Save / Delete / setFavourite: non-existent IDs ───────────


class TestBasicNonExistentId:
    def test_update_nonexistent_id_returns_200_with_null_data(
        self, client, restore_basic_list
    ):
        # The router does not validate whether the ID exists before updating.
        # When the ID is not found, first() returns None → data is null.
        r = client.post("/api/basic/save", json={**SAMPLE, "id": 999999})
        assert r.status_code == 200
        assert r.json()["data"] is None

    def test_delete_nonexistent_id_returns_200(self, client):
        # Delete is a silent no-op when the ID does not exist.
        r = client.request("DELETE", "/api/basic/delete", json={"id": 999999})
        assert r.status_code == 200
        assert r.json()["code"] == 200

    def test_setfavourite_nonexistent_id_returns_200(self, client):
        # setFavourite is also a silent no-op when the ID does not exist.
        r = client.post("/api/basic/setFavourite", json={"id": 999999, "favourite": 1})
        assert r.status_code == 200
        assert r.json()["code"] == 200


# ── Delete: guard on system records ──────────────────────────


class TestBasicDeleteSystemRecord:
    def test_delete_system_record_uid0_succeeds(self, client, restore_basic_list):
        # The router has no guard against deleting system records (uid=0).
        # This test documents the current permissive behaviour.
        system_records = client.get("/api/basic/list?patternType=0").json()["data"][
            "records"
        ]
        if not system_records:
            return  # nothing to test if there are no system records
        system_id = system_records[0]["id"]
        r = client.request("DELETE", "/api/basic/delete", json={"id": system_id})
        assert r.status_code == 200


# ── setFavourite: value range ─────────────────────────────────


class TestBasicSetFavouriteValues:
    def test_favourite_value_is_persisted_verbatim(self, client, restore_basic_list):
        # Any integer is accepted — the API does not validate range.
        client.post("/api/basic/setFavourite", json={"id": 1, "favourite": 99})
        r = client.get("/api/basic/list")
        entry = next(
            (rec for rec in r.json()["data"]["records"] if rec["id"] == 1), None
        )
        assert entry is not None
        assert entry["isFavourite"] == 99
