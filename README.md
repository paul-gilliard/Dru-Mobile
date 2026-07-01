# Dru Mobile

Application mobile cross-platform (iOS / Android) pour Dru, basée sur Expo / React Native.

Ce projet est **totalement indépendant** de l'application web en production :

- Dépôt git local dédié (aucun remote configuré) — ne partage rien avec le repo `paul-gilliard/Dru`.
- Backend API JSON dédié (`backend/`), copie évolutive du modèle de données de l'app web, branché sur une base **SQLite locale** (`backend/dev.db`), sans aucun lien avec la base Supabase/Railway de production.
- Aucune donnée, credential ou config de production n'est utilisée ici.

## Structure

```
DruMobile/
├── backend/     # API Flask (JSON) + base SQLite locale de dev
└── mobile/      # App Expo / React Native (TypeScript)
```

## Démarrage rapide

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
python seed.py             # crée la base + données de démo
python run.py               # démarre l'API sur http://0.0.0.0:5001
```

Comptes de démo créés par `seed.py` :
- Coach : `coach` / `coach123`
- Athlète : `athlete` / `athlete123`

### 2. Mobile

```bash
cd mobile
npm install
npx expo start
```

Configurer l'IP de votre machine (celle du backend) dans `mobile/src/api/config.ts` (`API_URL`) pour que le téléphone / l'émulateur puisse joindre l'API sur le réseau local.

## Notes

- Voir `todo.md` (racine du repo web) et `BLOCAGE.md` (si présent) pour l'avancement / les points bloquants.
- Voir `PROGRESS.md` pour le suivi détaillé de cette migration.
