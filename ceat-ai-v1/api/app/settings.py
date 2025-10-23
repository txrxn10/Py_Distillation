import os
from dotenv import load_dotenv

# Load environment variables from a .env file for local development
load_dotenv()

class Config:
    """Base configuration settings."""
    SECRET_KEY = os.getenv('SECRET_KEY', 'a_default_secret_key_for_development')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt_secret_key_change_in_production')
    
    PROJECT_ID = os.getenv('PROJECT_ID')
    LOCATION = os.getenv('LOCATION', 'us-central1')
    BUCKET_NAME = os.getenv('IMAGE_BUCKET')
    GENMEDIA_COLLECTION_NAME = os.getenv('GENMEDIA_COLLECTION_NAME', 'genmedia')
    GENMEDIA_FIREBASE_DB = os.getenv('GENMEDIA_FIREBASE_DB', 'ceat-ai-db')

class DevelopmentConfig(Config):
    """Configuration for development."""
    DEBUG = True

class ProductionConfig(Config):
    """Configuration for production."""
    DEBUG = False

config_by_name = dict(
    dev=DevelopmentConfig,
    prod=ProductionConfig
)