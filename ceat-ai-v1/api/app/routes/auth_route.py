from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt
from datetime import datetime, timedelta
import re

auth_bp = Blueprint('auth', __name__)

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Validate password strength"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    return True, "Password is valid"

@auth_bp.route('/auth/register', methods=['POST'])
def register():
    try:
        return jsonify({'error': f'Invalid Requests.'}), 400 
    
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'password', 'firstName', 'lastName']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        email = data['email'].lower().strip()
        password = data['password']
        first_name = data['firstName'].strip()
        last_name = data['lastName'].strip()
        
        # Validate email format
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password strength
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({'error': message}), 400
        
        # Check if user already exists
        db = current_app.firestore_client
        if not db:
            return jsonify({'error': 'Database not available'}), 503
        users_ref = db.collection('users')
        existing_user = users_ref.where('email', '==', email).limit(1).get()
        
        if len(list(existing_user)) > 0:
            return jsonify({'error': 'User already exists with this email'}), 409
        
        # Hash password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Create user document
        user_data = {
            'email': email,
            'password_hash': password_hash.decode('utf-8'),
            'firstName': first_name,
            'lastName': last_name,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
            'isActive': True,
            'role': 'user'
        }
        
        # Add user to Firestore
        doc_ref = users_ref.add(user_data)
        user_id = doc_ref[1].id
        
        # Create access token
        access_token = create_access_token(
            identity=user_id,
            expires_delta=timedelta(days=7)
        )
        
        return jsonify({
            'message': 'User registered successfully',
            'access_token': access_token,
            'user': {
                'id': user_id,
                'email': email,
                'firstName': first_name,
                'lastName': last_name,
                'role': 'user'
            }
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"Registration error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400
        
        email = data['email'].lower().strip()
        password = data['password']
        
        # Find user by email
        db = current_app.firestore_client
        if not db:
            return jsonify({'error': 'Database not available'}), 503
        users_ref = db.collection('users')
        user_docs = users_ref.where('email', '==', email).limit(1).get()
        
        if len(list(user_docs)) == 0:
            return jsonify({'error': 'Invalid email or password'}), 401
        
        user_doc = list(user_docs)[0]
        user_data = user_doc.to_dict()
        user_id = user_doc.id
        
        # Check if user is active
        if not user_data.get('isActive', True):
            return jsonify({'error': 'Account is deactivated'}), 401
        
        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), user_data['password_hash'].encode('utf-8')):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Update last login
        users_ref.document(user_id).update({
            'lastLogin': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        })
        
        # Create access token
        access_token = create_access_token(
            identity=user_id,
            expires_delta=timedelta(days=7)
        )
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': {
                'id': user_id,
                'email': user_data['email'],
                'firstName': user_data['firstName'],
                'lastName': user_data['lastName'],
                'role': user_data.get('role', 'user')
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/auth/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        
        # Get user from Firestore
        db = current_app.firestore_client
        user_doc = db.collection('users').document(user_id).get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        
        return jsonify({
            'user': {
                'id': user_id,
                'email': user_data['email'],
                'firstName': user_data['firstName'],
                'lastName': user_data['lastName'],
                'role': user_data.get('role', 'user'),
                'createdAt': user_data['createdAt'].isoformat() if user_data.get('createdAt') else None,
                'lastLogin': user_data['lastLogin'].isoformat() if user_data.get('lastLogin') else None
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Profile error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/auth/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Get current user data
        db = current_app.firestore_client
        user_doc = db.collection('users').document(user_id).get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        # Prepare update data
        update_data = {
            'updatedAt': datetime.utcnow()
        }
        
        # Update allowed fields
        if data.get('firstName'):
            update_data['firstName'] = data['firstName'].strip()
        if data.get('lastName'):
            update_data['lastName'] = data['lastName'].strip()
        
        # Update user document
        db.collection('users').document(user_id).update(update_data)
        
        # Get updated user data
        updated_doc = db.collection('users').document(user_id).get()
        updated_data = updated_doc.to_dict()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'id': user_id,
                'email': updated_data['email'],
                'firstName': updated_data['firstName'],
                'lastName': updated_data['lastName'],
                'role': updated_data.get('role', 'user')
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Profile update error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/auth/change-password', methods=['POST'])
@jwt_required()
def change_password():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        if not data.get('currentPassword') or not data.get('newPassword'):
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        current_password = data['currentPassword']
        new_password = data['newPassword']
        
        # Validate new password strength
        is_valid, message = validate_password(new_password)
        if not is_valid:
            return jsonify({'error': message}), 400
        
        # Get user from Firestore
        db = current_app.firestore_client
        user_doc = db.collection('users').document(user_id).get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user_doc.to_dict()
        
        # Verify current password
        if not bcrypt.checkpw(current_password.encode('utf-8'), user_data['password_hash'].encode('utf-8')):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Hash new password
        new_password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        
        # Update password
        db.collection('users').document(user_id).update({
            'password_hash': new_password_hash.decode('utf-8'),
            'updatedAt': datetime.utcnow()
        })
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        current_app.logger.error(f"Password change error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500