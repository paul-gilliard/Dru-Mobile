// IMPORTANT : remplace cette IP par l'adresse IP locale (LAN) de la machine
// qui fait tourner le backend Flask (voir `ipconfig` / la sortie de `python run.py`).
// - Émulateur Android : utiliser 10.0.2.2
// - Simulateur iOS : localhost fonctionne
// - Téléphone physique (Expo Go ou APK) : utiliser l'IP LAN de ton PC (ex: 192.168.1.19)
//   ou une URL publique si le backend est déployé (ex: https://mon-backend.up.railway.app)
//
// Pour un build APK (EAS Build), définis EXPO_PUBLIC_API_URL dans eas.json (par profil)
// ou dans un fichier .env à la racine de `mobile/` avant de lancer `eas build`.
// Exemple : EXPO_PUBLIC_API_URL=http://192.168.1.19:5001/api
export const API_HOST = '192.168.1.19';
export const API_PORT = 5001;
export const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${API_HOST}:${API_PORT}/api`;
