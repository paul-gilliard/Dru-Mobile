from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from app import db

MUSCLE_GROUPS = [
    'ABDOS', 'BICEPS', 'DOS', 'EPAULES', 'ISCHIO', 'LEGS', 'MOLLET', 'PEC', 'QUAD'
]


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(16), nullable=False, default='athlete')  # 'coach' ou 'athlete'
    display_name = db.Column(db.String(128), nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'display_name': self.display_name or self.username,
        }

    def __repr__(self):
        return f'<User {self.username} ({self.role})>'


class Availability(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, index=True)
    location = db.Column(db.String(128), nullable=False, default='salle principale')
    timeslot = db.Column(db.String(16), nullable=False, default='morning')  # morning / afternoon / day
    available = db.Column(db.Boolean, nullable=False, default=True)

    __table_args__ = (
        db.UniqueConstraint('date', 'location', 'timeslot', name='uq_date_location_timeslot'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'location': self.location,
            'timeslot': self.timeslot,
            'available': bool(self.available),
        }


class Program(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    athlete_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    coach_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

    athlete = db.relationship('User', foreign_keys=[athlete_id])
    coach = db.relationship('User', foreign_keys=[coach_id])
    sessions = db.relationship(
        'ProgramSession', backref='program', cascade='all, delete-orphan',
        order_by='ProgramSession.day_of_week'
    )

    def to_dict(self, with_sessions=False):
        data = {
            'id': self.id,
            'name': self.name,
            'athlete_id': self.athlete_id,
            'coach_id': self.coach_id,
        }
        if with_sessions:
            data['sessions'] = [s.to_dict() for s in self.sessions]
        return data


class ProgramSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey('program.id'), nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)  # 0 = lundi .. 6 = dimanche
    session_name = db.Column(db.String(128), nullable=True)
    exercises = db.relationship(
        'ExerciseEntry', backref='session', cascade='all, delete-orphan',
        order_by='ExerciseEntry.position'
    )

    __table_args__ = (
        db.UniqueConstraint('program_id', 'day_of_week', name='uq_program_day'),
    )

    def to_dict(self, with_exercises=True):
        data = {
            'id': self.id,
            'program_id': self.program_id,
            'day_of_week': self.day_of_week,
            'session_name': self.session_name,
        }
        if with_exercises:
            data['exercises'] = [e.to_dict() for e in self.exercises]
        return data


class ExerciseEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('program_session.id'), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)
    name = db.Column(db.String(192), nullable=False)
    sets = db.Column(db.Integer, nullable=True)
    reps = db.Column(db.String(64), nullable=True)
    rest = db.Column(db.String(64), nullable=True)
    rir = db.Column(db.String(32), nullable=True)
    intensification = db.Column(db.String(64), nullable=True)
    muscle = db.Column(db.String(64), nullable=True)
    remark = db.Column(db.Text, nullable=True)
    series_description = db.Column(db.Text, nullable=True)
    main_series = db.Column(db.Integer, nullable=True)

    def get_series_list(self):
        if not self.series_description:
            return []
        lines = self.series_description.strip().split('\n')
        series = []
        for i, line in enumerate(lines, 1):
            series.append({
                'number': i,
                'description': line.strip(),
                'text': f'Série {i}: {line.strip()}',
                'is_main': i == self.main_series,
            })
        return series

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'position': self.position,
            'name': self.name,
            'sets': self.sets,
            'reps': self.reps,
            'rest': self.rest,
            'rir': self.rir,
            'intensification': self.intensification,
            'muscle': self.muscle,
            'remark': self.remark,
            'series_description': self.series_description,
            'main_series': self.main_series,
            'series': self.get_series_list(),
        }


class JournalEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    entry_date = db.Column(db.Date, nullable=False, index=True)

    weight = db.Column(db.Float, nullable=True)
    protein = db.Column(db.Integer, nullable=True)
    carbs = db.Column(db.Integer, nullable=True)
    fats = db.Column(db.Integer, nullable=True)
    kcals = db.Column(db.Integer, nullable=True)
    water_ml = db.Column(db.Float, nullable=True)
    steps = db.Column(db.Integer, nullable=True)
    sleep_hours = db.Column(db.Float, nullable=True)

    digestion = db.Column(db.String(128), nullable=True)
    energy = db.Column(db.Integer, nullable=True)
    stress = db.Column(db.Integer, nullable=True)
    hunger = db.Column(db.Integer, nullable=True)
    food_quality = db.Column(db.String(64), nullable=True)

    menstrual_cycle = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index('idx_journal_athlete_date', 'athlete_id', 'entry_date'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'athlete_id': self.athlete_id,
            'entry_date': self.entry_date.isoformat(),
            'weight': self.weight,
            'protein': self.protein,
            'carbs': self.carbs,
            'fats': self.fats,
            'kcals': self.kcals,
            'water_ml': self.water_ml,
            'steps': self.steps,
            'sleep_hours': self.sleep_hours,
            'digestion': self.digestion,
            'energy': self.energy,
            'stress': self.stress,
            'hunger': self.hunger,
            'food_quality': self.food_quality,
            'menstrual_cycle': self.menstrual_cycle,
        }


class PerformanceEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    entry_date = db.Column(db.Date, nullable=False, index=True)
    program_session_id = db.Column(db.Integer, db.ForeignKey('program_session.id'), nullable=True)
    exercise = db.Column(db.String(192), nullable=False)
    series_number = db.Column(db.Integer, nullable=True)
    reps = db.Column(db.Float, nullable=True)
    load = db.Column(db.Float, nullable=True)
    rpe = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index('idx_perf_athlete_date', 'athlete_id', 'entry_date'),
        db.Index('idx_perf_athlete_exercise_date', 'athlete_id', 'exercise', 'entry_date'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'athlete_id': self.athlete_id,
            'entry_date': self.entry_date.isoformat(),
            'program_session_id': self.program_session_id,
            'exercise': self.exercise,
            'series_number': self.series_number,
            'reps': self.reps,
            'load': self.load,
            'rpe': self.rpe,
            'notes': self.notes,
        }


class Exercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(192), nullable=False, unique=True)
    muscle_group = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'muscle_group': self.muscle_group}


class Food(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(192), nullable=False, unique=True)
    brand = db.Column(db.String(100), nullable=True)
    kcal = db.Column(db.Float, nullable=False)
    proteins = db.Column(db.Float)
    lipids = db.Column(db.Float)
    saturated_fats = db.Column(db.Float)
    carbs = db.Column(db.Float, nullable=False)
    simple_sugars = db.Column(db.Float)
    fiber = db.Column(db.Float)
    salt = db.Column(db.Float)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'brand': self.brand,
            'kcal': self.kcal,
            'proteins': self.proteins,
            'lipids': self.lipids,
            'saturated_fats': self.saturated_fats,
            'carbs': self.carbs,
            'simple_sugars': self.simple_sugars,
            'fiber': self.fiber,
            'salt': self.salt,
        }


class MealPlan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    athlete_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    coach_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    meal_time_1 = db.Column(db.String(5), nullable=True)
    meal_time_2 = db.Column(db.String(5), nullable=True)
    meal_time_3 = db.Column(db.String(5), nullable=True)
    meal_time_4 = db.Column(db.String(5), nullable=True)
    meal_time_5 = db.Column(db.String(5), nullable=True)
    meal_time_6 = db.Column(db.String(5), nullable=True)
    meal_label_1 = db.Column(db.String(100), nullable=True)
    meal_label_2 = db.Column(db.String(100), nullable=True)
    meal_label_3 = db.Column(db.String(100), nullable=True)
    meal_label_4 = db.Column(db.String(100), nullable=True)
    meal_label_5 = db.Column(db.String(100), nullable=True)
    meal_label_6 = db.Column(db.String(100), nullable=True)
    meal_count = db.Column(db.Integer, default=6, nullable=True)

    meals = db.relationship(
        'MealEntry', backref='meal_plan', cascade='all, delete-orphan',
        order_by='MealEntry.meal_number'
    )

    def get_daily_totals(self):
        totals = {'kcals': 0, 'proteins': 0, 'lipids': 0, 'carbs': 0}
        for meal in self.meals:
            if meal.food:
                factor = (meal.quantity or 100) / 100.0
                totals['kcals'] += (meal.food.kcal or 0) * factor
                totals['proteins'] += (meal.food.proteins or 0) * factor
                totals['lipids'] += (meal.food.lipids or 0) * factor
                totals['carbs'] += (meal.food.carbs or 0) * factor
        return totals

    def to_dict(self, with_meals=True):
        data = {
            'id': self.id,
            'name': self.name,
            'athlete_id': self.athlete_id,
            'coach_id': self.coach_id,
            'meal_count': self.meal_count or 6,
            'meal_times': [getattr(self, f'meal_time_{i}') for i in range(1, 7)],
            'meal_labels': [getattr(self, f'meal_label_{i}') for i in range(1, 7)],
            'totals': self.get_daily_totals(),
        }
        if with_meals:
            meals_by_number = {}
            for m in self.meals:
                meals_by_number.setdefault(m.meal_number, []).append(m.to_dict())
            data['meals_by_number'] = meals_by_number
        return data


class MealEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    meal_plan_id = db.Column(db.Integer, db.ForeignKey('meal_plan.id'), nullable=False)
    food_id = db.Column(db.Integer, db.ForeignKey('food.id'), nullable=False)
    meal_number = db.Column(db.Integer, nullable=False)
    quantity = db.Column(db.Float, default=100)
    position = db.Column(db.Integer, default=0)

    food = db.relationship('Food')

    def to_dict(self):
        factor = (self.quantity or 100) / 100.0
        return {
            'id': self.id,
            'food_id': self.food_id,
            'food_name': self.food.name if self.food else '',
            'meal_number': self.meal_number,
            'quantity': self.quantity,
            'kcals': (self.food.kcal or 0) * factor if self.food else 0,
            'proteins': (self.food.proteins or 0) * factor if self.food else 0,
            'lipids': (self.food.lipids or 0) * factor if self.food else 0,
            'carbs': (self.food.carbs or 0) * factor if self.food else 0,
        }


class WeeklyBilanMarking(db.Model):
    # Table dédiée à l'appli mobile (nom distinct de celle de l'appli web) pour
    # ne jamais entrer en collision de schéma avec une éventuelle copie de la
    # base de production connectée au backend mobile.
    __tablename__ = 'mobile_weekly_bilan_marking'
    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    week_start = db.Column(db.Date, nullable=False, index=True)  # lundi de la semaine concernée
    done = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('athlete_id', 'week_start', name='uq_bilan_athlete_week'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'athlete_id': self.athlete_id,
            'week_start': self.week_start.isoformat(),
            'done': bool(self.done),
        }


class Objective(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    title = db.Column(db.String(256), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'athlete_id': self.athlete_id,
            'title': self.title,
            'description': self.description,
        }
