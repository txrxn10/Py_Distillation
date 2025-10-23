#!/usr/bin/env python3
"""
Interactive script to help set up environment variables for Docker Compose
"""

import os
import sys

def setup_environment():
    """Interactive setup for environment variables"""
    
    print("Docker Compose Environment Setup")
    print("=" * 40)
    print("This script will help you create a .env file with the required variables.")
    print()
    
    # Check if .env already exists
    if os.path.exists('.env'):
        response = input(".env file already exists. Overwrite? (y/N): ").strip().lower()
        if response not in ['y', 'yes']:
            print("Setup cancelled.")
            return False
    
    # Collect required information
    print("Please provide the following information:")
    print()
    
    project_id = input("Google Cloud Project ID: ").strip()
    if not project_id:
        print("❌ Project ID is required")
        return False
    
    location = input("Google Cloud Location [us-central1]: ").strip() or "us-central1"
    
    image_bucket = input(f"Image Storage Bucket [{project_id}-assets]: ").strip() or f"{project_id}-assets"
    
    model_id = input("Gemini Model ID [gemini-2.5-flash]: ").strip() or "gemini-2.5-flash"
    
    imagen_model = input("Imagen Model ID [imagen-4.0-fast-generate-001]: ").strip() or "imagen-4.0-fast-generate-001"
    
    secret_key = input("Flask Secret Key [auto-generate]: ").strip()
    if not secret_key:
        import secrets
        secret_key = secrets.token_hex(32)
    
    # Create .env content
    env_content = f"""# Google Cloud Configuration
PROJECT_ID={project_id}
LOCATION={location}
IMAGE_BUCKET={image_bucket}

# Gemini Configuration
MODEL_ID={model_id}
MODEL_IMAGEN4_FAST={imagen_model}

# Optional: Custom model configuration
GEMINI_IMAGE_GEN_MODEL=gemini-2.0-flash-preview-image-generation
GEMINI_AUDIO_ANALYSIS_MODEL_ID=gemini-2.5-flash

# Storage Configuration
GENMEDIA_BUCKET={image_bucket}
VIDEO_BUCKET={image_bucket}/videos
IMAGEN_GENERATED_SUBFOLDER=generated_images
IMAGEN_EDITED_SUBFOLDER=edited_images

# Flask Configuration
FLASK_ENV=development
SECRET_KEY={secret_key}

# Optional: Firebase Configuration
GENMEDIA_FIREBASE_DB=(default)
GENMEDIA_COLLECTION_NAME=genmedia
SESSIONS_COLLECTION_NAME=sessions
"""
    
    # Write .env file
    try:
        with open('.env', 'w') as f:
            f.write(env_content)
        
        print("\n✅ .env file created successfully!")
        print("\nConfiguration summary:")
        print(f"  Project ID: {project_id}")
        print(f"  Location: {location}")
        print(f"  Image Bucket: {image_bucket}")
        print(f"  Gemini Model: {model_id}")
        print(f"  Imagen Model: {imagen_model}")
        
        print("\nNext steps:")
        print("1. Ensure your service-account.json file is in place")
        print("2. Run: python validate_service_account.py")
        print("3. Run: docker-compose up --build")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating .env file: {e}")
        return False

def show_current_config():
    """Show current environment configuration"""
    
    if not os.path.exists('.env'):
        print("No .env file found. Run setup first.")
        return
    
    print("Current Environment Configuration")
    print("=" * 35)
    
    try:
        with open('.env', 'r') as f:
            lines = f.readlines()
        
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#'):
                print(f"  {line}")
    
    except Exception as e:
        print(f"Error reading .env file: {e}")

def main():
    """Main function"""
    
    if len(sys.argv) > 1 and sys.argv[1] == 'show':
        show_current_config()
        return
    
    if len(sys.argv) > 1 and sys.argv[1] == '--help':
        print("Usage:")
        print("  python setup_env.py        # Interactive setup")
        print("  python setup_env.py show   # Show current config")
        return
    
    success = setup_environment()
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()