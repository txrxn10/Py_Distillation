from flask import Blueprint, jsonify, request
import traceback
from typing import List, Optional

from app.common.metadata import get_media_for_page, MediaItem
from app.common.storage import generate_signed_urls,generate_signed_url
from app.utils.auth_decorator import require_auth

history_bp = Blueprint('history', __name__)

def convert_media_item_to_dict(media_item: MediaItem) -> dict:
    """Convert MediaItem to dictionary format expected by frontend"""
    
    # Determine media type based on mime_type
    media_type = "image"  # default
    if media_item.raw_data.get("mime_type"):
        mime_type = media_item.raw_data["mime_type"]
        if mime_type.startswith("video/"):
            media_type = "video"
        # All other types (audio, vto, etc.) will be treated as images
        print(f"Media item {media_item.id}: mime_type='{mime_type}' -> type='{media_type}'")
    
    # Get the primary media URL
    thumbnail_url = None
    media_urls = []
    
    # Handle single media file (gcsuri)
    if media_item.gcsuri:
        media_urls.append(media_item.gcsuri)
        thumbnail_url = media_item.gcsuri
    
    # Handle multiple media files (gcs_uris)
    if media_item.gcs_uris:
        media_urls.extend(media_item.gcs_uris)
        if not thumbnail_url:
            thumbnail_url = media_item.gcs_uris[0] if media_item.gcs_uris else None
    
    # --- NEW: actual thumbnail image (preview) ---
    preview_image = None
    if media_item.raw_data.get("thumbnail_uri"):
        preview_image_gs_uri = media_item.raw_data.get("thumbnail_uri")

        try:
            preview_image = generate_signed_url(preview_image_gs_uri)
        except Exception as e:
            print(f"Error signing preview image {preview_image_gs_uri}: {e}")
            preview_image = preview_image_gs_uri  # fallback
    # Generate signed URLs for the media
    signed_urls = []
    if media_urls:
        try:
            signed_urls = generate_signed_urls(media_urls)
        except Exception as e:
            print(f"Error generating signed URLs: {e}")
            signed_urls = media_urls  # Fallback to original URLs
    
    # Get thumbnail (first media item)
    thumbnail = signed_urls[0] if signed_urls else None
    
    # Create title from prompt or use default
    title = media_item.prompt[:50] + "..." if media_item.prompt and len(media_item.prompt) > 50 else media_item.prompt or "Untitled"
    
    # Build settings object
    settings = {}
    if media_item.aspect:
        settings["aspectRatio"] = media_item.aspect
    if media_item.resolution:
        settings["resolution"] = media_item.resolution
    if media_item.duration:
        settings["duration"] = f"{media_item.duration}s"
    
    # Add model info if available
    if media_item.raw_data.get("model"):
        settings["model"] = media_item.raw_data["model"]
    
    return {
        "id": media_item.id,
        "type": media_type,
        "title": title,
        "prompt": media_item.prompt or "",
        "thumbnail": thumbnail,
        "preview_image": preview_image,
        "createdAt": media_item.timestamp,
        "settings": settings,
        "mediaUrls": signed_urls,
        "hasError": bool(media_item.error_message),
        "errorMessage": media_item.error_message,
        "generationTime": media_item.generation_time,
        "model": media_item.raw_data.get("model"),
        "mimeType": media_item.raw_data.get("mime_type")
    }

@history_bp.route('/history', methods=['GET'])
@require_auth
def get_history():
    """Get paginated history of media items with filtering support"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 20)  # Max 20 items per page
        
        # Filter parameters
        type_filter = request.args.get('type', 'all')  # all, images, videos
        error_filter = request.args.get('error_filter', 'all')  # all, no_errors, only_errors
        sort_by = request.args.get('sort_by', 'newest')  # newest, oldest, name
        search_query = request.args.get('search', '')
        user_email = request.args.get('user_email')  # Optional user filter
        
        print(f"History request - Page: {page}, Per page: {per_page}, Type: {type_filter}, Error filter: {error_filter}")
        
        # Since we simplified to only images/videos, but the backend still uses detailed filtering,
        # we need to get all items and filter them in post-processing
        if type_filter == 'all':
            type_filters = None  # Get everything
        elif type_filter == 'images':
            type_filters = None  # Get everything, filter in post-processing
        elif type_filter == 'videos':
            type_filters = ['videos']  # Only get videos
        else:
            type_filters = None  # Default to everything
        
        print(f"Using type_filters: {type_filters} (will post-process for images)")
        
        # Get media items from Firestore
        media_items = get_media_for_page(
            page=page,
            media_per_page=per_page,
            type_filters=type_filters,
            error_filter=error_filter,
            sort_by_timestamp=True,  # Always sort by timestamp for now
            filter_by_user_email=user_email
        )
        
        print(f"Retrieved {len(media_items)} media items from Firestore")
        
        # Convert to frontend format
        history_items = []
        processed_count = 0
        for media_item in media_items:
            processed_count += 1
            try:
                item_dict = convert_media_item_to_dict(media_item)
                
                # Apply type filter with our simplified logic
                if type_filter == 'all':
                    # Show everything
                    history_items.append(item_dict)
                elif type_filter == 'images':
                    # Show everything that's not video (images, audio, vto, etc.)
                    if item_dict["type"] != "video":
                        # Force type to be "image" for display consistency
                        item_dict["type"] = "image"
                        history_items.append(item_dict)
                elif type_filter == 'videos':
                    # Show only videos
                    if item_dict["type"] == "video":
                        history_items.append(item_dict)
                
            except Exception as e:
                print(f"Error converting media item {media_item.id}: {e}")
                continue
        
        print(f"Processed {processed_count} items, filtered to {len(history_items)} items for type_filter='{type_filter}'")
        
        # Apply search filter if provided
        if search_query:
            search_lower = search_query.lower()
            history_items = [
                item for item in history_items
                if (search_lower in item["title"].lower() or 
                    search_lower in item["prompt"].lower())
            ]
        
        # Apply sorting (frontend will also sort, but we can do initial sort here)
        if sort_by == 'oldest':
            history_items.sort(key=lambda x: x["createdAt"] or "")
        elif sort_by == 'name':
            history_items.sort(key=lambda x: x["title"].lower())
        # 'newest' is default from Firestore query
        
        print(f"Returning {len(history_items)} filtered history items")
        
        return jsonify({
            'success': True,
            'data': {
                'items': history_items,
                'page': page,
                'per_page': per_page,
                'total_items': len(history_items),  # Note: This is just current page count
                'has_more': len(history_items) == per_page  # Simple check if there might be more
            }
        })
        
    except ValueError as ve:
        print(f"Validation error in get_history: {ve}")
        return jsonify({
            'success': False,
            'error': f'Invalid request parameters: {str(ve)}'
        }), 400
        
    except Exception as e:
        print(f"Error fetching history: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to fetch history: {str(e)}'
        }), 500

@history_bp.route('/history/stats', methods=['GET'])
@require_auth
def get_history_stats():
    """Get statistics about the user's media history"""
    try:
        user_email = request.args.get('user_email')
        
        # Get a larger sample to calculate stats
        media_items = get_media_for_page(
            page=1,
            media_per_page=1000,  # Get more items for stats
            type_filters=None,
            error_filter='all',
            sort_by_timestamp=True,
            filter_by_user_email=user_email
        )
        
        # Calculate statistics
        total_items = len(media_items)
        image_count = 0
        video_count = 0
        error_count = 0
        
        for item in media_items:
            if item.error_message:
                error_count += 1
            
            mime_type = item.raw_data.get("mime_type", "")
            if mime_type.startswith("video/"):
                video_count += 1
            else:
                # All other types (image, audio, vto, etc.) are counted as images
                image_count += 1
        
        return jsonify({
            'success': True,
            'data': {
                'total_items': total_items,
                'image_count': image_count,
                'video_count': video_count,
                'error_count': error_count,
                'success_rate': round((total_items - error_count) / total_items * 100, 1) if total_items > 0 else 0
            }
        })
        
    except Exception as e:
        print(f"Error fetching history stats: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to fetch history statistics: {str(e)}'
        }), 500

@history_bp.route('/history/<item_id>', methods=['GET'])
@require_auth
def get_history_item(item_id: str):
    """Get a specific history item by ID"""
    try:
        from app.common.metadata import get_media_item_by_id
        
        media_item = get_media_item_by_id(item_id)
        
        if not media_item:
            return jsonify({
                'success': False,
                'error': 'Item not found'
            }), 404
        
        item_dict = convert_media_item_to_dict(media_item)
        
        return jsonify({
            'success': True,
            'data': item_dict
        })
        
    except Exception as e:
        print(f"Error fetching history item {item_id}: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to fetch history item: {str(e)}'
        }), 500

@history_bp.route('/history/<item_id>/download', methods=['GET'])
@require_auth
def download_history_item(item_id: str):
    """Get download URL for a specific history item"""
    try:
        from app.common.metadata import get_media_item_by_id
        from flask import send_file, Response
        import requests
        import io
        import mimetypes
        
        # Get the media item
        media_item = get_media_item_by_id(item_id)
        
        if not media_item:
            return jsonify({
                'success': False,
                'error': 'Item not found'
            }), 404
        
        # Get the best available media URL
        download_url = None
        
        # Priority: gcs_uris[0] > gcsuri > fallback
        if media_item.gcs_uris and len(media_item.gcs_uris) > 0:
            download_url = media_item.gcs_uris[0]
        elif media_item.gcsuri:
            download_url = media_item.gcsuri
        
        if not download_url:
            return jsonify({
                'success': False,
                'error': 'No downloadable media found for this item'
            }), 404
        
        # Generate signed URL for download
        try:
            signed_urls = generate_signed_urls([download_url])
            if not signed_urls:
                raise Exception("Failed to generate signed URL")
            signed_url = signed_urls[0]
        except Exception as e:
            print(f"Error generating signed URL: {e}")
            return jsonify({
                'success': False,
                'error': 'Failed to generate download URL'
            }), 500
        
        # Fetch the media content
        try:
            response = requests.get(signed_url, timeout=30)
            response.raise_for_status()
        except Exception as e:
            print(f"Error fetching media content: {e}")
            return jsonify({
                'success': False,
                'error': 'Failed to fetch media content'
            }), 500
        
        # Determine content type and file extension
        content_type = response.headers.get('content-type', 'application/octet-stream')
        
        # Determine file extension
        file_extension = ""
        if content_type.startswith('image/'):
            if 'jpeg' in content_type or 'jpg' in content_type:
                file_extension = ".jpg"
            elif 'png' in content_type:
                file_extension = ".png"
            elif 'webp' in content_type:
                file_extension = ".webp"
            elif 'gif' in content_type:
                file_extension = ".gif"
            else:
                file_extension = ".jpg"  # Default for images
        elif content_type.startswith('video/'):
            if 'mp4' in content_type:
                file_extension = ".mp4"
            elif 'webm' in content_type:
                file_extension = ".webm"
            elif 'ogg' in content_type:
                file_extension = ".ogg"
            else:
                file_extension = ".mp4"  # Default for videos
        else:
            # Try to guess from URL
            url_lower = download_url.lower()
            if '.jpg' in url_lower or '.jpeg' in url_lower:
                file_extension = ".jpg"
            elif '.png' in url_lower:
                file_extension = ".png"
            elif '.webp' in url_lower:
                file_extension = ".webp"
            elif '.gif' in url_lower:
                file_extension = ".gif"
            elif '.mp4' in url_lower:
                file_extension = ".mp4"
            elif '.webm' in url_lower:
                file_extension = ".webm"
            elif '.ogg' in url_lower:
                file_extension = ".ogg"
            else:
                # Default based on mime type from metadata
                mime_type = media_item.raw_data.get("mime_type", "")
                if mime_type.startswith("video/"):
                    file_extension = ".mp4"
                else:
                    file_extension = ".jpg"
        
        # Create safe filename
        prompt = media_item.prompt or "untitled"
        safe_title = ''.join(c for c in prompt if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_title = safe_title.replace(' ', '_')[:50]  # Limit length and replace spaces
        
        filename = f"{safe_title}_{item_id}{file_extension}"
        
        # Create file-like object from response content
        file_obj = io.BytesIO(response.content)
        
        # Return the file as download
        return send_file(
            file_obj,
            as_attachment=True,
            download_name=filename,
            mimetype=content_type
        )
        
    except Exception as e:
        print(f"Error downloading history item {item_id}: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to download media: {str(e)}'
        }), 500

@history_bp.route('/history/<item_id>', methods=['DELETE'])
@require_auth
def delete_history_item(item_id: str):
    """Delete a specific history item"""
    try:
        from app.config.default import Default
        from app.config.firebase_config import FirebaseClient
        
        config = Default()
        db = FirebaseClient(database_id=config.GENMEDIA_FIREBASE_DB).get_client()
        
        # Check if item exists
        doc_ref = db.collection(config.GENMEDIA_COLLECTION_NAME).document(item_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return jsonify({
                'success': False,
                'error': 'Item not found'
            }), 404
        
        # Delete the document
        doc_ref.delete()
        
        print(f"Deleted history item: {item_id}")
        
        return jsonify({
            'success': True,
            'message': 'Item deleted successfully'
        })
        
    except Exception as e:
        print(f"Error deleting history item {item_id}: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to delete history item: {str(e)}'
        }), 500