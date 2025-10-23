from flask import request, current_app, abort

def require_api_key():
    header_key = request.headers.get("x-api-key")
    if not header_key or header_key != current_app.config["API_KEY"]:
        abort(401, description="Unauthorized")
