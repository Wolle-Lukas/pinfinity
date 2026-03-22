"""Tests for basic training CRUD operations."""

SAMPLE_TRAINING = {
    "id": 0,
    "name": "P7. Performance Random",
    "ball": 1,
    "spin": 1,
    "power": 1,
    "landType": 2,
    "ballTime": 4,
    "numType": 1,
    "times": 30,
    "adjustSpin": 0,
    "adjustPosition": 0,
    "points": [
        {"x": 15, "y": 2},
        {"x": 14, "y": 2},
        {"x": 13, "y": 2},
        {"x": 12, "y": 2},
        {"x": 11, "y": 2},
        {"x": 15, "y": 3},
        {"x": 11, "y": 1},
        {"x": 13, "y": 3},
        {"x": 12, "y": 1},
        {"x": 14, "y": 3},
    ],
    "isFavourite": 0,
}


class TestBasicSave:
    def test_create_new_training(self, client, restore_basic_list):
        r = client.post("/basic/save", json=SAMPLE_TRAINING)
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 200
        assert data["msg"] == "SUCCESS"
        assert data["data"]["id"] > 0
        assert data["data"]["name"] == SAMPLE_TRAINING["name"]
        assert "createDate" in data["data"]
        assert "updateDate" in data["data"]

    def test_create_assigns_new_id(self, client, restore_basic_list):
        r1 = client.post("/basic/save", json=SAMPLE_TRAINING)
        r2 = client.post("/basic/save", json=SAMPLE_TRAINING)
        assert r1.json()["data"]["id"] != r2.json()["data"]["id"]

    def test_update_existing_training(self, client, restore_basic_list):
        r = client.post("/basic/save", json=SAMPLE_TRAINING)
        new_id = r.json()["data"]["id"]

        updated = {**SAMPLE_TRAINING, "id": new_id, "name": "Updated Name"}
        r = client.post("/basic/save", json=updated)
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "Updated Name"
        assert r.json()["data"]["id"] == new_id

    def test_created_training_appears_in_list(self, client, restore_basic_list):
        r = client.post("/basic/save", json=SAMPLE_TRAINING)
        new_id = r.json()["data"]["id"]

        r = client.get("/basic/list?patternType=1")
        ids = [rec["id"] for rec in r.json()["data"]["records"]]
        assert new_id in ids

    def test_invalid_json_returns_400(self, client):
        r = client.post(
            "/basic/save",
            content="not-json",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400
        assert r.json()["code"] == 400


class TestBasicSetFavourite:
    def test_set_favourite(self, client, restore_basic_list):
        r = client.post("/basic/setFavourite", json={"id": 1, "favourite": 1})
        assert r.status_code == 200
        assert r.json()["code"] == 200
        assert r.json()["msg"] == "SUCCESS"

    def test_unset_favourite(self, client, restore_basic_list):
        client.post("/basic/setFavourite", json={"id": 1, "favourite": 1})
        r = client.post("/basic/setFavourite", json={"id": 1, "favourite": 0})
        assert r.status_code == 200

    def test_favourite_reflected_in_list(self, client, restore_basic_list):
        client.post("/basic/setFavourite", json={"id": 1, "favourite": 1})
        r = client.get("/basic/list")
        records = r.json()["data"]["records"]
        entry = next((rec for rec in records if rec["id"] == 1), None)
        assert entry is not None
        assert entry["isFavourite"] == 1

    def test_missing_favourite_field_returns_400(self, client):
        r = client.post("/basic/setFavourite", json={"id": 1})
        assert r.status_code == 400

    def test_missing_id_field_returns_400(self, client):
        r = client.post("/basic/setFavourite", json={"favourite": 1})
        assert r.status_code == 400

    def test_invalid_json_returns_400(self, client):
        r = client.post(
            "/basic/setFavourite",
            content="not-json",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400


class TestBasicDelete:
    def test_delete_training(self, client, restore_basic_list):
        r = client.post("/basic/save", json=SAMPLE_TRAINING)
        new_id = r.json()["data"]["id"]

        r = client.request("DELETE", "/basic/delete", json={"id": new_id})
        assert r.status_code == 200
        assert r.json()["code"] == 200
        assert r.json()["msg"] == "SUCCESS"

    def test_deleted_training_not_in_list(self, client, restore_basic_list):
        r = client.post("/basic/save", json=SAMPLE_TRAINING)
        new_id = r.json()["data"]["id"]

        client.request("DELETE", "/basic/delete", json={"id": new_id})

        r = client.get("/basic/list?patternType=1")
        ids = [rec["id"] for rec in r.json()["data"]["records"]]
        assert new_id not in ids

    def test_missing_id_returns_400(self, client):
        r = client.request("DELETE", "/basic/delete", json={})
        assert r.status_code == 400

    def test_invalid_json_returns_400(self, client):
        r = client.request(
            "DELETE",
            "/basic/delete",
            content="not-json",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400
