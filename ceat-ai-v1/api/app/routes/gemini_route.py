from flask import Blueprint, jsonify, request
from app.models.gemini_simple import rewrite_prompt_with_gemini
from app.utils.auth_decorator import require_auth

gemini_bp = Blueprint('gemini', __name__)

@gemini_bp.route('/rewrite', methods=['GET'])
@require_auth
def rewrite_get():
    return jsonify({"message": "This is the prompt rewrite endpoint"})

@gemini_bp.route('/rewrite', methods=['OPTIONS'])
def rewrite_options():
    """Handle preflight OPTIONS requests for CORS"""
    return '', 200

@gemini_bp.route('/rewrite', methods=['POST'])
@require_auth
def rewrite_prompt():
    """
    Rewrite a user prompt using Gemini AI to enhance it for better image generation.
    """
    try:
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided",
                "code": "INVALID_REQUEST"
            }), 400
        
        # Validate required fields
        if 'prompt' not in data or not data['prompt']:
            return jsonify({
                "success": False,
                "error": "Missing required field: prompt",
                "code": "INVALID_REQUEST"
            }), 400
        
        original_prompt = data['prompt'].strip()
        
        # Validate prompt length
        if len(original_prompt) == 0:
            return jsonify({
                "success": False,
                "error": "Prompt cannot be empty",
                "code": "INVALID_PROMPT"
            }), 400
        
        if len(original_prompt) > 2000:
            return jsonify({
                "success": False,
                "error": "Prompt is too long (maximum 2000 characters)",
                "code": "INVALID_PROMPT"
            }), 400
        
        # Use Gemini to rewrite the prompt
        try:
            enhanced_prompt = rewrite_prompt_with_gemini(original_prompt)
            
            if not enhanced_prompt or enhanced_prompt.strip() == "":
                # Fallback to original prompt if rewrite fails
                enhanced_prompt = original_prompt
                
            return jsonify({
                "success": True,
                "original_prompt": original_prompt,
                "enhanced_prompt": enhanced_prompt.strip(),
                "message": "Prompt successfully enhanced"
            })
            
        except Exception as gemini_error:
            print(f"Gemini rewrite error: {gemini_error}")
            # Return original prompt as fallback
            return jsonify({
                "success": True,
                "original_prompt": original_prompt,
                "enhanced_prompt": original_prompt,
                "message": "Prompt rewrite service unavailable, using original prompt",
                "warning": "AI enhancement temporarily unavailable"
            })
        
    except Exception as e:
        print(f"Rewrite endpoint error: {e}")
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}",
            "code": "INTERNAL_ERROR"
        }), 500