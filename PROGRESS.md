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
  gestion complète : créer/renommer/dupliquer un programme, créer/renommer/
  supprimer une séance, ajouter/éditer/supprimer un exercice, créer/renommer/
  dupliquer un plan alimentaire, éditer l'heure/le libellé de chaque repas,
  ajouter/retirer des aliments, créer/supprimer des objectifs), Banque
  d'exercices (CRUD + édition), Banque d'aliments (CRUD + édition, marque et
  macros avancées), gestion des disponibilités, écran Utilisateurs (lister
  tous les rôles, créer coach/athlète, supprimer), écran Easy Bilan Hebdo
  (comparaison semaine actuelle/précédente par athlète + coche "bilan fait"),
  menu "Plus".
- Réutilisation forte de la logique métier : les écrans Programme / Journal /
  Performance / Nutrition / Objectifs / Statistiques sont **partagés** entre
  l'espace athlète et l'espace coach (vue d'un athlète), via
  `AthleteScopeContext`.
- Écran Statistiques (nouveau) : tonnage cumulé par groupe musculaire (30j,
  bar chart) + courbe d'évolution du poids + courbe de tonnage total par
  séance, via `react-native-chart-kit` / `react-native-svg`. Backend :
  nouveaux endpoints `GET /api/stats/tonnage-by-muscle` et
  `GET /api/stats/journal-trend`.
- Bug corrigé : le tap pendant le scroll (pattern `onTouchEnd` sur des `View`)
  déclenchait des sélections involontaires sur presque tous les écrans à
  listes/chips (séances, jours, badges, onglets, menus...). Remplacé partout
  par `Pressable`/`onPress`.
- Bug corrigé : le log de série d'exercice (`SessionDetailScreen`) n'envoyait
  pas `program_session_id` à la création de la performance, donc l'entrée
  n'était pas reconnue comme "faite aujourd'hui" après enregistrement (elle
  n'apparaissait qu'après un redémarrage de l'écran). Le lien avec la séance
  est maintenant correctement transmis.
- Build vérifié : `tsc --noEmit` sans erreur, bundles Metro Android **et**
  iOS générés sans erreur.
- **Refonte visuelle complète "salle de muscu intense"** (thème sombre +
  accents orange/rouge vifs, gradients, gros chiffres) :
  - Nouveau thème (`theme.ts`) : palette recentrée sur un fond quasi-noir,
    un orange/rouge énergique en couleur primaire, un vert/or pour les
    succès/records, ajout de `gradients` (primary, fire, hero, cool,
    success) et de `shadow.glow` pour les effets lumineux.
  - Kit UI (`components/ui.tsx`) repensé : boutons avec gradient + texte
    majuscule, cartes avec effet "glow" optionnel, `SectionTitle` avec
    barre d'accent, `Badge` plus contrasté, nouveaux composants
    `GradientCard`, `StatBlock`, `Divider`.
  - Écran de connexion : fond en dégradé, logo avec gradient, slogan
    "NO PAIN. NO GAIN. NO EXCUSES.".
  - Accueil athlète : carte "séance du jour" en gradient avec CTA,
    stats du jour, section objectifs/journal/programme.
  - Séance (log de performance) : barre de progression de la séance,
    détection automatique de record personnel (badge "🏆 PR"), bouton de
    validation de série en gradient vert.
  - Programme : mise en évidence de la séance du jour (bandeau + badge
    "AUJOURD'HUI").
  - Statistiques : cartes de résumé (tonnage 30j, delta de poids), muscle
    dominant mis en avant, graphiques recolorés en orange.
  - Journal : bandeau de série (streak) de jours consécutifs remplis,
    champs avec icônes.
  - Nutrition : gros chiffre de calories/jour, macros en pastilles
    colorées (protéines/glucides/lipides).
  - Dashboard coach : avatars en gradient, statistiques d'équipe, pastille
    "actif aujourd'hui".
  - Tous les écrans "Plus" (athlète/coach) : carte de profil avec avatar
    en gradient.
  - Bug corrigé (post-tests navigateur) : sur web, `expo-secure-store`
    n'est pas supporté, ce qui faisait échouer silencieusement **toutes**
    les requêtes API (y compris la connexion) via l'intercepteur Axios.
    Ajout d'un wrapper `utils/secureStorage.ts` qui bascule automatiquement
    sur `AsyncStorage` en environnement web et garde `expo-secure-store`
    sur iOS/Android.
  - Bug corrigé : plusieurs instances du backend Flask tournaient
    simultanément sur le port 5001 (conflit de port), causant des échecs
    de connexion aléatoires pendant les tests. Une seule instance propre
    est maintenant utilisée.
  - Testé via un navigateur (preview web Expo) sur l'intégralité du
    parcours coach et athlète (connexion, dashboard, les 6 onglets du
    détail athlète, banques d'exercices/aliments, disponibilités, profil,
    accueil athlète, programme) : aucune erreur JS, note visuelle globale
    9/10. Ajustements de contraste/espacement appliqués suite à ce retour
    (placeholders plus lisibles, badges plus contrastés, onglets moins
    serrés, feedback de pression sur les créneaux de disponibilité, champ
    description d'objectif non tronqué).

### Audit de parité avec l'app web en production + comblement des écarts

Session de comparaison directe avec `https://web-production-9fd5b.up.railway.app/`
(monkey test coach `admin`/`azerty` et athlète `paul`/`PGMisme02430`), page par
page, pour vérifier que tous les menus et fonctionnalités de l'app web existent
côté mobile.

**Constat général** : la structure de menus mobile (coach : Athlètes /
Exercices / Aliments / Dispo / Plus ; athlète : Accueil / Programme / Journal /
Nutrition / Plus) couvre déjà l'intégralité des sections web (Accueil,
Programmes, Plans Alimentaires, Suivi, Easy Bilan Hebdo, Exercices, Aliments,
Utilisateurs, Disponibilités). Le contenu de chaque section a été comparé
champ par champ.

**Écarts comblés dans cette session** :
- Banque d'exercices : ajout de l'édition (renommer / changer le groupe
  musculaire) — le backend exposait déjà `PUT /api/exercise-bank/<id>`, seule
  l'UI manquait.
- Banque d'aliments : ajout du champ **marque**, des macros avancées
  (saturés, sucres, fibres, sel via un panneau "Plus de détails"), et de
  l'édition d'un aliment existant (`PUT /api/foods/<id>`, déjà présent côté
  backend).
- Journal : ajout des champs **Qualité aliments**, **Digestion** (texte libre)
  et **Cycle menstruel** (SPM / phase menstruelle / en paix) — présents dans
  le modèle de données mais absents du formulaire mobile.
- Programme : ajout d'un bandeau de statistiques (nb d'exercices, séries
  totales, séances/semaine) et d'un bouton **Récap** ouvrant une modale de
  récapitulatif du programme jour par jour (équivalent du bouton "Recap" de
  l'éditeur de programme web).
- (Session précédente) Gestion complète des utilisateurs, renommage/
  duplication de programmes et plans alimentaires, renommage/suppression de
  séances, édition d'exercice existant, Easy Bilan Hebdo (comparaison
  semaine/semaine + coche "bilan fait").

**Écarts identifiés mais volontairement non comblés (hors scope temps
raisonnable)**, car ce sont des outils avancés / de niche plutôt que des
fonctionnalités cœur :
- Éditeur de séries au niveau **par série** (le web permet des reps/repos/RIR
  différents pour chaque série d'un même exercice, avec réordonnancement par
  glisser-déposer ; le mobile édite l'exercice dans son ensemble).
- Page "Suivi" (`/coach/stats`) : tableau de bord analytique très riche
  (comparaison hebdo détaillée par métrique, graphiques radar de tonnage,
  générateur de métriques croisées "Analyse croisée"). Le mobile couvre une
  version simplifiée (tonnage/muscle + tendance poids dans "Statistiques", et
  la comparaison hebdo via "Easy Bilan Hebdo").
- Duplication d'un repas vers un autre au sein d'un même plan alimentaire
  (le mobile permet de dupliquer un plan entier, pas un repas isolé).
- Page "DB" (`/coach/db-view`) : outil de debug interne pour le développeur,
  sans valeur pour un utilisateur final — non repris côté mobile.
- Sélecteur de lieu pour les disponibilités (un seul lieu existe dans les
  deux jeux de données actuels donc non bloquant).

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

## Ce qui n'a PAS été migré (hors scope, voir audit de parité ci-dessus)

Ces écrans web sont avancés/analytiques et n'ont pas d'équivalent mobile complet
pour l'instant :
- Page "Suivi" coach avancée : comparaison hebdo détaillée métrique par
  métrique, graphiques radar de tonnage par groupe musculaire, "Analyse
  croisée" (générateur de métriques custom). Une version simplifiée (tonnage/
  muscle + tendance poids) existe dans l'onglet "Statistiques", et la
  comparaison semaine/semaine par athlète existe via "Easy Bilan Hebdo".
- Vue base de données brute (`/coach/db-view`) — outil de debug interne, pas
  pertinent pour un utilisateur final sur mobile.
- Édition fine des séries d'un exercice (l'app web permet des reps/repos/RIR
  différents par série avec glisser-déposer pour réordonner ; le mobile édite
  l'exercice dans son ensemble, pas série par série).
- Duplication d'un repas isolé vers un autre au sein d'un même plan
  alimentaire (seule la duplication d'un plan entier est possible).

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
