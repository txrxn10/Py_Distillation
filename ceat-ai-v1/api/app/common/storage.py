# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import base64
from dataclasses import asdict, dataclass, field
from datetime import datetime
from functools import lru_cache

from google.cloud import aiplatform
from google.cloud import storage
import vertexai

from app.config.default import Default
from app.config.firebase_config import FirebaseClient


cfg = Default()

db = FirebaseClient(cfg.GENMEDIA_FIREBASE_DB).get_client()


@dataclass
class Session:
    """Represents a user session."""

    id: str
    user_email: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_accessed_at: datetime = field(default_factory=datetime.utcnow)


def get_or_create_session(session_id: str, user_email: str) -> Session:
    """
    Retrieves a session from Firestore or creates a new one if it doesn't exist.
    """
    session_ref = db.collection(cfg.SESSIONS_COLLECTION_NAME).document(session_id)
    session_doc = session_ref.get()

    if session_doc.exists:
        session = Session(**session_doc.to_dict())
        # Update last accessed time
        session.last_accessed_at = datetime.utcnow()
        session_ref.update({"last_accessed_at": session.last_accessed_at})
        return session
    else:
        session = Session(id=session_id, user_email=user_email)
        session_ref.set(asdict(session))
        return session


def store_to_gcs(
    folder: str,
    file_name: str,
    mime_type: str,
    contents: str | bytes,
    decode: bool = False,
    bucket_name: str | None = None,
):
    """store contents to GCS"""
    actual_bucket_name = bucket_name if bucket_name else cfg.GENMEDIA_BUCKET
    if not actual_bucket_name:
        raise ValueError(
            "GCS bucket name is not configured. Please set GENMEDIA_BUCKET environment variable or provide bucket_name."
        )
    print(f"store_to_gcs: Target project {cfg.PROJECT_ID}, target bucket {actual_bucket_name}")
    client = storage.Client(project=cfg.PROJECT_ID)
    bucket = client.get_bucket(actual_bucket_name)
    destination_blob_name = f"{folder}/{file_name}"
    print(f"store_to_gcs: Destination {destination_blob_name}")
    blob = bucket.blob(destination_blob_name)
    if decode:
        contents_bytes = base64.b64decode(contents)
        blob.upload_from_string(contents_bytes, content_type=mime_type)
    elif isinstance(contents, bytes):
        blob.upload_from_string(contents, content_type=mime_type)
    else:
        blob.upload_from_string(contents, content_type=mime_type)
    return f"gs://{actual_bucket_name}/{destination_blob_name}"  # Return full gsutil URI

def download_from_gcs(gcs_uri: str) -> bytes:
    """Downloads a file from a GCS URI and returns its content as bytes."""
    client = storage.Client(project=cfg.PROJECT_ID)
    blob = storage.Blob.from_string(gcs_uri, client=client)
    return blob.download_as_bytes()


def generate_signed_url(gcs_uri: str, expiration_hours: int = 24) -> str:
    """
    Generate a signed URL for a GCS object that allows temporary access.
    
    Args:
        gcs_uri: The GCS URI (gs://bucket/path/to/file)
        expiration_hours: How many hours the signed URL should be valid (default: 24)
    
    Returns:
        A signed URL that can be used to access the object
    """
    from datetime import timedelta
    
    try:
        # Parse the GCS URI to extract bucket and blob name
        if not gcs_uri.startswith('gs://'):
            raise ValueError(f"Invalid GCS URI format: {gcs_uri}")
        
        # Remove gs:// prefix and split bucket/path
        path_parts = gcs_uri[5:].split('/', 1)
        if len(path_parts) != 2:
            raise ValueError(f"Invalid GCS URI format: {gcs_uri}")
        
        bucket_name, blob_name = path_parts
        
        # Create storage client and get the blob
        client = storage.Client(project=cfg.PROJECT_ID)
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        
        # Generate signed URL with expiration
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(hours=expiration_hours),
            method="GET"
        )
        
        print(f"Generated signed URL for {gcs_uri} (expires in {expiration_hours}h)")
        return signed_url
        
    except Exception as e:
        print(f"Error generating signed URL for {gcs_uri}: {e}")
        # Return the original URI as fallback (might not work in browser but won't break the API)
        return gcs_uri


def generate_signed_urls(gcs_uris: list[str], expiration_hours: int = 24) -> list[str]:
    """
    Generate signed URLs for multiple GCS objects.
    
    Args:
        gcs_uris: List of GCS URIs
        expiration_hours: How many hours the signed URLs should be valid (default: 24)
    
    Returns:
        List of signed URLs corresponding to the input URIs
    """
    signed_urls = []
    
    for gcs_uri in gcs_uris:
        try:
            signed_url = generate_signed_url(gcs_uri, expiration_hours)
            signed_urls.append(signed_url)
        except Exception as e:
            print(f"Failed to generate signed URL for {gcs_uri}: {e}")
            # Add the original URI as fallback
            signed_urls.append(gcs_uri)
    
    return signed_urls
