from flask import Blueprint, jsonify, request
import os
import traceback
from app.utils.auth_decorator import require_auth

brand_guidelines_bp = Blueprint('brand_guidelines', __name__)

@brand_guidelines_bp.route('/brand-guidelines/test', methods=['GET'])
@require_auth
def test_route():
    """Test endpoint to verify the route is working"""
    try:
        image_path = get_brand_guidelines_path('image')
        video_path = get_brand_guidelines_path('video')
        
        return jsonify({
            'success': True,
            'message': 'Brand guidelines route is working',
            'debug_info': {
                'current_file': __file__,
                'working_directory': os.getcwd(),
                'image_path': image_path,
                'video_path': video_path,
                'image_exists': os.path.exists(image_path),
                'video_exists': os.path.exists(video_path)
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'debug_info': {
                'current_file': __file__,
                'working_directory': os.getcwd()
            }
        })

def get_brand_guidelines_path(file_type: str) -> str:
    """Get the path to brand guidelines file with robust path resolution"""
    if file_type not in ['image', 'video']:
        raise ValueError(f"Invalid file type: {file_type}")
    
    filename = f'brand-guidelines-{file_type}.txt'
    
    # Try multiple path resolution strategies
    possible_paths = []
    
    # Strategy 1: Relative to this file (api/app/routes/brand_guidelines_route.py)
    current_file = os.path.abspath(__file__)
    api_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
    possible_paths.append(os.path.join(api_dir, filename))
    
    # Strategy 2: Relative to current working directory
    possible_paths.append(os.path.join(os.getcwd(), 'api', filename))
    
    # Strategy 3: Just in api subdirectory of cwd
    possible_paths.append(os.path.join('api', filename))
    
    # Strategy 4: Directly in cwd (in case we're running from api directory)
    possible_paths.append(os.path.join(os.getcwd(), filename))
    
    # Strategy 5: Look for api directory in parent directories
    current_dir = os.path.dirname(current_file)
    for _ in range(5):  # Look up to 5 levels up
        parent_api = os.path.join(current_dir, 'api', filename)
        if parent_api not in possible_paths:
            possible_paths.append(parent_api)
        current_dir = os.path.dirname(current_dir)
    
    print(f"Looking for {file_type} guidelines file: {filename}")
    print(f"Trying paths:")
    
    for i, path in enumerate(possible_paths, 1):
        abs_path = os.path.abspath(path)
        exists = os.path.exists(abs_path)
        print(f"  {i}. {abs_path} - exists: {exists}")
        
        if exists:
            print(f"✅ Found file at: {abs_path}")
            return abs_path
    
    # If no file found, return the first path (most likely correct one)
    fallback_path = possible_paths[0]
    print(f"❌ No file found, using fallback: {fallback_path}")
    return fallback_path

@brand_guidelines_bp.route('/brand-guidelines', methods=['GET'])
@require_auth
def get_brand_guidelines():
    """Get both image and video brand guidelines"""
    try:
        image_path = get_brand_guidelines_path('image')
        video_path = get_brand_guidelines_path('video')
        
        # Debug logging
        print(f"Looking for image guidelines at: {image_path}")
        print(f"Looking for video guidelines at: {video_path}")
        print(f"Image file exists: {os.path.exists(image_path)}")
        print(f"Video file exists: {os.path.exists(video_path)}")
        
        image_content = ""
        video_content = ""
        
        # Read image guidelines
        if os.path.exists(image_path):
            try:
                with open(image_path, 'r', encoding='utf-8') as f:
                    image_content = f.read()
                print(f"Image content length: {len(image_content)}")
            except Exception as e:
                print(f"Error reading image file: {e}")
                image_content = ""
        else:
            print(f"Image file not found at: {image_path}")
        
        # Read video guidelines
        if os.path.exists(video_path):
            try:
                with open(video_path, 'r', encoding='utf-8') as f:
                    video_content = f.read()
                print(f"Video content length: {len(video_content)}")
            except Exception as e:
                print(f"Error reading video file: {e}")
                video_content = ""
        else:
            print(f"Video file not found at: {video_path}")
        
        return jsonify({
            'success': True,
            'data': {
                'image_guidelines': image_content,
                'video_guidelines': video_content
            }
        })
        
    except Exception as e:
        print(f"Error reading brand guidelines: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to read brand guidelines: {str(e)}'
        }), 500

@brand_guidelines_bp.route('/brand-guidelines', methods=['POST'])
@require_auth
def update_brand_guidelines():
    """Update brand guidelines files"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        image_guidelines = data.get('image_guidelines')
        video_guidelines = data.get('video_guidelines')
        
        if image_guidelines is None or video_guidelines is None:
            return jsonify({
                'success': False,
                'error': 'Both image_guidelines and video_guidelines are required'
            }), 400
        
        # Update image guidelines
        image_path = get_brand_guidelines_path('image')
        print(f"Writing image guidelines to: {image_path}")
        try:
            with open(image_path, 'w', encoding='utf-8') as f:
                f.write(image_guidelines)
            print(f"Successfully wrote {len(image_guidelines)} characters to image file")
        except Exception as e:
            print(f"Error writing image file: {e}")
            raise
        
        # Update video guidelines
        video_path = get_brand_guidelines_path('video')
        print(f"Writing video guidelines to: {video_path}")
        try:
            with open(video_path, 'w', encoding='utf-8') as f:
                f.write(video_guidelines)
            print(f"Successfully wrote {len(video_guidelines)} characters to video file")
        except Exception as e:
            print(f"Error writing video file: {e}")
            raise
        
        return jsonify({
            'success': True,
            'message': 'Brand guidelines updated successfully'
        })
        
    except Exception as e:
        print(f"Error updating brand guidelines: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to update brand guidelines: {str(e)}'
        }), 500

@brand_guidelines_bp.route('/brand-guidelines/<file_type>', methods=['GET'])
@require_auth
def get_specific_brand_guidelines(file_type: str):
    """Get specific brand guidelines (image or video)"""
    try:
        if file_type not in ['image', 'video']:
            return jsonify({
                'success': False,
                'error': 'Invalid file type. Must be "image" or "video"'
            }), 400
        
        file_path = get_brand_guidelines_path(file_type)
        print(f"Looking for {file_type} guidelines at: {file_path}")
        print(f"File exists: {os.path.exists(file_path)}")
        
        content = ""
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                print(f"{file_type} content length: {len(content)}")
            except Exception as e:
                print(f"Error reading {file_type} file: {e}")
        else:
            print(f"{file_type} file not found at: {file_path}")
        
        return jsonify({
            'success': True,
            'data': {
                f'{file_type}_guidelines': content
            }
        })
        
    except Exception as e:
        print(f"Error reading {file_type} brand guidelines: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to read {file_type} brand guidelines: {str(e)}'
        }), 500

@brand_guidelines_bp.route('/brand-guidelines/<file_type>', methods=['POST'])
@require_auth
def update_specific_brand_guidelines(file_type: str):
    """Update specific brand guidelines (image or video)"""
    try:
        if file_type not in ['image', 'video']:
            return jsonify({
                'success': False,
                'error': 'Invalid file type. Must be "image" or "video"'
            }), 400
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        content = data.get('content')
        
        if content is None:
            return jsonify({
                'success': False,
                'error': 'Content is required'
            }), 400
        
        # Update the specific guidelines file
        file_path = get_brand_guidelines_path(file_type)
        print(f"Writing {file_type} guidelines to: {file_path}")
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Successfully wrote {len(content)} characters to {file_type} file")
        except Exception as e:
            print(f"Error writing {file_type} file: {e}")
            raise
        
        return jsonify({
            'success': True,
            'message': f'{file_type.title()} brand guidelines updated successfully'
        })
        
    except Exception as e:
        print(f"Error updating {file_type} brand guidelines: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Failed to update {file_type} brand guidelines: {str(e)}'
        }), 500