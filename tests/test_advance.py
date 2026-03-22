"""Tests for advance training CRUD operations."""

SAMPLE_TRAINING = {
    "id": 0,
    "name": "Default Pattern",
    "repeatNum": 2,
    "repeatDelay": 1,
    "intervalTrain": 0,
    "isFavourite": 0,
    "ballList": [
        {
            "ball": 0,
            "spin": 2,
            "power": 2,
            "landType": 0,
            "points": [{"x": 8, "y": 3}],
            "ballTime": 9,
            "random": 0,
            "adjustSpin": 0,
            "adjustPosition": 0,
        },
        {
            "ball": 1,
            "spin": 3,
            "power": 2,
            "landType": 0,
            "points": [{"x": 14, "y": 3}],
            "ballTime": 9,
            "random": 1,
            "adjustSpin": 0,
            "adjustPosition": 0,
        },
        {
            "ball": 1,
            "spin": 1,
            "power": 2,
            "landType": 0,
            "points": [{"x": 12, "y": 3}],
            "ballTime": 9,
            "random": 1,
            "adjustSpin": 0,
            "adjustPosition": 0,
        },
    ],
}


class TestAdvanceSave:
    def test_create_new_training(self, client, restore_advance_list):
        r = client.post("/advance/save", json=SAMPLE_TRAINING)
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 200
        assert data["msg"] == "SUCCESS"
        assert data["data"]["id"] > 0
        assert data["data"]["name"] == SAMPLE_TRAINING["name"]
        assert "createDate" in data["data"]
        assert "updateDate" in data["data"]

    def test_create_serializes_ball_list(self, client, restore_advance_list):
        r = client.post("/advance/save", json=SAMPLE_TRAINING)
        assert r.status_code == 200
        # ballList is stored as stringified JSON in the "json" field
        assert "json" in r.json()["data"]

    def test_create_assigns_new_id(self, client, restore_advance_list):
        r1 = client.post("/advance/save", json=SAMPLE_TRAINING)
        r2 = client.post("/advance/save", json=SAMPLE_TRAINING)
        assert r1.json()["data"]["id"] != r2.json()["data"]["id"]

    def test_update_existing_training(self, client, restore_advance_list):
        r = client.post("/advance/save", json=SAMPLE_TRAINING)
        new_id = r.json()["data"]["id"]

        updated = {**SAMPLE_TRAINING, "id": new_id, "name": "Updated Combo"}
        r = client.post("/advance/save", json=updated)
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "Updated Combo"
        assert r.json()["data"]["id"] == new_id

    def test_created_training_appears_in_list(self, client, restore_advance_list):
        r = client.post("/advance/save", json=SAMPLE_TRAINING)
        new_id = r.json()["data"]["id"]

        r = client.get("/advance/list?patternType=1")
        ids = [rec["id"] for rec in r.json()["data"]["records"]]
        assert new_id in ids

    def test_invalid_json_returns_400(self, client):
        r = client.post(
            "/advance/save",
            content="not-json",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400


class TestAdvanceSetFavourite:
    def test_set_favourite(self, client, restore_advance_list):
        r = client.post("/advance/setFavourite", json={"id": 123, "favourite": 1})
        assert r.status_code == 200
        assert r.json()["code"] == 200
        assert r.json()["msg"] == "SUCCESS"

    def test_unset_favourite(self, client, restore_advance_list):
        client.post("/advance/setFavourite", json={"id": 123, "favourite": 1})
        r = client.post("/advance/setFavourite", json={"id": 123, "favourite": 0})
        assert r.status_code == 200

    def test_favourite_reflected_in_list(self, client, restore_advance_list):
        client.post("/advance/setFavourite", json={"id": 123, "favourite": 1})
        r = client.get("/advance/list")
        records = r.json()["data"]["records"]
        entry = next((rec for rec in records if rec["id"] == 123), None)
        assert entry is not None
        assert entry["isFavourite"] == 1

    def test_missing_favourite_field_returns_400(self, client):
        r = client.post("/advance/setFavourite", json={"id": 123})
        assert r.status_code == 400

    def test_missing_id_field_returns_400(self, client):
        r = client.post("/advance/setFavourite", json={"favourite": 1})
        assert r.status_code == 400

    def test_invalid_json_returns_400(self, client):
        r = client.post(
            "/advance/setFavourite",
            content="not-json",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400


class TestAdvanceDelete:
    def test_delete_training(self, client, restore_advance_list):
        r = client.post("/advance/save", json=SAMPLE_TRAINING)
        new_id = r.json()["data"]["id"]

        r = client.request("DELETE", "/advance/delete", json={"id": new_id})
        assert r.status_code == 200
        assert r.json()["code"] == 200
        assert r.json()["msg"] == "SUCCESS"

    def test_deleted_training_not_in_list(self, client, restore_advance_list):
        r = client.post("/advance/save", json=SAMPLE_TRAINING)
        new_id = r.json()["data"]["id"]

        client.request("DELETE", "/advance/delete", json={"id": new_id})

        r = client.get("/advance/list?patternType=1")
        ids = [rec["id"] for rec in r.json()["data"]["records"]]
        assert new_id not in ids

    def test_missing_id_returns_400(self, client):
        r = client.request("DELETE", "/advance/delete", json={})
        assert r.status_code == 400

    def test_invalid_json_returns_400(self, client):
        r = client.request(
            "DELETE",
            "/advance/delete",
            content="not-json",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400
