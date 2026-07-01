// IMPORTANT : remplace cette IP par l'adresse IP locale (LAN) de la machine
// qui fait tourner le backend Flask (voir `ipconfig` / la sortie de `python run.py`).
// - Émulateur Android : utiliser 10.0.2.2
// - Simulateur iOS : localhost fonctionne
// - Téléphone physique (Expo Go) : utiliser l'IP LAN de ton PC (ex: 192.168.1.19)
export const API_HOST = '192.168.1.19';
export const API_PORT = 5001;
export const API_URL = `http://${API_HOST}:${API_PORT}/api`;
