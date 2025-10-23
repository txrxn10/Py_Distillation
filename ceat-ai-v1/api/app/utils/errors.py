from flask import jsonify

def register_error_handlers(app):
    @app.errorhandler(400)
    @app.errorhandler(401)
    @app.errorhandler(404)
    @app.errorhandler(429)
    @app.errorhandler(500)
    def handle_error(err):
        code = err.code if hasattr(err, "code") else 500
        return jsonify({"error": str(err), "status": code}), code
