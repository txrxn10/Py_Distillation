from flask import Blueprint, request, current_app
from app.services import gcs_service
from app.utils.response import success_response, error_response
from app.utils.auth_decorator import require_auth
from marshmallow import Schema, fields, ValidationError
import uuid

upload_bp = Blueprint("uploads", __name__)

class SignedUrlRequestSchema(Schema):
    fileName = fields.Str(required=True)
    contentType = fields.Str(required=True)

@upload_bp.route("/uploads/generate-signed-url", methods=["POST"])
@require_auth
def get_signed_url():
    try:
        validated_data = SignedUrlRequestSchema().load(request.get_json())
        file_name = validated_data['fileName']
        content_type = validated_data['contentType']
        
        # Create a unique path for the file in GCS
        unique_id = str(uuid.uuid4())
        blob_name = f"uploads/{unique_id}/{file_name}"
        
        signed_url = gcs_service.generate_upload_signed_url(blob_name, content_type)
        gs_path = f"gs://{current_app.config['BUCKET_NAME']}/{blob_name}"
        
        return success_response({
            "signedUrl": signed_url,
            "gsPath": gs_path
        })
    except ValidationError as err:
        return error_response("Validation failed", 400, err.messages)
    except Exception as e:
        return error_response(str(e), 500)
    
class DownloadUrlRequestSchema(Schema):
    gsPath = fields.Str(required=True)

@upload_bp.route("/uploads/proxy-upload", methods=["POST"])
def proxy_upload():
    if 'file' not in request.files:
        return error_response("No file part in the request.", 400)
    
    file = request.files['file']
    if file.filename == '':
        return error_response("No selected file.", 400)

    if file:
        try:
            unique_id = str(uuid.uuid4())
            blob_name = f"uploads/{unique_id}/{file.filename}"
            bucket_name = current_app.config['BUCKET_NAME']
            
            # Call the service to upload the file stream directly
            upload_info = gcs_service.upload_to_gcs(
                local_path=file.stream, 
                bucket_name=bucket_name, 
                object_name=blob_name,
                content_type=file.content_type
            )
            
            return success_response(upload_info)
        except Exception as e:
            return error_response(str(e), 500)
    
    return error_response("File upload failed.", 500)

@upload_bp.route("/uploads/generate-download-url", methods=["POST"])
def get_download_url():
    try:
        validated_data = DownloadUrlRequestSchema().load(request.get_json())
        gs_path = validated_data['gsPath']
        
        if not gs_path.startswith(f"gs://{current_app.config['BUCKET_NAME']}/"):
            raise ValueError("Invalid GCS path format.")
        
        blob_name = gs_path.replace(f"gs://{current_app.config['BUCKET_NAME']}/", "")
        signed_url = gcs_service.generate_download_signed_url(blob_name)
        
        return success_response({"signedUrl": signed_url})
    except Exception as e:
        return error_response(str(e), 500)  