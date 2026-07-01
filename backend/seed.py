"""
Initialise la base SQLite locale de dev (backend/dev.db) avec des données de
démonstration : comptes coach/athlète, exercices, aliments, un programme,
un plan alimentaire, des entrées de journal/performance et des créneaux de
disponibilité. Base 100% locale, indépendante de la prod.
"""
import random
from datetime import date, timedelta

from app import create_app, db
from app.models import (
    User, Exercise, Food, Program, ProgramSession, ExerciseEntry,
    JournalEntry, PerformanceEntry, MealPlan, MealEntry, Availability,
    Objective, MUSCLE_GROUPS,
)

app = create_app()

EXERCISES = [
    ('Développé couché barre', 'PEC'),
    ('Développé incliné haltères', 'PEC'),
    ('Écarté couché', 'PEC'),
    ('Tractions pronation', 'DOS'),
    ('Rowing barre', 'DOS'),
    ('Tirage vertical', 'DOS'),
    ('Squat barre', 'QUAD'),
    ('Presse à cuisses', 'QUAD'),
    ('Fentes haltères', 'QUAD'),
    ('Soulevé de terre roumain', 'ISCHIO'),
    ('Leg curl allongé', 'ISCHIO'),
    ('Développé militaire', 'EPAULES'),
    ('Élévations latérales', 'EPAULES'),
    ('Curl biceps barre', 'BICEPS'),
    ('Curl incliné haltères', 'BICEPS'),
    ('Extension mollets debout', 'MOLLET'),
    ('Crunch lesté', 'ABDOS'),
    ('Gainage planche', 'ABDOS'),
]

FOODS = [
    ('Blanc de poulet', 'Générique', 165, 31, 3.6, 1.1, 0, 0, 0, 0.07),
    ('Riz basmati cuit', 'Générique', 130, 2.7, 0.3, 0.1, 28, 0.1, 0.4, 0.005),
    ('Flocons d\'avoine', 'Générique', 389, 16.9, 6.9, 1.2, 66, 0.99, 10.6, 0.002),
    ('Œuf entier', 'Générique', 155, 13, 11, 3.6, 1.1, 1.1, 0, 0.124),
    ('Banane', 'Générique', 89, 1.1, 0.3, 0.1, 23, 12.2, 2.6, 0.001),
    ('Whey protéine', 'MyProtein', 380, 75, 5, 2, 6, 3, 1, 0.3),
    ('Amandes', 'Générique', 579, 21, 50, 3.9, 22, 4.4, 12.5, 0.001),
    ('Patate douce cuite', 'Générique', 90, 2, 0.2, 0.1, 21, 6.5, 3.3, 0.036),
    ('Saumon', 'Générique', 208, 20, 13, 3.1, 0, 0, 0, 0.06),
    ('Yaourt grec nature', 'Générique', 97, 9, 5, 3.2, 4, 4, 0, 0.06),
]


def run():
    with app.app_context():
        db.drop_all()
        db.create_all()

        coach = User(username='coach', role='coach', display_name='Coach Dru')
        coach.set_password('coach123')

        athlete = User(username='athlete', role='athlete', display_name='Alex Athlète')
        athlete.set_password('athlete123')

        athlete2 = User(username='athlete2', role='athlete', display_name='Sam Athlète')
        athlete2.set_password('athlete123')

        db.session.add_all([coach, athlete, athlete2])
        db.session.commit()

        exercises_bank = []
        for name, muscle in EXERCISES:
            ex = Exercise(name=name, muscle_group=muscle)
            db.session.add(ex)
            exercises_bank.append(ex)
        db.session.commit()

        foods_bank = []
        for name, brand, kcal, prot, lip, sat, carb, sugar, fiber, salt in FOODS:
            food = Food(
                name=name, brand=brand, kcal=kcal, proteins=prot, lipids=lip,
                saturated_fats=sat, carbs=carb, simple_sugars=sugar, fiber=fiber, salt=salt,
            )
            db.session.add(food)
            foods_bank.append(food)
        db.session.commit()

        program = Program(name='Programme Prise de Masse', athlete_id=athlete.id, coach_id=coach.id)
        db.session.add(program)
        db.session.commit()

        session_defs = [
            (0, 'Haut du corps - Push', ['Développé couché barre', 'Développé incliné haltères', 'Développé militaire', 'Élévations latérales']),
            (2, 'Bas du corps', ['Squat barre', 'Presse à cuisses', 'Soulevé de terre roumain', 'Extension mollets debout']),
            (4, 'Haut du corps - Pull', ['Tractions pronation', 'Rowing barre', 'Curl biceps barre', 'Gainage planche']),
        ]
        by_name = {e.name: e for e in exercises_bank}
        created_sessions = []
        for day, session_name, ex_names in session_defs:
            sess = ProgramSession(program_id=program.id, day_of_week=day, session_name=session_name)
            db.session.add(sess)
            db.session.flush()
            for i, ex_name in enumerate(ex_names, 1):
                entry = ExerciseEntry(
                    session_id=sess.id, position=i, name=ex_name,
                    sets=4, reps='8-12', rest='90s', rir='2',
                    muscle=by_name[ex_name].muscle_group,
                    series_description='8 reps\n10 reps\n10 reps\n12 reps',
                    main_series=1,
                )
                db.session.add(entry)
            created_sessions.append(sess)
        db.session.commit()

        meal_plan = MealPlan(name='Plan Prise de Masse', athlete_id=athlete.id, coach_id=coach.id, meal_count=4)
        meal_plan.meal_time_1, meal_plan.meal_label_1 = '08:00', 'Petit-déjeuner'
        meal_plan.meal_time_2, meal_plan.meal_label_2 = '12:30', 'Déjeuner'
        meal_plan.meal_time_3, meal_plan.meal_label_3 = '16:00', 'Collation'
        meal_plan.meal_time_4, meal_plan.meal_label_4 = '19:30', 'Dîner'
        db.session.add(meal_plan)
        db.session.commit()

        by_food_name = {f.name: f for f in foods_bank}
        meal_defs = [
            (1, [('Flocons d\'avoine', 80), ('Œuf entier', 150), ('Banane', 120)]),
            (2, [('Blanc de poulet', 200), ('Riz basmati cuit', 250)]),
            (3, [('Whey protéine', 30), ('Amandes', 20)]),
            (4, [('Saumon', 180), ('Patate douce cuite', 200), ('Yaourt grec nature', 150)]),
        ]
        for meal_number, items in meal_defs:
            for pos, (food_name, qty) in enumerate(items, 1):
                db.session.add(MealEntry(
                    meal_plan_id=meal_plan.id, food_id=by_food_name[food_name].id,
                    meal_number=meal_number, quantity=qty, position=pos,
                ))
        db.session.commit()

        today = date.today()
        for i in range(7):
            d = today - timedelta(days=i)
            db.session.add(JournalEntry(
                athlete_id=athlete.id, entry_date=d,
                weight=round(78.5 - i * 0.05, 1), protein=180, carbs=320, fats=70,
                kcals=2650, water_ml=2500, steps=random.randint(4000, 11000),
                sleep_hours=round(random.uniform(6.5, 8.5), 1),
                digestion='bonne', energy=random.randint(5, 9), stress=random.randint(2, 6),
                hunger=random.randint(3, 7), food_quality='bonne',
            ))

            for sess in created_sessions:
                if sess.day_of_week == d.weekday():
                    for ex in sess.exercises:
                        for s in range(1, (ex.sets or 3) + 1):
                            db.session.add(PerformanceEntry(
                                athlete_id=athlete.id, entry_date=d, program_session_id=sess.id,
                                exercise=ex.name, series_number=s,
                                reps=round(random.uniform(6, 12), 1),
                                load=round(random.uniform(20, 100), 1),
                                rpe=random.randint(6, 9),
                            ))
        db.session.commit()

        db.session.add_all([
            Objective(athlete_id=athlete.id, title='Atteindre 80kg au squat', description='Progression continue sur 8 semaines'),
            Objective(athlete_id=athlete.id, title='Dormir 8h par nuit', description='Améliorer la récupération'),
            Objective(athlete_id=athlete2.id, title='Perdre 3kg de masse grasse', description=''),
        ])

        for i in range(14):
            d = today + timedelta(days=i)
            db.session.add(Availability(date=d, location='Salle principale', timeslot='morning', available=(i % 3 != 0)))
            db.session.add(Availability(date=d, location='Salle principale', timeslot='afternoon', available=(i % 4 != 0)))

        db.session.commit()

        print('Base de démo créée avec succès (backend/dev.db).')
        print('Coach     -> username: coach     / password: coach123')
        print('Athlète 1 -> username: athlete   / password: athlete123')
        print('Athlète 2 -> username: athlete2  / password: athlete123')


if __name__ == '__main__':
    run()
