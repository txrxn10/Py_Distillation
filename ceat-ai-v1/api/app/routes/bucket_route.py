from flask import Blueprint
from google.cloud import storage
from app.utils.response import success_response, error_response
from app.utils.auth_decorator import require_auth
import os

bucket_bp = Blueprint("bucket", __name__)

@bucket_bp.route("/buckets/list", methods=["GET"])
@require_auth
def list_buckets():
    """
    List all GCS buckets in the configured project.
    """
    try:
        project_id = os.getenv("PROJECT_ID")
        if not project_id:
            return error_response("PROJECT_ID is not set in environment.", 400)

        client = storage.Client(project=project_id)
        buckets = list(client.list_buckets())

        bucket_names = [bucket.name for bucket in buckets]

        return success_response(
            {"buckets": bucket_names},
            message="Buckets fetched successfully"
        )
    except Exception as e:
        return error_response(str(e), 500)



@bucket_bp.route("/buckets/<bucket_name>/objects", methods=["GET"])
def list_bucket_objects(bucket_name):
    """
    List all objects/files inside a given bucket.
    """
    try:
        project_id = os.getenv("PROJECT_ID")
        if not project_id:
            return error_response("PROJECT_ID is not set in environment.", 400)

        client = storage.Client(project=project_id)
        bucket = client.bucket(bucket_name)

        if not bucket.exists():
            return error_response(f"Bucket '{bucket_name}' does not exist.", 404)

        blobs = list(bucket.list_blobs())
        objects = [{"name": blob.name, "size": blob.size, "updated": blob.updated.isoformat()} for blob in blobs]

        return success_response(
            {"objects": objects},
            message=f"Objects in bucket '{bucket_name}' fetched successfully"
        )
    except Exception as e:
        return error_response(str(e), 500)
