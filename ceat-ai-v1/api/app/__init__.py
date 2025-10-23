from app.settings import Config
from flask import Flask
from google.cloud import storage
from google.cloud import firestore
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from app.routes import get_blueprints
from .clients.vertex_ai_client import VertexAIClient
from app.config.firebase_config import FirebaseClient

def create_app(config_class=Config):
    app = Flask(__name__)
    
    app.config.from_object(config_class)
    
    # JWT Configuration
    app.config['JWT_SECRET_KEY'] = app.config.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False  # Tokens don't expire automatically
    
    try:
        jwt = JWTManager(app)
    except Exception as e:
        print(f"JWT initialization error: {e}")
        # Continue without JWT for basic health checks
    
    # Configure CORS to allow requests from the frontend
    CORS(app, 
         origins=[
             "http://localhost:3000", 
             "http://127.0.0.1:3000",
             "http://localhost:3001",
             "http://127.0.0.1:3001"
         ],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         allow_headers=[
             "Content-Type", 
             "Authorization", 
             "Accept",
             "Origin",
             "X-Requested-With"
         ],
         supports_credentials=True)

    with app.app_context():
        try:
            app.storage_client = storage.Client(project=app.config['PROJECT_ID'])
            app.vertex_client = VertexAIClient(app.config)
            app.firestore_client = FirebaseClient(database_id=app.config['GENMEDIA_FIREBASE_DB']).get_client()
        except Exception as e:
            print(f"Client initialization error: {e}")
            # Set None clients for basic functionality
            app.storage_client = None
            app.vertex_client = None
            app.firestore_client = None

    for bp in get_blueprints():
        app.register_blueprint(bp, url_prefix="/api")
        
    return app

# app = create_app()