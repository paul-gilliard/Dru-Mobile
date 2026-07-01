from datetime import datetime, date, timedelta

from flask import Blueprint, request, jsonify

from app import db
from app.auth import generate_token, login_required, coach_required
from app.models import (
    User, Availability, Program, ProgramSession, ExerciseEntry,
    JournalEntry, PerformanceEntry, Exercise, Food, MealPlan, MealEntry,
    Objective, MUSCLE_GROUPS,
)

api_bp = Blueprint('api', __name__)


def _parse_date(value, default=None):
    if not value:
        return default
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return default


def _scope_athlete_id(requested_id=None):
    """Un coach peut consulter n'importe quel athlete_id passé en paramètre.
    Un athlète est toujours restreint à ses propres données."""
    user = request.current_user
    if user.role == 'coach':
        return int(requested_id) if requested_id else None
    return user.id


# ---------------------------------------------------------------- AUTH -----

@api_bp.post('/auth/login')
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Identifiants incorrects'}), 401

    token = generate_token(user)
    return jsonify({'token': token, 'user': user.to_dict()})


@api_bp.get('/auth/me')
@login_required
def me():
    return jsonify(request.current_user.to_dict())


# ------------------------------------------------------------- DASHBOARD ---

@api_bp.get('/dashboard')
@login_required
def dashboard():
    user = request.current_user
    today = date.today()

    if user.role == 'coach':
        athletes = User.query.filter_by(role='athlete').order_by(User.username).all()
        summary = []
        for a in athletes:
            last_journal = (JournalEntry.query.filter_by(athlete_id=a.id)
                             .order_by(JournalEntry.entry_date.desc()).first())
            objectives_count = Objective.query.filter_by(athlete_id=a.id).count()
            programs_count = Program.query.filter_by(athlete_id=a.id).count()
            summary.append({
                'athlete': a.to_dict(),
                'last_journal_date': last_journal.entry_date.isoformat() if last_journal else None,
                'objectives_count': objectives_count,
                'programs_count': programs_count,
            })
        return jsonify({'role': 'coach', 'athletes': summary})

    program = Program.query.filter_by(athlete_id=user.id).order_by(Program.created_at.desc()).first()
    today_session = None
    if program:
        today_session = next((s for s in program.sessions if s.day_of_week == today.weekday()), None)

    objectives = Objective.query.filter_by(athlete_id=user.id).order_by(Objective.created_at.desc()).limit(5).all()
    last_journal = (JournalEntry.query.filter_by(athlete_id=user.id)
                     .order_by(JournalEntry.entry_date.desc()).first())
    today_journal = JournalEntry.query.filter_by(athlete_id=user.id, entry_date=today).first()

    return jsonify({
        'role': 'athlete',
        'today': today.isoformat(),
        'program': program.to_dict() if program else None,
        'today_session': today_session.to_dict() if today_session else None,
        'objectives': [o.to_dict() for o in objectives],
        'last_journal': last_journal.to_dict() if last_journal else None,
        'has_logged_today': today_journal is not None,
    })


# ---------------------------------------------------------------- COACH ----

@api_bp.get('/coach/athletes')
@coach_required
def list_athletes():
    athletes = User.query.filter_by(role='athlete').order_by(User.username).all()
    return jsonify([a.to_dict() for a in athletes])


@api_bp.post('/coach/athletes')
@coach_required
def create_athlete():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    display_name = (data.get('display_name') or '').strip() or username

    if not username or not password:
        return jsonify({'error': 'username et password requis'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Ce nom d\u2019utilisateur existe déjà'}), 409

    athlete = User(username=username, role='athlete', display_name=display_name)
    athlete.set_password(password)
    db.session.add(athlete)
    db.session.commit()
    return jsonify(athlete.to_dict()), 201


@api_bp.delete('/coach/athletes/<int:athlete_id>')
@coach_required
def delete_athlete(athlete_id):
    athlete = User.query.get_or_404(athlete_id)
    if athlete.role != 'athlete':
        return jsonify({'error': 'Utilisateur non modifiable'}), 400
    db.session.delete(athlete)
    db.session.commit()
    return jsonify({'ok': True})


# ------------------------------------------------------------ OBJECTIVES ---

@api_bp.get('/objectives')
@login_required
def list_objectives():
    athlete_id = _scope_athlete_id(request.args.get('athlete_id'))
    if athlete_id is None:
        return jsonify({'error': 'athlete_id requis'}), 400
    objectives = Objective.query.filter_by(athlete_id=athlete_id).order_by(Objective.created_at.desc()).all()
    return jsonify([o.to_dict() for o in objectives])


@api_bp.post('/objectives')
@login_required
def create_objective():
    data = request.get_json(silent=True) or {}
    athlete_id = _scope_athlete_id(data.get('athlete_id'))
    title = (data.get('title') or '').strip()
    if not athlete_id or not title:
        return jsonify({'error': 'athlete_id et title requis'}), 400

    obj = Objective(athlete_id=athlete_id, title=title, description=data.get('description'))
    db.session.add(obj)
    db.session.commit()
    return jsonify(obj.to_dict()), 201


@api_bp.put('/objectives/<int:objective_id>')
@login_required
def update_objective(objective_id):
    obj = Objective.query.get_or_404(objective_id)
    if request.current_user.role != 'coach' and obj.athlete_id != request.current_user.id:
        return jsonify({'error': 'Accès refusé'}), 403
    data = request.get_json(silent=True) or {}
    if 'title' in data:
        obj.title = data['title']
    if 'description' in data:
        obj.description = data['description']
    db.session.commit()
    return jsonify(obj.to_dict())


@api_bp.delete('/objectives/<int:objective_id>')
@login_required
def delete_objective(objective_id):
    obj = Objective.query.get_or_404(objective_id)
    if request.current_user.role != 'coach' and obj.athlete_id != request.current_user.id:
        return jsonify({'error': 'Accès refusé'}), 403
    db.session.delete(obj)
    db.session.commit()
    return jsonify({'ok': True})


# ----------------------------------------------------------- AVAILABILITY -

@api_bp.get('/availability')
@login_required
def list_availability():
    start = _parse_date(request.args.get('start'), date.today())
    end = _parse_date(request.args.get('end'), start + timedelta(days=13))
    slots = (Availability.query
             .filter(Availability.date >= start, Availability.date <= end)
             .order_by(Availability.date, Availability.timeslot).all())
    return jsonify([s.to_dict() for s in slots])


@api_bp.post('/availability')
@coach_required
def upsert_availability():
    data = request.get_json(silent=True) or {}
    slot_date = _parse_date(data.get('date'))
    if not slot_date:
        return jsonify({'error': 'date (YYYY-MM-DD) requise'}), 400
    location = data.get('location') or 'salle principale'
    timeslot = data.get('timeslot') or 'morning'
    available = bool(data.get('available', True))

    slot = Availability.query.filter_by(date=slot_date, location=location, timeslot=timeslot).first()
    if slot:
        slot.available = available
    else:
        slot = Availability(date=slot_date, location=location, timeslot=timeslot, available=available)
        db.session.add(slot)
    db.session.commit()
    return jsonify(slot.to_dict())


# -------------------------------------------------------------- PROGRAMS --

@api_bp.get('/programs')
@login_required
def list_programs():
    athlete_id = _scope_athlete_id(request.args.get('athlete_id'))
    if athlete_id is None:
        return jsonify({'error': 'athlete_id requis'}), 400
    programs = Program.query.filter_by(athlete_id=athlete_id).order_by(Program.created_at.desc()).all()
    return jsonify([p.to_dict() for p in programs])


@api_bp.get('/programs/<int:program_id>')
@login_required
def get_program(program_id):
    program = Program.query.get_or_404(program_id)
    if request.current_user.role != 'coach' and program.athlete_id != request.current_user.id:
        return jsonify({'error': 'Accès refusé'}), 403
    return jsonify(program.to_dict(with_sessions=True))


@api_bp.post('/programs')
@coach_required
def create_program():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    athlete_id = data.get('athlete_id')
    if not name or not athlete_id:
        return jsonify({'error': 'name et athlete_id requis'}), 400
    program = Program(name=name, athlete_id=athlete_id, coach_id=request.current_user.id)
    db.session.add(program)
    db.session.commit()
    return jsonify(program.to_dict(with_sessions=True)), 201


@api_bp.delete('/programs/<int:program_id>')
@coach_required
def delete_program(program_id):
    program = Program.query.get_or_404(program_id)
    db.session.delete(program)
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.post('/programs/<int:program_id>/sessions')
@coach_required
def create_session(program_id):
    Program.query.get_or_404(program_id)
    data = request.get_json(silent=True) or {}
    day_of_week = data.get('day_of_week')
    if day_of_week is None:
        return jsonify({'error': 'day_of_week requis (0=lundi ... 6=dimanche)'}), 400

    existing = ProgramSession.query.filter_by(program_id=program_id, day_of_week=day_of_week).first()
    if existing:
        return jsonify(existing.to_dict()), 200

    session_obj = ProgramSession(
        program_id=program_id, day_of_week=day_of_week,
        session_name=data.get('session_name') or f'Séance jour {day_of_week + 1}'
    )
    db.session.add(session_obj)
    db.session.commit()
    return jsonify(session_obj.to_dict()), 201


@api_bp.delete('/sessions/<int:session_id>')
@coach_required
def delete_session(session_id):
    session_obj = ProgramSession.query.get_or_404(session_id)
    db.session.delete(session_obj)
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.post('/sessions/<int:session_id>/exercises')
@coach_required
def add_exercise_entry(session_id):
    ProgramSession.query.get_or_404(session_id)
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name requis'}), 400

    max_position = db.session.query(db.func.max(ExerciseEntry.position)).filter_by(session_id=session_id).scalar()
    entry = ExerciseEntry(
        session_id=session_id,
        position=(max_position or 0) + 1,
        name=name,
        sets=data.get('sets'),
        reps=data.get('reps'),
        rest=data.get('rest'),
        rir=data.get('rir'),
        intensification=data.get('intensification'),
        muscle=data.get('muscle'),
        remark=data.get('remark'),
        series_description=data.get('series_description'),
        main_series=data.get('main_series'),
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@api_bp.put('/program-exercises/<int:entry_id>')
@coach_required
def update_exercise_entry(entry_id):
    entry = ExerciseEntry.query.get_or_404(entry_id)
    data = request.get_json(silent=True) or {}
    for field in ('name', 'sets', 'reps', 'rest', 'rir', 'intensification', 'muscle', 'remark',
                  'series_description', 'main_series', 'position'):
        if field in data:
            setattr(entry, field, data[field])
    db.session.commit()
    return jsonify(entry.to_dict())


@api_bp.delete('/program-exercises/<int:entry_id>')
@coach_required
def delete_exercise_entry(entry_id):
    entry = ExerciseEntry.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------- EXERCISE BANK -

@api_bp.get('/exercise-bank')
@login_required
def list_exercise_bank():
    exercises = Exercise.query.order_by(Exercise.muscle_group, Exercise.name).all()
    return jsonify({
        'muscle_groups': MUSCLE_GROUPS,
        'exercises': [e.to_dict() for e in exercises],
    })


@api_bp.post('/exercise-bank')
@coach_required
def create_exercise_bank():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    muscle_group = data.get('muscle_group')
    if not name or muscle_group not in MUSCLE_GROUPS:
        return jsonify({'error': 'name et muscle_group (valide) requis'}), 400
    if Exercise.query.filter_by(name=name).first():
        return jsonify({'error': 'Cet exercice existe déjà'}), 409
    exercise = Exercise(name=name, muscle_group=muscle_group)
    db.session.add(exercise)
    db.session.commit()
    return jsonify(exercise.to_dict()), 201


@api_bp.put('/exercise-bank/<int:exercise_id>')
@coach_required
def update_exercise_bank(exercise_id):
    exercise = Exercise.query.get_or_404(exercise_id)
    data = request.get_json(silent=True) or {}
    if data.get('name'):
        exercise.name = data['name']
    if data.get('muscle_group') in MUSCLE_GROUPS:
        exercise.muscle_group = data['muscle_group']
    db.session.commit()
    return jsonify(exercise.to_dict())


@api_bp.delete('/exercise-bank/<int:exercise_id>')
@coach_required
def delete_exercise_bank(exercise_id):
    exercise = Exercise.query.get_or_404(exercise_id)
    db.session.delete(exercise)
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------- JOURNAL -

@api_bp.get('/journal')
@login_required
def list_journal():
    athlete_id = _scope_athlete_id(request.args.get('athlete_id'))
    if athlete_id is None:
        return jsonify({'error': 'athlete_id requis'}), 400
    query = JournalEntry.query.filter_by(athlete_id=athlete_id)
    start = _parse_date(request.args.get('start'))
    end = _parse_date(request.args.get('end'))
    if start:
        query = query.filter(JournalEntry.entry_date >= start)
    if end:
        query = query.filter(JournalEntry.entry_date <= end)
    entries = query.order_by(JournalEntry.entry_date.desc()).limit(60).all()
    return jsonify([e.to_dict() for e in entries])


JOURNAL_FIELDS = [
    'weight', 'protein', 'carbs', 'fats', 'kcals', 'water_ml', 'steps', 'sleep_hours',
    'digestion', 'energy', 'stress', 'hunger', 'food_quality', 'menstrual_cycle',
]


@api_bp.post('/journal')
@login_required
def upsert_journal():
    data = request.get_json(silent=True) or {}
    athlete_id = request.current_user.id if request.current_user.role == 'athlete' else data.get('athlete_id')
    entry_date = _parse_date(data.get('entry_date'), date.today())
    if not athlete_id:
        return jsonify({'error': 'athlete_id requis'}), 400

    entry = JournalEntry.query.filter_by(athlete_id=athlete_id, entry_date=entry_date).first()
    if not entry:
        entry = JournalEntry(athlete_id=athlete_id, entry_date=entry_date)
        db.session.add(entry)

    for field in JOURNAL_FIELDS:
        if field in data:
            setattr(entry, field, data[field])

    db.session.commit()
    return jsonify(entry.to_dict()), 201


@api_bp.put('/journal/<int:entry_id>')
@login_required
def update_journal(entry_id):
    entry = JournalEntry.query.get_or_404(entry_id)
    if request.current_user.role != 'coach' and entry.athlete_id != request.current_user.id:
        return jsonify({'error': 'Accès refusé'}), 403
    data = request.get_json(silent=True) or {}
    for field in JOURNAL_FIELDS:
        if field in data:
            setattr(entry, field, data[field])
    db.session.commit()
    return jsonify(entry.to_dict())


@api_bp.delete('/journal/<int:entry_id>')
@login_required
def delete_journal(entry_id):
    entry = JournalEntry.query.get_or_404(entry_id)
    if request.current_user.role != 'coach' and entry.athlete_id != request.current_user.id:
        return jsonify({'error': 'Accès refusé'}), 403
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'ok': True})


# ------------------------------------------------------------ PERFORMANCE -

@api_bp.get('/performance')
@login_required
def list_performance():
    athlete_id = _scope_athlete_id(request.args.get('athlete_id'))
    if athlete_id is None:
        return jsonify({'error': 'athlete_id requis'}), 400
    query = PerformanceEntry.query.filter_by(athlete_id=athlete_id)
    session_id = request.args.get('session_id')
    if session_id:
        query = query.filter_by(program_session_id=int(session_id))
    exercise = request.args.get('exercise')
    if exercise:
        query = query.filter_by(exercise=exercise)
    entry_date = _parse_date(request.args.get('date'))
    if entry_date:
        query = query.filter_by(entry_date=entry_date)
    entries = query.order_by(PerformanceEntry.entry_date.desc(), PerformanceEntry.series_number).limit(200).all()
    return jsonify([e.to_dict() for e in entries])


@api_bp.get('/performance/last-for-exercise')
@login_required
def last_performance_for_exercise():
    athlete_id = _scope_athlete_id(request.args.get('athlete_id'))
    exercise = request.args.get('exercise')
    if not athlete_id or not exercise:
        return jsonify({'error': 'athlete_id et exercise requis'}), 400
    entries = (PerformanceEntry.query
               .filter_by(athlete_id=athlete_id, exercise=exercise)
               .order_by(PerformanceEntry.entry_date.desc(), PerformanceEntry.series_number)
               .limit(10).all())
    return jsonify([e.to_dict() for e in entries])


@api_bp.post('/performance')
@login_required
def create_performance():
    data = request.get_json(silent=True) or {}
    athlete_id = request.current_user.id if request.current_user.role == 'athlete' else data.get('athlete_id')
    exercise = (data.get('exercise') or '').strip()
    if not athlete_id or not exercise:
        return jsonify({'error': 'athlete_id et exercise requis'}), 400

    entry = PerformanceEntry(
        athlete_id=athlete_id,
        entry_date=_parse_date(data.get('entry_date'), date.today()),
        program_session_id=data.get('program_session_id'),
        exercise=exercise,
        series_number=data.get('series_number'),
        reps=data.get('reps'),
        load=data.get('load'),
        rpe=data.get('rpe'),
        notes=data.get('notes'),
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@api_bp.put('/performance/<int:entry_id>')
@login_required
def update_performance(entry_id):
    entry = PerformanceEntry.query.get_or_404(entry_id)
    if request.current_user.role != 'coach' and entry.athlete_id != request.current_user.id:
        return jsonify({'error': 'Accès refusé'}), 403
    data = request.get_json(silent=True) or {}
    for field in ('reps', 'load', 'rpe', 'notes', 'series_number'):
        if field in data:
            setattr(entry, field, data[field])
    db.session.commit()
    return jsonify(entry.to_dict())


@api_bp.delete('/performance/<int:entry_id>')
@login_required
def delete_performance(entry_id):
    entry = PerformanceEntry.query.get_or_404(entry_id)
    if request.current_user.role != 'coach' and entry.athlete_id != request.current_user.id:
        return jsonify({'error': 'Accès refusé'}), 403
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'ok': True})


# -------------------------------------------------------------- FOOD BANK -

@api_bp.get('/foods')
@login_required
def list_foods():
    search = request.args.get('q')
    query = Food.query
    if search:
        query = query.filter(Food.name.ilike(f'%{search}%'))
    foods = query.order_by(Food.name).limit(500).all()
    return jsonify([f.to_dict() for f in foods])


@api_bp.post('/foods')
@coach_required
def create_food():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name or data.get('kcal') is None or data.get('carbs') is None:
        return jsonify({'error': 'name, kcal et carbs requis'}), 400
    if Food.query.filter_by(name=name).first():
        return jsonify({'error': 'Cet aliment existe déjà'}), 409

    food = Food(
        name=name, brand=data.get('brand'), kcal=data['kcal'], proteins=data.get('proteins'),
        lipids=data.get('lipids'), saturated_fats=data.get('saturated_fats'), carbs=data['carbs'],
        simple_sugars=data.get('simple_sugars'), fiber=data.get('fiber'), salt=data.get('salt'),
    )
    db.session.add(food)
    db.session.commit()
    return jsonify(food.to_dict()), 201


@api_bp.put('/foods/<int:food_id>')
@coach_required
def update_food(food_id):
    food = Food.query.get_or_404(food_id)
    data = request.get_json(silent=True) or {}
    for field in ('name', 'brand', 'kcal', 'proteins', 'lipids', 'saturated_fats', 'carbs',
                  'simple_sugars', 'fiber', 'salt'):
        if field in data:
            setattr(food, field, data[field])
    db.session.commit()
    return jsonify(food.to_dict())


@api_bp.delete('/foods/<int:food_id>')
@coach_required
def delete_food(food_id):
    food = Food.query.get_or_404(food_id)
    db.session.delete(food)
    db.session.commit()
    return jsonify({'ok': True})


# ------------------------------------------------------------- MEAL PLANS -

@api_bp.get('/meal-plans')
@login_required
def list_meal_plans():
    athlete_id = _scope_athlete_id(request.args.get('athlete_id'))
    if athlete_id is None:
        return jsonify({'error': 'athlete_id requis'}), 400
    plans = MealPlan.query.filter_by(athlete_id=athlete_id).order_by(MealPlan.created_at.desc()).all()
    return jsonify([p.to_dict(with_meals=False) for p in plans])


@api_bp.get('/meal-plans/<int:plan_id>')
@login_required
def get_meal_plan(plan_id):
    plan = MealPlan.query.get_or_404(plan_id)
    if request.current_user.role != 'coach' and plan.athlete_id != request.current_user.id:
        return jsonify({'error': 'Accès refusé'}), 403
    return jsonify(plan.to_dict(with_meals=True))


@api_bp.post('/meal-plans')
@coach_required
def create_meal_plan():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    athlete_id = data.get('athlete_id')
    if not name or not athlete_id:
        return jsonify({'error': 'name et athlete_id requis'}), 400
    plan = MealPlan(name=name, athlete_id=athlete_id, coach_id=request.current_user.id,
                     meal_count=data.get('meal_count', 6))
    db.session.add(plan)
    db.session.commit()
    return jsonify(plan.to_dict()), 201


@api_bp.delete('/meal-plans/<int:plan_id>')
@coach_required
def delete_meal_plan(plan_id):
    plan = MealPlan.query.get_or_404(plan_id)
    db.session.delete(plan)
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.post('/meal-plans/<int:plan_id>/meals')
@coach_required
def add_meal_entry(plan_id):
    MealPlan.query.get_or_404(plan_id)
    data = request.get_json(silent=True) or {}
    meal_number = data.get('meal_number')
    food_id = data.get('food_id')
    if not meal_number or not food_id:
        return jsonify({'error': 'meal_number et food_id requis'}), 400

    max_position = (db.session.query(db.func.max(MealEntry.position))
                     .filter_by(meal_plan_id=plan_id, meal_number=meal_number).scalar())
    entry = MealEntry(
        meal_plan_id=plan_id, food_id=food_id, meal_number=meal_number,
        quantity=data.get('quantity', 100), position=(max_position or 0) + 1,
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@api_bp.put('/meal-entries/<int:entry_id>')
@coach_required
def update_meal_entry(entry_id):
    entry = MealEntry.query.get_or_404(entry_id)
    data = request.get_json(silent=True) or {}
    if 'quantity' in data:
        entry.quantity = data['quantity']
    db.session.commit()
    return jsonify(entry.to_dict())


@api_bp.delete('/meal-entries/<int:entry_id>')
@coach_required
def delete_meal_entry(entry_id):
    entry = MealEntry.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.put('/meal-plans/<int:plan_id>/meal-time')
@coach_required
def set_meal_time(plan_id):
    plan = MealPlan.query.get_or_404(plan_id)
    data = request.get_json(silent=True) or {}
    meal_number = data.get('meal_number')
    if meal_number not in range(1, 7):
        return jsonify({'error': 'meal_number doit être entre 1 et 6'}), 400
    setattr(plan, f'meal_time_{meal_number}', data.get('time'))
    setattr(plan, f'meal_label_{meal_number}', data.get('label'))
    db.session.commit()
    return jsonify(plan.to_dict())
