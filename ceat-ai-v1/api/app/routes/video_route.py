import os
import uuid
from flask import Blueprint, request,send_file
from app.services import video_service
from app.utils.response import success_response, error_response
from app.utils.auth_decorator import require_auth
from marshmallow import ValidationError
from app.services.gcs_service import download_from_gcs
from app.schemas.video_schema import  MultiSceneSchema ,ProcessExistingVideoSchema

video_bp = Blueprint("video", __name__)

@video_bp.route("/video/generate", methods=["POST"])
@require_auth
def generate_video():
    """
    Receives a storyboard (an array of scenes) and orchestrates the
    full video generation and post-processing workflow.
    This single endpoint handles both single-scene and multi-scene videos.
    """
    data = request.get_json() or {}
    try:
        
        schema = MultiSceneSchema()
        validated_data = schema.load(data)
        result = video_service.generate_full_video(**validated_data)
        
        return success_response(result, "Video generation job completed successfully")
            
    except ValidationError as err:
        return error_response("Validation failed", 400, err.messages)
    except Exception as e:
       
        return error_response(f"An unexpected error occurred: {str(e)}", 500)
    
@video_bp.route("/video/download", methods=["POST"])
@require_auth
def download_route():
    """
    POST /video/download
    Body: { "gs_uri": "gs://bucket/path/to/file.mp4" }
    """
    data = request.json or {}
    gs_uri = data.get("gs_uri")

    if not gs_uri:
        return {"error": "gs_uri is required"}, 400

    try:
        local_path = f"/tmp/{uuid.uuid4()}.mp4"
        file_path = download_from_gcs(gs_uri, local_path)

        return {
            "message": "Video downloaded successfully",
            "local_path": file_path
        }, 200

    except Exception as e:
        return {"error": str(e)}, 500
    
@video_bp.route("/video/show", methods=["GET"])
@require_auth
def show_video():
    local_path = "/tmp/tmp6xsor76m/final_tracked.mp4"
    if not os.path.exists(local_path):
        return {"error": "File not found"}, 404
    
    return send_file(local_path, mimetype="video/mp4")  

@video_bp.route("/video/process", methods=["POST"])
@require_auth
def process_existing():
    """
    Accepts a list of existing GCS video URIs and applies post-processing.
    """
    data = request.get_json() or {}
    schema = ProcessExistingVideoSchema()
    try:
        validated_data = schema.load(data)
        result = video_service.process_existing_videos(
            input_uris=validated_data["input_uris"],
            stitch=validated_data.get("stitch", True),
            transitions=validated_data.get("transitions", False),
            apply_logo_overlay=validated_data.get("apply_logo_overlay", True),
            apply_end_card=validated_data.get("apply_end_card", True),
            apply_motion_tracking=validated_data.get("apply_motion_tracking", False)
        )
        return success_response(result, "Existing videos processed successfully")
    except ValidationError as err:
        return error_response("Validation failed", 400, err.messages)
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)