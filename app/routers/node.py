from fastapi import APIRouter
import json
import os

router = APIRouter()


@router.get("/node/sports/fields", tags=["node"])
async def read_sports_fields():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "node-sports-fields.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)
    
@router.get("/node/settings/values", tags=["node"])
async def read_settings_values():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "node-settings-values.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)

@router.post("/node/appUpdate", status_code=404, tags=["node"])
async def read_appUpdate():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "node-appUpdate.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)

@router.get("/node/notifications", tags=["node"])
async def read_notifications():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "node-notifications.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)

@router.get("/node/subscriptions/checkSubscriptionStatus", tags=["node"])
async def read_subscriptions():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "node-subscriptions-checkSubscriptionStatus.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)

@router.get("/node/carousel/list", tags=["node"])
async def read_carousel_list():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "node-carousel-list.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)

@router.post("/node/newsArticles/list", tags=["node"])
async def read_newsArticlesList():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "node-newsArticles-list.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)

@router.post("/node/courts/list", status_code=500, tags=["node"])
async def read_courtsList():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "node-courts-list.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)

@router.get("/node/youtube/recentLiveVideos", tags=["node"])
async def read_youtube_recentLiveVideos():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "node-youtube-recentLiveVideos.json")
    with open(os.path.abspath(data_path), "r") as f:
        return json.load(f)
