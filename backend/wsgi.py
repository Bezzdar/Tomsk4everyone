from app import app
from admin_api import bp as admin_bp, ensure_bootstrap_admin


app.register_blueprint(admin_bp)
ensure_bootstrap_admin()
