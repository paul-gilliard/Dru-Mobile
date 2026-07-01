# Suivi de la migration Web → Mobile (Dru)

## Contexte & garanties de sécurité

- Travail réalisé exclusivement dans `worspace_mobile/DruMobile/`, un **nouveau
  dossier avec son propre dépôt git local (sans remote)**. Aucun commit, push
  ou modification n'a été fait dans le repo web existant
  (`paul-gilliard/Dru` sur GitHub), ni dans sa copie (`worspace_mobile/Dru`).
- Backend mobile branché sur une **base SQLite 100% locale**
  (`backend/dev.db`), différente et indépendante de la base de production
  (Supabase Postgres) et de l'ancienne base Railway. Aucune donnée réelle
  n'est utilisée.
- L'application web en ligne n'a subi aucune modification ni aucun redéploiement.

## Ce qui a été fait

### Backend (`backend/`)
- API Flask JSON dédiée (`/api/...`), authentification par token JWT
  (`Authorization: Bearer ...`), CORS ouvert en dev.
- Modèles SQLAlchemy repris du modèle métier de l'app web (User, Program,
  ProgramSession, ExerciseEntry, JournalEntry, PerformanceEntry, Exercise,
  Food, MealPlan, MealEntry, Objective, Availability).
- Endpoints couvrant : login/me, dashboard (coach & athlète), gestion des
  athlètes, objectifs, disponibilités, programmes/séances/exercices, banque
  d'exercices, journal, performance, banque d'aliments, plans alimentaires.
- Script `seed.py` : crée un coach + 2 athlètes de démo, une banque
  d'exercices/aliments, un programme avec 3 séances, un plan alimentaire, 7
  jours d'historique (journal + performance) et 2 semaines de disponibilités.
- Testé manuellement (login, dashboard coach/athlète, programmes, plans
  alimentaires) : OK.

### Mobile (`mobile/`)
- App Expo (React Native + TypeScript), thème sombre custom, cross-platform
  iOS/Android (SDK 57).
- Auth : écran de connexion, token stocké via `expo-secure-store`, contexte
  `AuthContext` avec restauration de session.
- Navigation : `RootNavigator` (Auth / Coach / Athlète), tabs + stacks
  imbriqués (`AthleteNavigator`, `CoachNavigator`).
- Écrans athlète : Accueil (séance du jour, journal, objectifs), Programme
  (liste + détail séance avec log de performance série par série), Journal
  (formulaire du jour + historique), Nutrition (plans alimentaires détaillés
  avec totaux), Performances (historique par date/exercice), Disponibilités,
  Objectifs, menu "Plus".
- Écrans coach : Dashboard (liste athlètes + création), Détail athlète
  (mêmes écrans que l'athlète, réutilisés via `AthleteScopeContext`, avec
  gestion : créer un programme/séance/exercice, créer un plan
  alimentaire/ajouter des aliments, créer/supprimer des objectifs),
  Banque d'exercices (CRUD), Banque d'aliments (CRUD), gestion des
  disponibilités, menu "Plus".
- Réutilisation forte de la logique métier : les écrans Programme / Journal /
  Performance / Nutrition / Objectifs sont **partagés** entre l'espace
  athlète et l'espace coach (vue d'un athlète), via `AthleteScopeContext`.
- Build vérifié : `tsc --noEmit` sans erreur, bundles Metro Android **et**
  iOS générés sans erreur (1028 modules).

## Comment lancer le projet

Voir `README.md`. En résumé :
```bash
cd backend && venv\Scripts\activate && python seed.py && python run.py
cd mobile && npm install && npx expo start
```
Comptes de démo : `coach` / `coach123` et `athlete` / `athlete123`.

**Important** : dans `mobile/src/api/config.ts`, `API_HOST` doit être l'IP
LAN de la machine qui fait tourner le backend (visible dans la sortie de
`python run.py`, ex: `192.168.1.19`). Déjà pré-rempli avec l'IP détectée sur
cette machine au moment du développement — à re-vérifier si elle change.

## Ce qui n'a PAS été migré (hors scope de cette session)

Ces écrans web sont avancés/analytiques et n'ont pas d'équivalent mobile pour
l'instant (l'API mobile ne les expose pas non plus) :
- Stats coach avancées (graphiques tonnage par muscle, résumés 7/14/28 jours,
  détail par muscle) — `coach_stats`, `coach_stats.js`.
- Bilan hebdomadaire coach (`coach_weekly_summary`, panneau d'attention,
  marquage hebdo).
- Analyse croisée (`cross_analysis.js`, `weekly_compare.js`).
- Vue base de données brute (`coach_db_view`) — pas pertinente sur mobile.
- Édition fine des séries d'un exercice (l'app web permet une description
  libre multi-lignes par série ; le mobile permet d'ajouter un exercice mais
  pas encore d'éditer le détail de chaque série individuellement après
  création).

## Prochaines étapes suggérées

1. Tester l'app sur un vrai téléphone via Expo Go (scanner le QR de
   `npx expo start`, après avoir vérifié l'IP dans `config.ts`).
2. Décider d'un vrai hébergement pour le backend mobile (Railway/Render/etc.)
   et d'une vraie base (Postgres) le jour où l'app doit sortir d'un usage
   local — actuellement 100% local par sécurité.
3. Ajouter les écrans de stats avancées si besoin, en réutilisant les
   endpoints `/coach/stats/...` de l'app web comme référence.
4. Générer les icônes/splash définitifs (actuellement les placeholders Expo).
5. Builds de production : `eas build` (nécessite un compte Expo — à créer
   par toi, cf. consigne initiale sur les comptes que je ne peux pas créer).
