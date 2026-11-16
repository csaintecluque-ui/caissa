# Caïssa — école d'échecs

Application web installable (PWA) pour progresser aux échecs : problèmes adaptés à ton niveau, parties contre Stockfish « humanisé », analyse des parties et carnet d'erreurs. Tout tourne dans le navigateur, sans serveur, et fonctionne hors ligne après la première visite.

## Ce que fait l'appli

- **Problèmes** : réserve hors ligne générée avec Stockfish, complétée automatiquement par les problèmes de Lichess dès que tu es connecté (thèmes : pièce en prise, fourchette, clouage, mat en 1/2…). Ton niveau problèmes s'ajuste à chaque essai (départ à 1000).
- **Jouer** : 15 personnages. De 1100 à 1900 (Victor, Chloé, Nora, Hugo, Antoine, Solène, Mathis, Le Professeur, Élise), ils jouent avec **Maia**, des réseaux de neurones entraînés sur des millions de parties Lichess pour jouer — et se tromper — comme des humains de ce niveau. En dessous (Léon, Margaux, Bastien, Inès) et au-dessus (La Sentinelle, Caïssa sans limite), c'est Stockfish bridé, calibré par des matchs contre Maia. Plus une Caïssa réglable de 250 à 2200. Pendule (15 + 10, 10 min, 5 + 3) et deux modes :
  - *Entraînement* : annuler son coup, indice, menace adverse, routine Échecs · Prises · Menaces, filet anti-gaffe ;
  - *Classée* : aucune aide, la partie compte pour ton **Elo Caïssa** (départ 1000, modifiable dans les réglages).
- **Bilan de partie** : chaque coup classé par Stockfish 19 (brillant, très fort, meilleur, excellent, bon, théorie, imprécision, erreur, occasion manquée, gaffe), nom de l'ouverture, précision globale et par phase, **Elo estimé sur la partie**, courbe d'évaluation, commentaire de chaque coup, exploration libre. Import de tes parties Lichess, Chess.com ou PGN collé.
- **Carnet d'erreurs** : tes erreurs deviennent des exercices, révisés à intervalles croissants (1, 3, 7, 16, 35 jours), avec des statistiques sur ce qui te coûte le plus de points.
- **Un entraînement qui monte avec toi** (onglet Cours) :
  - **Objectif Elo** : le palier suivant (1100, puis 1200…) et six leviers mesurés pour l'atteindre — niveau aux problèmes, gaffes par partie, précision, leçons, thèmes au niveau, régularité. Dès que l'objectif est atteint, il passe au palier suivant et les leviers se resserrent. Tes classements Lichess et Chess.com sont suivis si tu as renseigné tes pseudos.
  - **Séance du jour** (15 min) : échauffement, correction de tes propres erreurs de partie, puis ton thème le plus faible à ton niveau. Elle se termine par une partie classée conseillée, avec une consigne tirée de tes erreurs.
  - **Ateliers par thème** : 32 thèmes tactiques et de finales, chacun avec son propre niveau, sur des positions de vraies parties (base Lichess). La difficulté suit ton niveau sur le thème, et de nouveaux thèmes s'ouvrent quand tu progresses. Avec une clé API, le professeur rédige chaque atelier.
- **Les bases** : un programme de 20 leçons en 7 modules (ne plus rien donner, armes tactiques, mats à connaître, ouverture, finales de base, construire un plan, face à un humain). Chaque leçon se fait sur l'échiquier : démonstrations, coups à trouver, cases à toucher, questions, parties contre le moteur (mats élémentaires, finales de pions). Un contrôle sans aide valide la leçon ; elle revient ensuite en révision à 3, 10 et 30 jours. La prochaine leçon est choisie d'après les erreurs relevées dans tes parties. Tout cela fonctionne hors ligne, sans IA.
- **Professeur IA** (optionnel, comme dans Tengen) : Claude, ChatGPT, Gemini, Grok, OpenRouter ou service compatible OpenAI, avec ta propre clé et le modèle de ton choix (liste des modèles disponibles). Les clés restent sur l'appareil. Avec une clé, le professeur :
  - répond à tes questions pendant les leçons, en analyse (« pourquoi pas Cf3 ? ») et pendant les parties d'entraînement, où il guide sans donner le coup ;
  - rédige le **débrief** de chaque partie analysée : les moments clés, une priorité, la leçon conseillée ;
  - prépare des **cours particuliers** à partir des positions de ton carnet d'erreurs ;
  - tient le **carnet de l'élève** : bulletin d'étape, programme de la semaine, notes qu'il garde d'une séance à l'autre ;
  - affiche sa consommation du mois (demandes et tokens).

  Le professeur ne calcule jamais lui-même : chaque position lui est décrite pièce par pièce avec les variantes de Stockfish, et les coups que tu cites sont évalués par le moteur avant de lui être transmis.

## Grand échiquier

Sur les écrans avec un échiquier, le bouton ⤢ en haut à droite masque la barre du haut et les onglets : l'échiquier prend toute la largeur du téléphone (ou toute la hauteur sur tablette en paysage). Le bouton rond en bas à droite revient à l'affichage normal. Le choix est mémorisé.

Le zoom involontaire (double-tap, pincement) est bloqué dans toute l'appli.

## Noms des cases

Réglages ⚙︎ → *Noms des cases* : sur les bords, sur chaque case, ou masqués.

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
- Personnages humains : [Maia](https://maiachess.com) (CSSLab, Université de Toronto) — GPL v3. Réseaux convertis depuis le format Leela Chess Zero (`maia/`), inférence en JavaScript.
- Pièces : jeu « cburnett » (Colin M.L. Burnett) — GPL v2+.
- Problèmes en ligne : base publique de [Lichess](https://database.lichess.org) — CC0.
- Police : Cormorant Garamond — SIL Open Font License.

Comme il intègre Stockfish, Caïssa est distribué sous licence GPL v3 (fichier `LICENSE`).
