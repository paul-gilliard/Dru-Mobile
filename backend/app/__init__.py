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
    # Shared production MySQL when DATABASE_URL is set (Railway / public proxy).
    # Local default remains SQLite for offline dev.
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL', f"sqlite:///{os.path.join(basedir, 'dev.db')}"
    )

    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}, r"/health": {"origins": "*"}})

    with app.app_context():
        db.create_all()
        try:
            from sqlalchemy import inspect, text
            insp = inspect(db.engine)
            if 'user' in insp.get_table_names():
                cols = {c['name'] for c in insp.get_columns('user')}
                if 'display_name' not in cols:
                    db.session.execute(text("ALTER TABLE `user` ADD COLUMN display_name VARCHAR(128) NULL"))
                db.session.execute(text("ALTER TABLE `user` MODIFY COLUMN password_hash VARCHAR(255) NOT NULL"))
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"compat alter skipped: {e}")

    from app.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.get('/health')
    def health():
        return {'status': 'ok', 'service': 'dru-mobile-backend'}

    return app
