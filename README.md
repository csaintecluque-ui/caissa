# Caïssa — école d'échecs

Application web installable (PWA) pour progresser aux échecs : problèmes adaptés à ton niveau, parties contre Stockfish « humanisé », analyse des parties et carnet d'erreurs. Tout tourne dans le navigateur, sans serveur, et fonctionne hors ligne après la première visite.

## Ce que fait l'appli

- **Problèmes** : réserve hors ligne générée avec Stockfish, complétée automatiquement par les problèmes de Lichess dès que tu es connecté (thèmes : pièce en prise, fourchette, clouage, mat en 1/2…). Ton niveau problèmes s'ajuste à chaque essai (départ à 1000).
- **Jouer** : 8 niveaux d'adversaire (≈ 600 à 2000+), qui choisit parmi plusieurs coups plausibles et peut se tromper. Pendule (15 + 10, 10 min, 5 + 3), reprise de coup, et deux garde-fous :
  - *Routine* : une fiche Échecs · Prises · Menaces avant chaque coup ;
  - *Filet anti-gaffe* : Stockfish vérifie ton coup en silence et te prévient s'il perd gros, sans donner la solution.
- **Analyse** : chaque coup passé au crible par Stockfish 19, précision, imprécisions/erreurs/gaffes, courbe d'évaluation, meilleure suite, exploration libre. Import de tes parties Lichess, Chess.com ou PGN collé.
- **Carnet d'erreurs** : tes erreurs deviennent des exercices, révisés à intervalles croissants (1, 3, 7, 16, 35 jours), avec des statistiques sur ce qui te coûte le plus de points.
- **Explications par Claude** (optionnel) : bouton « Expliquer » sur les problèmes, les coups et les positions. Ta clé API se saisit dans les réglages ⚙︎ et reste sur l'appareil.

## Mise en ligne sur GitHub Pages

1. Crée un dépôt `caissa` sur GitHub (public).
2. Dépose **tout le contenu** de ce dossier à la racine du dépôt (Add file → Upload files, glisser le dossier).
3. Settings → Pages → *Deploy from a branch* → branche `main`, dossier `/ (root)` → Save.
4. Après une minute, l'appli est disponible sur `https://<ton-pseudo>.github.io/caissa/`.
5. Sur le téléphone : ouvre l'adresse puis *Ajouter à l'écran d'accueil* (Chrome : menu ⋮ → Installer l'application).

Aucune configuration serveur n'est nécessaire : la version mono-thread de Stockfish fonctionne sur n'importe quel hébergement statique.

## Mettre à jour

Après une modification, change le numéro de version dans `sw.js` (`CACHE = 'caissa-v…'`) pour que les téléphones récupèrent la nouvelle version.

## Sauvegarde

Les données (parties, carnet, niveau) sont stockées sur l'appareil. Réglages ⚙︎ → *Exporter* pour les sauvegarder ou les transférer sur un autre appareil.

## Crédits et licences

- Moteur : [Stockfish 19](https://stockfishchess.org) via stockfish.js (Nathan Rugg) — GPL v3. Voir `engine/COPYING-stockfish.txt`.
- Règles : [chess.js](https://github.com/jhlywa/chess.js) — BSD-2.
- Pièces : jeu « cburnett » (Colin M.L. Burnett) — GPL v2+.
- Problèmes en ligne : base publique de [Lichess](https://database.lichess.org) — CC0.
- Police : Cormorant Garamond — SIL Open Font License.

Comme il intègre Stockfish, Caïssa est distribué sous licence GPL v3 (fichier `LICENSE`).
