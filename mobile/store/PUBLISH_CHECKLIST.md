# Publication Play Store + App Store — checklist Dru

Tu reviens de l’entraînement : **carte bleue + pièces d’identité** suffisent pour finir les comptes.
Tout le reste (config app, privacy URL, builds store, textes) est déjà préparé.

## Coûts (obligatoires)

| Plateforme | Coût | Récurrence |
|---|---|---|
| Google Play Console | ~25 USD | **une fois** |
| Apple Developer Program | 99 USD | **par an** |

Oui : **App Store = pas le choix**, compte développeur Apple payant requis (TestFlight + App Store).

Compte Expo (`paul_luap`) : déjà OK.

---

## 1) Google Play (Android) — ordre exact

1. Ouvre https://play.google.com/console/signup
2. Connecte-toi avec le Google de l’app (idéalement `paul.gilliard.8@gmail.com`)
3. Paie les **25 USD**, accepte les conditions, vérifie l’identité si demandé
4. **Créer une app** :
   - Nom : `Dru`
   - Langue : Français
   - Type : Application
   - Gratuit
5. Remplis (bloquants avant mise en ligne) :
   - Fiche Store → textes dans `mobile/store/LISTING_FR.md`
   - Politique de confidentialité : `https://web-production-9fd5b.up.railway.app/privacy`
   - Classification du contenu / public cible
   - Data safety (Health Connect = données santé, consentement)
   - Coordonnées développeur
6. **Upload AAB** (build production déjà lancé ou à relancer) :
   - Testing → Internal testing → Create release → upload `.aab`
   - Ou plus tard : `eas submit --platform android --profile production --latest`
7. Premier upload AAB **manuel** est souvent le plus simple (Play exige parfois 1 release manuelle avant l’API).

### Après paiement Play — optionnel pour submit auto
Créer un compte de service Google Cloud lié à Play Console (JSON), puis :
`eas credentials -p android` → Google Service Account → upload du JSON.

---

## 2) Apple App Store (iOS) — ordre exact

1. Ouvre https://developer.apple.com/programs/enroll/
2. Connecte-toi avec Apple ID (`paul.gilliard.8@gmail.com` recommandé)
3. Choisis **Individual** (ou Organisation si société)
4. Paie **99 USD / an**, complète la vérif identité
5. Attends l’activation (parfois quelques heures)
6. https://appstoreconnect.apple.com → **My Apps** → **+** → New App
   - Platforms : iOS
   - Name : Dru
   - Primary language : French
   - Bundle ID : `com.drumobile.app` (à créer dans Certificates, Identifiers & Profiles si pas encore listé)
   - SKU : `dru-mobile-001`
7. Copie l’**Apple ID numérique** de l’app (App Store Connect → App Information)  
   → remplace `REPLACE_AFTER_APP_STORE_CONNECT` dans `mobile/eas.json` → `submit.production.ios.ascAppId`
8. Build iOS :
   ```bash
   cd mobile
   eas build --platform ios --profile production
   ```
   EAS gère certificats / provisioning (Apple login interactif la 1ʳᵉ fois).
9. Submit / TestFlight :
   ```bash
   eas submit --platform ios --profile production --latest
   ```
10. Remplis métadonnées + screenshots + privacy URL, puis **Submit for Review**.

---

## 3) Déjà fait dans le repo

- `app.json` : bundle iOS `com.drumobile.app`, splash, encryption flag, permissions Android
- `eas.json` : profile `production` → **AAB store** (Play) + submit draft/internal
- Privacy + Support hébergés sur Railway (`/privacy`, `/support`)
- Textes listing FR : `mobile/store/LISTING_FR.md`
- Package Android déjà : `com.drumobile.app`

## 4) Commandes utiles (après comptes)

```bash
cd mobile
# Android store (AAB)
eas build --platform android --profile production

# iOS store (après Apple Developer actif)
eas build --platform ios --profile production

# Submit (quand comptes + 1ʳᵉ config OK)
eas submit --platform android --profile production --latest
eas submit --platform ios --profile production --latest
```

## 5) Captures d’écran

À faire sur téléphone réel ou simulateur — listées dans `LISTING_FR.md`.
Sans screenshots, les stores refusent la mise en ligne publique.
