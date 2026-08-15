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
        from app import models as _models  # noqa: F401 — register tables before create_all
        db.create_all()
        try:
            from sqlalchemy import inspect, text
            insp = inspect(db.engine)
            uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
            is_mysql = uri.startswith('mysql')
            if 'user' in insp.get_table_names():
                cols = {c['name'] for c in insp.get_columns('user')}
                if 'display_name' not in cols:
                    db.session.execute(text("ALTER TABLE user ADD COLUMN display_name VARCHAR(128) NULL"))
                if is_mysql:
                    db.session.execute(text("ALTER TABLE `user` MODIFY COLUMN password_hash VARCHAR(255) NOT NULL"))
                db.session.commit()
            if 'program' in insp.get_table_names():
                pcols = {c['name'] for c in insp.get_columns('program')}
                if 'is_active' not in pcols:
                    db.session.execute(text(
                        "ALTER TABLE program ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 0"
                    ))
                    db.session.commit()
            if 'meal_plan' in insp.get_table_names():
                mpcols = {c['name'] for c in insp.get_columns('meal_plan')}
                if 'is_active' not in mpcols:
                    db.session.execute(text(
                        "ALTER TABLE meal_plan ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 0"
                    ))
                    db.session.commit()
                from app.models import MealPlan
                from sqlalchemy import distinct
                athlete_ids_with_plans = [row[0] for row in db.session.query(distinct(MealPlan.athlete_id)).all()]
                for aid in athlete_ids_with_plans:
                    if not MealPlan.query.filter_by(athlete_id=aid, is_active=True).first():
                        latest = MealPlan.query.filter_by(athlete_id=aid).order_by(MealPlan.created_at.desc()).first()
                        if latest:
                            latest.is_active = True
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"compat alter skipped: {e}")

        # Roles / coach-athlete / subscription
        try:
            from sqlalchemy import inspect, text
            from datetime import datetime
            insp = inspect(db.engine)
            if 'user' in insp.get_table_names():
                cols = {c['name'] for c in insp.get_columns('user')}
                if 'coach_id' not in cols:
                    db.session.execute(text("ALTER TABLE user ADD COLUMN coach_id INTEGER NULL"))
                if 'coach_associated_at' not in cols:
                    db.session.execute(text("ALTER TABLE user ADD COLUMN coach_associated_at DATETIME NULL"))
                if 'subscription_tier' not in cols:
                    db.session.execute(text("ALTER TABLE user ADD COLUMN subscription_tier INTEGER NOT NULL DEFAULT 0"))
                if 'email' not in cols:
                    db.session.execute(text("ALTER TABLE user ADD COLUMN email VARCHAR(255) NULL"))
                db.session.commit()

            from app.models import User
            admin_legacy = User.query.filter_by(username='admin').first()
            if admin_legacy:
                if admin_legacy.role != 'coach':
                    admin_legacy.role = 'coach'
                if int(admin_legacy.subscription_tier or 0) == 0:
                    admin_legacy.subscription_tier = 3
                db.session.commit()
                orphans = User.query.filter_by(role='athlete', coach_id=None).all()
                for a in orphans:
                    a.coach_id = admin_legacy.id
                    a.coach_associated_at = a.coach_associated_at or datetime.utcnow()
                if orphans:
                    db.session.commit()

            paul_email = 'paul.gilliard.8@gmail.com'
            paul = (
                User.query.filter(db.func.lower(User.email) == paul_email).first()
                or User.query.filter(User.username.ilike('paul%')).first()
                or User.query.filter(User.display_name.ilike('%paul%')).first()
            )
            if paul and not User.query.filter(db.func.lower(User.email) == paul_email, User.id != paul.id).first():
                paul.email = paul_email
                db.session.commit()

            platform_pw = os.environ.get('SUPERADMIN_PASSWORD', '14785commePAUL!')
            platform_admin = (
                User.query.filter_by(username='Superadmin').first()
                or User.query.filter(db.func.lower(User.username) == 'superadmin').first()
            )
            if platform_admin:
                platform_admin.username = 'Superadmin'
                platform_admin.display_name = 'Superadmin'
                platform_admin.role = 'admin'
                platform_admin.set_password(platform_pw)
                db.session.commit()
            else:
                sa = User(username='Superadmin', role='admin', display_name='Superadmin', subscription_tier=0)
                sa.set_password(platform_pw)
                db.session.add(sa)
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"roles migrate skipped: {e}")

    from app.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.get('/health')
    def health():
        return {'status': 'ok', 'service': 'dru-mobile-backend'}

    return app
