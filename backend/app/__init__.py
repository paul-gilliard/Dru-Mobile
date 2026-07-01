import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

db = SQLAlchemy()

basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


def create_app():
    app = Flask(__name__)

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dru-mobile-dev-secret-key-change-me')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    # Base 100% locale, dédiée au dev de l'app mobile. Ne JAMAIS pointer ceci
    # vers une base de production (Supabase / Railway) de l'appli web.
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL', f"sqlite:///{os.path.join(basedir, 'dev.db')}"
    )

    db.init_app(app)
    CORS(app)  # dev only: ouvert pour simplifier les tests depuis Expo (LAN / simulateur)

    with app.app_context():
        db.create_all()

    from app.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.get('/health')
    def health():
        return {'status': 'ok', 'service': 'dru-mobile-backend'}

    return app
