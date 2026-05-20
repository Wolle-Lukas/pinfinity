"""Tests for all read-only endpoints that serve static or file-backed data."""


class TestUserEndpoints:
    def test_get_user_info(self, client):
        r = client.get("/api/user/info")
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 200
        assert data["msg"] == "SUCCESS"
        assert "id" in data["data"]
        assert "name" in data["data"]
        assert "email" in data["data"]


class TestBasicStaticEndpoints:
    def test_get_skill_level(self, client):
        r = client.get("/api/basic/skillLevel")
        assert r.status_code == 200

    def test_get_info(self, client):
        r = client.get("/api/basic/info")
        assert r.status_code == 200

    def test_get_list(self, client):
        r = client.get("/api/basic/list")
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 200
        assert data["msg"] == "SUCCESS"
        assert "records" in data["data"]
        assert "totalCount" in data["data"]
        assert "pages" in data["data"]

    def test_get_list_filter_system_patterns(self, client):
        r = client.get("/api/basic/list?patternType=0")
        assert r.status_code == 200
        records = r.json()["data"]["records"]
        assert len(records) > 0
        for rec in records:
            assert rec["uid"] == 0

    def test_get_list_filter_user_patterns(self, client):
        r = client.get("/api/basic/list?patternType=1")
        assert r.status_code == 200
        for rec in r.json()["data"]["records"]:
            assert rec["uid"] != 0

    def test_get_list_filter_name(self, client):
        r = client.get("/api/basic/list?name=Default")
        assert r.status_code == 200
        for rec in r.json()["data"]["records"]:
            assert "default" in rec["name"].lower()

    def test_get_list_filter_ball(self, client):
        r = client.get("/api/basic/list?ball=1")
        assert r.status_code == 200
        for rec in r.json()["data"]["records"]:
            assert rec["ball"] == 1

    def test_get_list_filter_spin(self, client):
        r = client.get("/api/basic/list?spin=2")
        assert r.status_code == 200
        for rec in r.json()["data"]["records"]:
            assert rec["spin"] == 2

    def test_get_list_pagination(self, client):
        r = client.get("/api/basic/list?pageNum=1&pageSize=5")
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["size"] == 5
        assert len(data["records"]) <= 5
        assert data["current"] == 1

    def test_get_list_pagination_pages_calculated_correctly(self, client):
        r_all = client.get("/api/basic/list")
        total = r_all.json()["data"]["totalCount"]

        page_size = 10
        r = client.get(f"/api/basic/list?pageSize={page_size}")
        expected_pages = (total + page_size - 1) // page_size
        assert r.json()["data"]["pages"] == expected_pages


class TestAdvanceStaticEndpoints:
    def test_get_info(self, client):
        r = client.get("/api/advance/info")
        assert r.status_code == 200

    def test_get_list(self, client):
        r = client.get("/api/advance/list")
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 200
        assert data["msg"] == "SUCCESS"
        assert "records" in data["data"]
        assert "totalCount" in data["data"]

    def test_get_list_filter_system_patterns(self, client):
        r = client.get("/api/advance/list?patternType=0")
        assert r.status_code == 200
        for rec in r.json()["data"]["records"]:
            assert rec["uid"] == 0

    def test_get_list_filter_name(self, client):
        r = client.get("/api/advance/list?name=BH")
        assert r.status_code == 200
        for rec in r.json()["data"]["records"]:
            assert "bh" in rec["name"].lower()

    def test_get_list_pagination(self, client):
        r = client.get("/api/advance/list?pageNum=1&pageSize=3")
        assert r.status_code == 200
        assert len(r.json()["data"]["records"]) <= 3


class TestBaseEndpoints:
    def test_get_conf(self, client):
        r = client.get("/api/base/conf")
        assert r.status_code == 200

    def test_get_conf_with_version(self, client):
        r = client.get("/api/base/conf?version=5")
        assert r.status_code == 200


class TestNodeEndpoints:
    def test_get_sports_fields(self, client):
        r = client.get("/api/node/sports/fields")
        assert r.status_code == 200

    def test_get_settings_values(self, client):
        r = client.get("/api/node/settings/values")
        assert r.status_code == 200

    def test_post_app_update_returns_404(self, client):
        # Intentional 404 to mimic original Joola API
        r = client.post("/api/node/appUpdate")
        assert r.status_code == 404

    def test_get_notifications(self, client):
        r = client.get("/api/node/notifications")
        assert r.status_code == 200

    def test_get_subscription_status(self, client):
        r = client.get("/api/node/subscriptions/checkSubscriptionStatus")
        assert r.status_code == 200

    def test_get_carousel_list(self, client):
        r = client.get("/api/node/carousel/list")
        assert r.status_code == 200

    def test_post_news_articles(self, client):
        r = client.post("/api/node/newsArticles/list")
        assert r.status_code == 200

    def test_post_courts_list_returns_500(self, client):
        # Intentional 500 to mimic original Joola API
        r = client.post("/api/node/courts/list")
        assert r.status_code == 500

    def test_get_youtube_videos(self, client):
        r = client.get("/api/node/youtube/recentLiveVideos")
        assert r.status_code == 200


class TestTutorialEndpoints:
    def test_post_my_training(self, client):
        r = client.post("/api/tutorial/myTraining")
        assert r.status_code == 200

    def test_post_list(self, client):
        r = client.post("/api/tutorial/list")
        assert r.status_code == 200

    def test_post_recommend(self, client):
        r = client.post("/api/tutorial/recommend")
        assert r.status_code == 200

    def test_get_filters(self, client):
        r = client.get("/api/tutorial/filters")
        assert r.status_code == 200


class TestConfigEndpoints:
    def test_post_country(self, client):
        r = client.post("/api/config/country")
        assert r.status_code == 200


class TestDeviceEndpoints:
    def test_post_device_list(self, client):
        r = client.post("/api/device/list")
        assert r.status_code == 200


class TestDownloadEndpoints:
    def test_download_lists(self, client):
        r = client.get("/api/download/lists")
        assert r.status_code == 200
        assert "application/zip" in r.headers["content-type"]
        assert len(r.content) > 0
