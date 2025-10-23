def get_blueprints():
    from .image_route import image_bp
    from .video_route import video_bp
    from .gemini_route import gemini_bp
    from .brand_guidelines_route import brand_guidelines_bp
    from .history_route import history_bp
    from .prompt_route import prompts_bp
    from .bucket_route import bucket_bp
    from .upload_routes import upload_bp
    from .auth_route import auth_bp
    from .health_route import health_bp
    return [image_bp, video_bp, gemini_bp, brand_guidelines_bp, history_bp,prompts_bp,bucket_bp,upload_bp,auth_bp,health_bp]
