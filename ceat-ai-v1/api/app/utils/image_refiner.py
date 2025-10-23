import os
import uuid
import time
from flask import current_app
from app.services.gcs_service import upload_to_gcs, download_from_gcs

def refine_last_frame(degraded_path: str, original_tire_gcs: dict, tmp_dir: str, bucket_name: str, strength: float = 0.7) -> dict:
    """
    Enhanced refinement with better debugging
    """
    vertex_client = current_app.vertex_client
    
    try:
        # Create unique names for this refinement session
        session_id = uuid.uuid4().hex
        refined_gcs_name = f"uploads/temp/refined_{session_id}.jpg"
        refined_gcs_uri = f"gs://{bucket_name}/{refined_gcs_name}"
        
        # Upload degraded frame to GCS
        degraded_gcs_name = f"uploads/temp/degraded_{session_id}.jpg"
        upload_info = upload_to_gcs(degraded_path, bucket_name, degraded_gcs_name, "image/jpeg")
        degraded_gcs = upload_info["gs_uri"]
        
        print("=" * 50)
        print("STARTING FRAME REFINEMENT")
        print(f"Session ID: {session_id}")
        print(f"Degraded frame: {degraded_gcs}")
        print(f"Original tire: {original_tire_gcs['gcsUri']}")
        print(f"Target output: {refined_gcs_uri}")
        print("=" * 50)
        
        # Call refinement
        print("Calling Vertex AI for image refinement...")
        refined_gcs_result = vertex_client.refine_frame_for_chaining(
            degraded_gcs, 
            original_tire_gcs["gcsUri"], 
            refined_gcs_uri,
            strength=strength
        )
        
        print(f"Refinement completed. Result: {refined_gcs_result}")
        
        # Check if refinement actually created a new image or used fallback
        if refined_gcs_result == degraded_gcs:
            print("Refinement failed - using degraded frame as fallback")
            refined_local = degraded_path
        else:
            print("Refinement successful - downloading refined image...")
            # Wait a moment for GCS consistency
            time.sleep(5)
            
            # Download the refined image
            refined_local = os.path.join(tmp_dir, f"refined_frame_{session_id}.jpg")
            download_from_gcs(refined_gcs_result, refined_local)
            
            # Verify the downloaded file
            if os.path.exists(refined_local) and os.path.getsize(refined_local) > 0:
                print(f"Refined image downloaded successfully: {refined_local}")
            else:
                print("Refined image download failed - using degraded frame")
                refined_local = degraded_path
                refined_gcs_result = degraded_gcs
        
        return {
            "gcsUri": refined_gcs_result, 
            "mimeType": "image/jpeg", 
            "local_path": refined_local
        }
        
    except Exception as e:
        print(f"Refinement process failed: {e}")
        print("Using degraded frame as fallback...")
        
        # Fallback: upload the original degraded frame
        fallback_gcs_name = f"uploads/temp/fallback_{uuid.uuid4().hex}.jpg"
        upload_info = upload_to_gcs(degraded_path, bucket_name, fallback_gcs_name, "image/jpeg")
        
        return {
            "gcsUri": upload_info["gs_uri"],
            "mimeType": "image/jpeg", 
            "local_path": degraded_path
        }