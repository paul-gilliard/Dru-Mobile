# Dru Mobile

Application multiplateforme (Android / iOS / navigateur) pour Dru.

```
Dru-Mobile/
├── backend/     # API Flask JSON + JWT
└── mobile/      # App Expo / React Native (TypeScript)
```

- Même logique métier que l’app web Flask/Jinja
- Auth JWT (adaptée mobile / web Expo)
- Cible : partager la même BDD MySQL que l’app web en production

## Démarrage rapide

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # puis ajuster DATABASE_URL si besoin
python seed.py           # SQLite local de démo (si pas de DATABASE_URL)
python run.py            # http://0.0.0.0:5001
```

Comptes démo (`seed.py`) :
- Coach : `coach` / `coach123`
- Athlète : `athlete` / `athlete123`

### 2. Mobile

```bash
cd mobile
npm install
npx expo start
```

Configurer l’URL de l’API via `EXPO_PUBLIC_API_URL` ou `mobile/src/api/config.ts`.

Scripts utiles :
- `npx expo start --android`
- `npx expo start --ios`
- `npx expo start --web` (navigateur PC)

## Notes

- Voir `PROGRESS.md` pour le détail de la migration.
- Ne pas committer `backend/.env` ni `mobile/.env`.
