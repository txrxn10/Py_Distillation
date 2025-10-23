from flask import current_app
import datetime

def download_from_gcs(gs_uri: str, local_path: str):
    """Downloads a file from GCS to a local path."""
    storage_client = current_app.storage_client
    parts = gs_uri.replace("gs://", "").split("/", 1)
    bucket_name, object_name = parts[0], parts[1]
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(object_name)
    blob.download_to_filename(local_path)
    print(f"Downloaded {gs_uri} to {local_path}")
    return local_path

def upload_to_gcs(local_path: str, bucket_name: str, object_name: str,content_type: str = "video/mp4") -> dict:
    """Uploads a local file to GCS."""
    storage_client = current_app.storage_client
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(object_name)
    if isinstance(local_path, str):
        blob.upload_from_filename(local_path, content_type=content_type)
    else:
        blob.upload_from_file(local_path, content_type=content_type)
    
    gs_uri = f"gs://{bucket_name}/{object_name}"
    public_url = f"https://storage.googleapis.com/{bucket_name}/{object_name}"
    print(f"Uploaded {local_path} to {gs_uri}")
    return {"gs_uri": gs_uri, "public_url": public_url}

def generate_upload_signed_url(blob_name: str, content_type: str) -> str:
    """Generates a v4 signed URL for uploading a file to GCS."""
    storage_client = current_app.storage_client
    bucket_name = current_app.config['BUCKET_NAME']
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)

    # The URL is valid for 60 minutes
    expiration = datetime.timedelta(minutes=60)

    url = blob.generate_signed_url(
        version="v4",
        expiration=expiration,
        method="PUT",
        content_type=content_type,
    )
    return url

def generate_download_signed_url(blob_name: str) -> str:
    """Generates a v4 signed URL for downloading/viewing a file from GCS."""
    storage_client = current_app.storage_client
    bucket_name = current_app.config['BUCKET_NAME']
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)

    # The URL is valid for a set time, e.g., 1 hour
    expiration = datetime.timedelta(hours=1)

    url = blob.generate_signed_url(
        version="v4",
        expiration=expiration,
        method="GET",
    )
    return url
