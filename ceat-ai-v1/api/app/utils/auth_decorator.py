from functools import wraps
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

def require_auth(f):
    """Decorator to require authentication for API endpoints"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Verify JWT token is present and valid
            verify_jwt_in_request()
            
            # Get user ID from token
            user_id = get_jwt_identity()
            if not user_id:
                return jsonify({'error': 'Invalid token'}), 401
            
            # Check if user exists in database
            db = current_app.firestore_client
            if db:
                user_doc = db.collection('users').document(user_id).get()
                if not user_doc.exists:
                    return jsonify({'error': 'User not found'}), 401
                
                user_data = user_doc.to_dict()
                if not user_data.get('isActive', True):
                    return jsonify({'error': 'Account is deactivated'}), 401
            
            return f(*args, **kwargs)
            
        except Exception as e:
            current_app.logger.error(f"Authentication error: {str(e)}")
            return jsonify({'error': 'Authentication required'}), 401
    
    return decorated_function