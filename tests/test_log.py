"""Tests for the POST /api/log endpoint."""

SAMPLE_LOG = {
    "drillType": "basic",
    "pid": 1,
    "pname": "Default Pattern",
    "ptype": 0,
    "tmode": 0,
    "stime": 1700000000,
    "etime": 1700000060,
    "startTime": "2025-01-01T08:00:00Z",
}


class TestLogEndpoint:
    def test_log_basic_drill(self, client, restore_basic_list):
        r = client.post("/api/log", json=SAMPLE_LOG)
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 200
        assert data["msg"] == "SUCCESS"

    def test_log_response_contains_request_fields(self, client, restore_basic_list):
        r = client.post("/api/log", json=SAMPLE_LOG)
        payload = r.json()["data"]
        assert payload["pid"] == SAMPLE_LOG["pid"]
        assert payload["pname"] == SAMPLE_LOG["pname"]
        assert payload["ptype"] == SAMPLE_LOG["ptype"]
        assert payload["tmode"] == SAMPLE_LOG["tmode"]
        assert payload["stime"] == SAMPLE_LOG["stime"]
        assert payload["etime"] == SAMPLE_LOG["etime"]

    def test_log_advance_drill(self, client, restore_advance_list):
        log = {**SAMPLE_LOG, "drillType": "advance", "pid": 123}
        r = client.post("/api/log", json=log)
        assert r.status_code == 200
        assert r.json()["code"] == 200

    def test_log_updates_last_play_date_for_basic(self, client, restore_basic_list):
        r = client.post("/api/log", json=SAMPLE_LOG)
        assert r.status_code == 200

        r = client.get("/api/basic/list")
        records = r.json()["data"]["records"]
        entry = next((rec for rec in records if rec["id"] == SAMPLE_LOG["pid"]), None)
        assert entry is not None
        assert entry["lastPlayDate"] == SAMPLE_LOG["stime"]

    def test_log_updates_last_play_date_for_advance(self, client, restore_advance_list):
        log = {**SAMPLE_LOG, "drillType": "advance", "pid": 123}
        r = client.post("/api/log", json=log)
        assert r.status_code == 200

        r = client.get("/api/advance/list")
        records = r.json()["data"]["records"]
        entry = next((rec for rec in records if rec["id"] == 123), None)
        assert entry is not None
        assert entry["lastPlayDate"] == log["stime"]

    def test_log_unknown_drill_type_still_returns_200(self, client):
        log = {**SAMPLE_LOG, "drillType": "unknown"}
        r = client.post("/api/log", json=log)
        assert r.status_code == 200


class TestLogValidation:
    def test_missing_drill_type_returns_400(self, client):
        log = {k: v for k, v in SAMPLE_LOG.items() if k != "drillType"}
        r = client.post("/api/log", json=log)
        assert r.status_code == 400

    def test_missing_pid_returns_400(self, client):
        log = {k: v for k, v in SAMPLE_LOG.items() if k != "pid"}
        r = client.post("/api/log", json=log)
        assert r.status_code == 400

    def test_missing_start_time_returns_400(self, client):
        log = {k: v for k, v in SAMPLE_LOG.items() if k != "startTime"}
        r = client.post("/api/log", json=log)
        assert r.status_code == 400

    def test_invalid_json_returns_400(self, client):
        r = client.post(
            "/api/log",
            content="not-json",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400
        assert r.json()["code"] == 400
