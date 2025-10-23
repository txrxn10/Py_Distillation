from app import create_app
#from app.config import DevelopmentConfig # <-- CHANGE THIS LINE

# Create an app instance passing the config object to the factory
#app = create_app(config_object=DevelopmentConfig)
app = create_app()

if __name__ == "__main__":
    print("Starting Flask API server...")
    print("Server will be available at: http://localhost:5000")
    print("Health check endpoint: http://localhost:5000/api/health")
    print("Image generation endpoint: http://localhost:5000/api/image")
    print("CORS is configured for frontend at: http://localhost:3000")
    print("-" * 50)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
