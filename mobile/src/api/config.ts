// Public production API (same MySQL as the Flask web app on Railway).
// Override locally with EXPO_PUBLIC_API_URL if needed (LAN / emulator).
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://web-production-9fd5b.up.railway.app/api';
