#!/usr/bin/env python3
"""
Script to validate Google Cloud Service Account setup
"""

import os
import json
import sys

def validate_service_account():
    """Validate that the service account is properly configured"""
    
    print("Validating Google Cloud Service Account Setup")
    print("=" * 50)
    
    # Check if service account file exists
    service_account_path = "service-account.json"
    if not os.path.exists(service_account_path):
        print(f"❌ Service account file not found: {service_account_path}")
        print("Please ensure service-account.json is in the project root directory")
        return False
    
    print(f"✓ Service account file found: {service_account_path}")
    
    # Validate JSON format
    try:
        with open(service_account_path, 'r') as f:
            service_account = json.load(f)
        print("✓ Service account file is valid JSON")
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in service account file: {e}")
        return False
    except Exception as e:
        print(f"❌ Error reading service account file: {e}")
        return False
    
    # Check required fields
    required_fields = [
        'type', 'project_id', 'private_key_id', 'private_key',
        'client_email', 'client_id', 'auth_uri', 'token_uri'
    ]
    
    missing_fields = []
    for field in required_fields:
        if field not in service_account:
            missing_fields.append(field)
    
    if missing_fields:
        print(f"❌ Missing required fields: {', '.join(missing_fields)}")
        return False
    
    print("✓ All required fields present in service account")
    
    # Validate service account type
    if service_account.get('type') != 'service_account':
        print(f"❌ Invalid service account type: {service_account.get('type')}")
        print("Expected: 'service_account'")
        return False
    
    print("✓ Service account type is correct")
    
    # Display project info
    project_id = service_account.get('project_id')
    client_email = service_account.get('client_email')
    
    print(f"✓ Project ID: {project_id}")
    print(f"✓ Service Account Email: {client_email}")
    
    # Test authentication (optional - requires google-auth)
    try:
        from google.auth import default
        from google.oauth2 import service_account
        
        # Set environment variable for testing
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = service_account_path
        
        credentials, project = default()
        print(f"✓ Authentication successful")
        print(f"✓ Authenticated project: {project}")
        
        if project != project_id:
            print(f"⚠️  Warning: Authenticated project ({project}) differs from service account project ({project_id})")
        
    except ImportError:
        print("ℹ️  Skipping authentication test (google-auth not installed)")
    except Exception as e:
        print(f"⚠️  Authentication test failed: {e}")
        print("This might be normal if APIs are not enabled or credentials have limited scope")
    
    print("\n🎉 Service account validation completed!")
    print("\nNext steps:")
    print("1. Run: docker-compose up --build")
    print("2. Test API: curl http://localhost:5000/api/health")
    
    return True

def check_docker_compose():
    """Check if docker-compose.yml is properly configured"""
    
    print("\nValidating Docker Compose Configuration")
    print("=" * 40)
    
    if not os.path.exists('docker-compose.yml'):
        print("❌ docker-compose.yml not found")
        return False
    
    try:
        with open('docker-compose.yml', 'r') as f:
            content = f.read()
        
        # Check for service account volume mount
        if '/app/service-account.json' in content:
            print("✓ Service account volume mount configured")
        else:
            print("❌ Service account volume mount not found in docker-compose.yml")
            return False
        
        # Check for environment variable
        if 'GOOGLE_APPLICATION_CREDENTIALS' in content:
            print("✓ GOOGLE_APPLICATION_CREDENTIALS environment variable configured")
        else:
            print("❌ GOOGLE_APPLICATION_CREDENTIALS not found in docker-compose.yml")
            return False
        
        # Check for required environment variables
        required_env_vars = ['PROJECT_ID', 'LOCATION']
        for env_var in required_env_vars:
            if env_var in content:
                print(f"✓ {env_var} environment variable configured")
            else:
                print(f"❌ {env_var} not found in docker-compose.yml")
                return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error reading docker-compose.yml: {e}")
        return False

def check_env_file():
    """Check if .env file exists and has required variables"""
    
    print("\nValidating Environment Configuration")
    print("=" * 35)
    
    if not os.path.exists('.env'):
        print("⚠️  .env file not found")
        print("ℹ️  You can create one from .env.example:")
        print("   cp .env.example .env")
        print("   # Then edit .env with your values")
        return True  # Not required, just recommended
    
    try:
        with open('.env', 'r') as f:
            content = f.read()
        
        print("✓ .env file found")
        
        # Check for important variables
        important_vars = ['PROJECT_ID', 'LOCATION', 'IMAGE_BUCKET']
        for var in important_vars:
            if f"{var}=" in content:
                print(f"✓ {var} configured in .env")
            else:
                print(f"⚠️  {var} not found in .env file")
        
        return True
        
    except Exception as e:
        print(f"❌ Error reading .env file: {e}")
        return False

if __name__ == "__main__":
    success = validate_service_account()
    docker_success = check_docker_compose()
    env_success = check_env_file()
    
    if not (success and docker_success and env_success):
        print("\n❌ Validation failed. Please fix the issues above.")
        sys.exit(1)
    
    print("\n✅ All validations passed! Ready to run with Docker Compose.")