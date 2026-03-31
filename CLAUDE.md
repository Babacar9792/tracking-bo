

Application Angular de Tracking (Leaflet)
Objectif
Créer une application Angular moderne (Angular 17+ avec standalone components) qui permet d'afficher les déplacements d'un utilisateur à partir d'un shareToken.

Contexte
L'application dispose d'une URL de tracking sous la forme https://app.com/tracking/{shareToken}. Elle doit récupérer ce shareToken depuis l'URL et afficher les déplacements associés.

Exigences fonctionnelles
1. Routing

Créer une route /tracking/:shareToken
Extraire dynamiquement le paramètre shareToken

2. Service API

Créer un service Angular TrackingService
Appeler une API REST : GET /api/tracking/{shareToken}
Gérer les erreurs : token invalide, token expiré, erreurs réseau

3. Modèle de données
Un déplacement contient les champs suivants :
ChampTypeRequislatitudenumberouilongitudenumberouitimestampdateouispeednumbernon
4. Affichage carte — Leaflet (obligatoire)

Utiliser Leaflet (obligatoire) — installer et configurer JS + CSS dans Angular
Afficher les points de déplacement (markers), une polyline reliant les points, un marqueur de départ et un marqueur d'arrivée
Implémenter un zoom automatique (fitBounds) pour inclure tous les points
Ajouter des popups sur les markers (date, vitesse)

5. UI / UX

Loader pendant le chargement
Message si aucun déplacement trouvé
Gestion des erreurs (token invalide ou expiré)
Liste des déplacements affichée sous la carte

6. Bonus (optionnel)

Rafraîchissement automatique toutes les 10 secondes
Calcul et affichage de la vitesse moyenne
Mise à jour en temps réel
UI améliorée pour les popups


Architecture
Utiliser des standalone components avec une séparation claire des responsabilités :
/tracking
├── tracking-page.component.ts
├── map.component.ts
└── tracking.service.ts
Utiliser RxJS (Observable) pour la gestion des flux de données.

Styling et design frontend
L'application doit démontrer un haut niveau de qualité UI/UX :

Framework : Tailwind CSS ou Angular Material
Interface moderne, propre et professionnelle
Design responsive (mobile, tablette, desktop)
Bonne hiérarchie visuelle avec utilisation cohérente des couleurs, espacements et typographie
Composants réutilisables : cards, loaders, messages d'alerte
Animations légères (transitions, états de chargement)
Feedback utilisateur fluide


Sécurité

Valider le shareToken côté frontend
Ne pas exposer d'informations sensibles dans le client


Tests
Ajouter au moins un test unitaire pour TrackingService.

Livrables attendus

Structure complète du projet Angular
Code complet des composants et du service API
Configuration du routing
Intégration complète de Leaflet
UI moderne, responsive et bien structurée


Résultat attendu
Une application Angular professionnelle permettant de visualiser clairement les déplacements d'un utilisateur sur une carte interactive, avec une excellente expérience utilisateur.
