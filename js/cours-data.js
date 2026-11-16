// Le programme de cours de Caïssa : modules, leçons, étapes et contrôles.
// Toutes les positions sont vérifiées par Stockfish avec tools/verifier-cours.mjs.
//
// Étapes (champ t) :
//   texte   — explication ; l'échiquier montre fen (ou la position précédente)
//   demo    — coups joués automatiquement (coups : liste UCI)
//   trouve  — l'élève joue ; sol = [coup élève, réponse, coup élève, …] ; alt = autres 1ers coups acceptés ;
//             strict = seule la ligne prévue est acceptée (répertoire d'ouverture)
//   case    — toucher la ou les bonnes cases (cases ; tous = toutes exigées)
//   qcm     — choix multiples (choix, bon = indice de la bonne réponse)
//   partie  — jouer contre le moteur : but 'mat' | 'promo' | 'nulle', max = nombre de coups de l'élève
// Champs communs : h (texte HTML), fen ou apres (coups depuis la position initiale), o (orientation),
// fl (flèches 'e2e4', 'e2e4:bad', 'e2e4:hint'), mq (cases marquées), ok (texte après réussite), indice.

export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const ITALIENNE = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d3', 'd7d6', 'e1g1', 'e8g8'];
const GDR = ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e2e3', 'e8g8'];
const LEGAL = ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'f1c4', 'c8g4', 'b1c3', 'g7g6', 'f3e5', 'g4d1', 'c4f7', 'e8e7', 'c3d5'];

export const MODULES = [
  // ====================================================================================
  {
    id: 'm1', titre: 'Ne plus rien donner', resume: 'Avant de chercher à gagner, arrête de perdre : la plupart des parties entre 800 et 1200 se décident sur une pièce laissée en prise.',
    lecons: [
      {
        id: 'valeur', titre: 'La valeur des pièces', duree: 6, cat: ['hanging'], theme: 'hangingPiece',
        but: 'Savoir en un coup d\'œil si un échange te rapporte ou te coûte.',
        etapes: [
          { t: 'texte', h: `<p>Chaque pièce a une valeur, comptée en pions :</p><p><b>Pion 1 · Cavalier 3 · Fou 3 · Tour 5 · Dame 9</b></p><p>Le roi n'a pas de prix : le perdre, c'est perdre la partie. Ces chiffres servent à une seule chose : savoir si un échange est bon pour toi.</p>` },
          { t: 'qcm', h: `<p>Tu peux donner ton <b>fou</b> pour prendre une <b>tour</b>. Bonne affaire ?</p>`, choix: ['Oui : je donne 3 et je prends 5', 'Non : un fou vaut plus qu\'une tour', 'C\'est égal'], bon: 0, ok: `C'est ce qu'on appelle « gagner la qualité » : +2 pour toi.` },
          { t: 'trouve', fen: '6k1/pp3ppp/2p5/3q1r2/4P3/8/PPP2PPP/R1B3K1 w - - 0 1', h: `<p>Ton pion e4 attaque <b>deux</b> pièces noires. Laquelle prendre ?</p>`, sol: ['e4d5'], indice: 'Compare la valeur des deux pièces attaquées.', ok: `Tu prends la dame (9) avec un pion (1). Prendre la tour aurait rapporté presque deux fois moins.` },
          { t: 'qcm', fen: '1r4k1/pp3ppp/8/8/8/1Q6/PPP2PPP/6K1 w - - 0 1', fl: ['b3b7:bad'], h: `<p>Ta dame peut prendre le pion b7. Est-ce un bon coup ?</p>`, choix: ['Oui, un pion c\'est toujours bon à prendre', 'Non : la tour b8 reprend, je donne 9 pour gagner 1'], bon: 1, ok: `Un pion <b>défendu</b> n'est pas gratuit. Regarde toujours qui peut reprendre.` },
          { t: 'trouve', fen: '5k2/ppp1rppp/8/b2N4/8/8/PPP2PPP/R5K1 w - - 0 1', h: `<p>Ton cavalier attaque le pion c7 et la tour e7. Les deux sont défendus. Y a-t-il quand même une bonne prise ?</p>`, sol: ['d5e7'], indice: 'Une des deux pièces vaut plus que ton cavalier.', ok: `Cavalier (3) contre tour (5) : même si le roi reprend, tu gagnes 2 points.` },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>Avant chaque prise : « qu'est-ce que je prends, qu'est-ce qu'on me reprend ? »</li><li>Si plusieurs pièces peuvent prendre, commence par <b>la moins chère</b>.</li><li>Une pièce défendue par moins cher que ton attaquant n'est pas à prendre.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: '6k1/pp3ppp/4p3/3q4/2P5/8/PP3PPP/3Q2K1 w - - 0 1', h: `<p>Deux de tes pièces peuvent prendre la dame noire. Choisis la bonne.</p>`, sol: ['c4d5'], ok: `Le pion d'abord : si tu prends avec la dame, le pion e6 la reprend et c'est un simple échange.` },
          { t: 'qcm', h: `<p>Tu donnes une <b>tour</b> et tu récupères <b>un fou et un cavalier</b>. Bilan ?</p>`, choix: ['Je perds 2 points', 'Je gagne 1 point (5 contre 6)', 'Égalité parfaite'], bon: 1 },
          { t: 'trouve', fen: '4rk2/pp3ppp/8/1B6/8/8/PPP2PPP/6K1 w - - 0 1', h: `<p>Trouve la prise qui rapporte.</p>`, sol: ['b5e8'], ok: `Fou contre tour : +2, même si le roi reprend.` },
          { t: 'qcm', h: `<p>Classe ces pièces de la moins chère à la plus chère.</p>`, choix: ['Pion, tour, cavalier, dame', 'Pion, cavalier, tour, dame', 'Cavalier, pion, tour, dame'], bon: 1 },
        ],
      },
      {
        id: 'compter', titre: 'Attaquants et défenseurs', duree: 8, cat: ['hanging'], theme: 'hangingPiece',
        but: 'Savoir si une pièce est vraiment en danger : compter qui l\'attaque et qui la défend.',
        etapes: [
          { t: 'demo', fen: '3r2k1/pp3pbp/6p1/8/3N4/8/PP3PPP/3R2K1 b - - 0 1', o: 'w', fl: ['g7d4:bad', 'd8d4:bad', 'd1d4'], h: `<p>Ton cavalier d4 est attaqué <b>deux fois</b> (fou g7, tour d8) et défendu <b>une fois</b> (tour d1). Deux contre un : il va tomber. Regarde.</p>`, coups: ['g7d4', 'd1d4', 'd8d4'], ok: `Les Noirs ont donné un fou et pris un cavalier <b>et</b> une tour. Quand les attaquants sont plus nombreux que les défenseurs, la pièce est perdue.` },
          { t: 'case', fen: '4r1k1/ppp2ppp/5n2/1N6/4B3/8/PP3PPP/3R2K1 w - - 0 1', h: `<p>Une de tes pièces est en prise. <b>Touche-la</b> sur l'échiquier.</p>`, cases: ['e4'], indice: 'Regarde ce que visent la tour e8 et le cavalier f6.', ok: `Le fou e4 est attaqué deux fois et personne ne le défend.` },
          { t: 'qcm', fen: '6k1/ppp2ppp/2nb4/4p3/8/1P1P1N1P/P1P2PP1/2B1R1K1 w - - 0 1', fl: ['f3e5:hint', 'e1e5:hint'], h: `<p>Tu attaques le pion e5 avec le cavalier et la tour. Il est défendu par le cavalier c6 et le fou d6. Peux-tu le prendre ?</p>`, choix: ['Oui : deux attaquants, ça suffit', 'Non : deux attaquants contre deux défenseurs, je perds du matériel', 'Oui, avec la tour d\'abord'], bon: 1, ok: `Pour gagner un pion défendu, il faut <b>un attaquant de plus</b> que de défenseurs.` },
          { t: 'trouve', fen: '6k1/ppp2ppp/2nb4/4p3/8/1P1P1N1P/PBP2PP1/4R1K1 w - - 0 1', h: `<p>Même position, mais ton fou est passé en b2 : <b>trois</b> attaquants contre deux défenseurs. À toi.</p>`, sol: ['f3e5'], alt: ['b2e5'], indice: 'Commence par une pièce légère, garde la tour pour la fin.', ok: `Trois contre deux : le pion tombe. Et tu as commencé par une pièce légère, pas par la tour.` },
          { t: 'case', fen: 'r2q1rk1/ppp2ppp/2n5/4p3/3N4/2P5/PP3PPP/R2Q1RK1 w - - 0 1', h: `<p>Ton cavalier d4 est défendu deux fois. Pourtant une pièce blanche doit réagir tout de suite : laquelle ?</p>`, cases: ['d4'], ok: `Il est attaqué par un <b>pion</b>. Quand moins cher t'attaque, le nombre de défenseurs ne compte plus : la pièce doit bouger ou s'échanger.` },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>Pièce attaquée : compte les attaquants et les défenseurs.</li><li>Plus d'attaquants que de défenseurs : elle tombe.</li><li>Attaquée par moins cher qu'elle : elle doit partir, même défendue.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: 'r4rk1/ppp2ppp/2n5/3q4/8/2N2N2/PPP2PPP/R2Q1RK1 w - - 0 1', h: `<p>Une pièce noire est en prise. Prends-la.</p>`, sol: ['c3d5'], alt: ['d1d5'] },
          { t: 'qcm', fen: '2b3k1/pp3ppp/4pn2/3p4/8/2N3P1/PP2PPBP/6K1 w - - 0 1', h: `<p>Peux-tu gagner le pion d5 ?</p>`, choix: ['Oui, il est attaqué deux fois', 'Non : deux attaquants, deux défenseurs'], bon: 1 },
          { t: 'trouve', fen: '2b3k1/pp3ppp/5n2/3p4/8/2N3P1/PP2PPBP/6K1 w - - 0 1', h: `<p>Et maintenant ? Le pion e6 a disparu.</p>`, sol: ['c3d5'], alt: ['g2d5'] },
          { t: 'case', fen: '6k1/ppp2ppp/8/8/1p2B3/2N5/PP3PPP/6K1 w - - 0 1', h: `<p>Touche ta pièce qui doit bouger tout de suite.</p>`, cases: ['c3'] },
        ],
      },
      {
        id: 'routine', titre: 'La routine Échecs · Prises · Menaces', duree: 8, cat: ['hanging', 'allowedTactic', 'allowedMate'], theme: 'mix',
        but: 'Dix secondes de vérification avant chaque coup, qui évitent la majorité des gaffes.',
        etapes: [
          { t: 'texte', h: `<p>Les forts joueurs ne voient pas tout. Ils regardent <b>toujours les mêmes choses, dans le même ordre</b> :</p><ol><li><b>Échecs</b> : les miens, et ceux de l'adversaire.</li><li><b>Prises</b> : qu'est-ce qui peut être pris, des deux côtés ?</li><li><b>Menaces</b> : que veut son dernier coup ?</li></ol><p>On s'entraîne sur chaque point.</p>` },
          { t: 'trouve', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', h: `<p><b>1. Échecs.</b> Commence toujours par regarder tes échecs. Ici, il y en a un qui termine la partie.</p>`, sol: ['d1d8'], ok: `Mat du couloir. Un échec oblige l'adversaire à répondre : c'est le coup le plus forçant.` },
          { t: 'trouve', fen: 'r2q1rk1/ppp2ppp/2np4/4p2n/4P3/2NP4/PPP2PPP/R1BQ1RK1 w - - 0 1', h: `<p><b>2. Prises.</b> Passe en revue tout ce que tu peux prendre. Une pièce noire n'est défendue par personne.</p>`, sol: ['d1h5'], indice: 'Regarde les pièces au bord de l\'échiquier.', ok: `Le cavalier h5 n'était pas défendu. Une pièce sans défenseur est toujours une cible.` },
          { t: 'case', fen: 'r1b2rk1/pppp1ppp/2n5/4p3/2B1P1nq/2NP4/PPP2PPP/R1BQ1RK1 w - - 0 1', h: `<p><b>3. Menaces.</b> Les Noirs viennent de jouer leur dame en h4. Quelle case de ton camp visent-ils ? Touche-la.</p>`, cases: ['h2'], ok: `Dame et cavalier attaquent h2, défendu seulement par ton roi : ils menacent mat en un coup.` },
          { t: 'trouve', fen: 'r1b2rk1/pppp1ppp/2n5/4p3/2B1P1nq/2NP4/PPP2PPP/R1BQ1RK1 w - - 0 1', h: `<p>Pare la menace de mat en h2.</p>`, sol: ['h2h3'], indice: 'Chasse l\'un des deux attaquants avec un pion.', ok: `Le pion chasse le cavalier, et sans lui la dame ne peut plus mater.` },
          { t: 'qcm', fen: '4r1k1/p4ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', fl: ['a1a7:hint'], h: `<p><b>Avant de lâcher ton coup</b>, refais la routine pour l'adversaire. Txa7 gagne un pion. Tu le joues ?</p>`, choix: ['Oui, un pion gratuit', 'Non : après Txa7, les Noirs ont un échec en e1… et c\'est mat'], bon: 1, ok: `Ta tour gardait la première rangée. « Après mon coup, quels sont SES échecs ? » : cette question évite les pires gaffes.` },
          { t: 'texte', h: `<p><b>Ta routine de 10 secondes</b></p><ol><li>Que veut son dernier coup ?</li><li>Mes échecs, mes prises.</li><li>Je choisis mon coup.</li><li>Avant de le jouer : ses échecs et ses prises <b>après</b> mon coup.</li></ol><p>En partie d'entraînement, active l'aide « Routine » pour l'ancrer.</p>` },
        ],
        controle: [
          { t: 'trouve', fen: '6k1/5ppp/8/8/3Q4/8/1B3PPP/6K1 w - - 0 1', h: `<p>Regarde tes échecs.</p>`, sol: ['d4g7'] },
          { t: 'trouve', fen: 'r4rk1/ppp2ppp/8/3b4/8/2N5/PPP2PPP/R4RK1 w - - 0 1', h: `<p>Regarde tes prises.</p>`, sol: ['c3d5'] },
          { t: 'case', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', h: `<p>Tu as les Noirs. Quelle case les Blancs menacent-ils ?</p>`, cases: ['f7'] },
          { t: 'trouve', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', h: `<p>Pare la menace de mat.</p>`, sol: ['g7g6'], alt: ['d8e7', 'd8f6', 'g8h6'] },
        ],
      },
    ],
  },
  // ====================================================================================
  {
    id: 'm2', titre: 'Les armes tactiques', resume: 'Quatre motifs qui gagnent du matériel à tous les niveaux. Les reconnaître, c\'est aussi ne plus les subir.',
    lecons: [
      {
        id: 'fourchette', titre: 'La fourchette', duree: 9, cat: ['missedTactic', 'allowedTactic'], theme: 'fork',
        but: 'Attaquer deux pièces à la fois : l\'adversaire ne peut en sauver qu\'une.',
        etapes: [
          { t: 'demo', fen: 'r3k3/ppp2ppp/8/3N4/8/8/PPP2PPP/6K1 w - - 0 1', fl: ['d5c7'], h: `<p>Une <b>fourchette</b>, c'est une pièce qui en attaque deux en même temps. Le cavalier en est le spécialiste : regarde-le prendre en c7.</p>`, coups: ['d5c7', 'e8d7', 'c7a8'], ok: `Échec au roi <b>et</b> attaque de la tour : le roi doit bouger, la tour tombe.` },
          { t: 'trouve', fen: '6k1/pp3ppp/8/3q1N2/8/8/PP3PPP/6K1 w - - 0 1', h: `<p>Ton cavalier peut attaquer le roi et la dame en même temps. Trouve la case.</p>`, sol: ['f5e7', 'g8h8', 'e7d5'], indice: 'Cherche un échec de cavalier.', ok: `La fourchette royale. Repère toujours les cases d'où ton cavalier donne échec.` },
          { t: 'trouve', fen: '6k1/ppp2ppp/2n1b3/8/3P4/8/PPP2PPP/3R2K1 w - - 0 1', h: `<p>Le pion aussi sait faire des fourchettes, et il ne coûte rien. À toi.</p>`, sol: ['d4d5'], indice: 'Un pion attaque en diagonale, des deux côtés.', ok: `Le pion attaque cavalier et fou. Il est soutenu par ta tour : une des deux pièces est perdue.` },
          { t: 'trouve', fen: 'r5k1/p1p3pp/8/8/8/8/PPP2PPP/3Q2K1 w - - 0 1', h: `<p>La dame fait des fourchettes dans toutes les directions. Trouve l'échec qui attaque aussi la tour.</p>`, sol: ['d1d5', 'g8h8', 'd5a8'], ok: `Échec + pièce non défendue : c'est le schéma à chercher avec la dame.` },
          { t: 'trouve', fen: '5rk1/ppr3pp/8/8/3N4/8/PPP1BPPP/3R2K1 w - - 0 1', h: `<p>Pas d'échec cette fois. Mais les deux tours noires sont sur des cases que ton cavalier peut viser ensemble.</p>`, sol: ['d4e6'], indice: 'Une tour en c7, l\'autre en f8.', ok: `Une tour s'enfuit, ton cavalier prend l'autre : tu gagnes la qualité.` },
          { t: 'texte', h: `<p><b>Comment la repérer</b></p><ul><li>Cherche les pièces adverses <b>non défendues</b> et le roi exposé.</li><li>Pour le cavalier : deux cibles sur des cases de même couleur.</li><li>En défense : après chaque coup adverse, demande-toi quelle case son cavalier vise.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: '2r3k1/pp3ppp/8/3N4/8/8/PP3PPP/6K1 w - - 0 1', h: `<p>Trouve la fourchette.</p>`, sol: ['d5e7', 'g8f8', 'e7c8'] },
          { t: 'trouve', fen: '6k1/ppp2pp1/7p/3b1n2/8/7P/PPP1PPP1/4R1K1 w - - 0 1', h: `<p>Trouve la fourchette.</p>`, sol: ['e2e4'] },
          { t: 'trouve', fen: '4k3/ppp2ppp/8/b7/8/2P5/PP3PPP/3Q2K1 w - - 0 1', h: `<p>Trouve la fourchette.</p>`, sol: ['d1a4', 'c7c6', 'a4a5'] },
        ],
        pioche: { theme: 'fork', n: 3 },
      },
      {
        id: 'clouage', titre: 'Le clouage', duree: 9, cat: ['missedTactic', 'allowedTactic'], theme: 'pin',
        but: 'Immobiliser une pièce parce qu\'elle protège plus précieux derrière elle.',
        etapes: [
          { t: 'texte', fen: '4k3/8/2n5/1B6/8/8/8/4K3 w - - 0 1', fl: ['b5e8:hint'], h: `<p>Le fou, le cavalier et le roi noirs sont <b>alignés</b>. Si le cavalier bouge, son roi est en échec : il n'a pas le droit de bouger. Il est <b>cloué</b>.</p><p>Seuls le fou, la tour et la dame peuvent clouer.</p>` },
          { t: 'trouve', fen: '4k3/ppp2ppp/2n5/1B6/3P4/8/PPP2PPP/4K3 w - - 0 1', h: `<p>Une pièce clouée ne peut pas fuir. La règle : <b>attaque-la avec un pion</b>.</p>`, sol: ['d4d5'], ok: `Le cavalier ne peut pas bouger : il est perdu.` },
          { t: 'qcm', fen: 'rnbqkb1r/ppp2ppp/4pn2/3p2B1/3P4/2N5/PPP1PPPP/R2QKBNR b KQkq - 1 3', fl: ['g5d8:hint'], h: `<p>Ton fou g5 cloue le cavalier f6… sur la dame. Le cavalier a-t-il le droit de bouger ?</p>`, choix: ['Non, c\'est interdit', 'Oui, mais il abandonne sa dame'], bon: 1, ok: `Clouage sur le roi : bouger est <b>interdit</b>. Clouage sur une autre pièce : c'est permis, mais ça coûte cher.` },
          { t: 'trouve', fen: '4k3/ppp2ppp/3p4/4n3/8/8/PPP2PPP/4R1K1 w - - 0 1', h: `<p>Ta tour cloue le cavalier e5 sur le roi. Il est défendu par un pion : le prendre avec la tour serait un mauvais échange. Gagne-le autrement.</p>`, sol: ['f2f4'], indice: 'Attaque la pièce clouée avec un pion.', ok: `Même recette : la pièce clouée ne peut pas se sauver.` },
          { t: 'trouve', fen: '6k1/pp4pp/8/3q4/8/8/PPB2PPP/6K1 w - - 0 1', h: `<p>À toi de créer le clouage. La dame et le roi noirs sont sur la même diagonale.</p>`, sol: ['c2b3'], ok: `La dame ne peut pas quitter la diagonale : elle est perdue contre un simple fou.` },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>Repère les pièces adverses alignées avec leur roi ou leur dame.</li><li>Pièce clouée : attaque-la, de préférence avec un pion.</li><li>Si c'est toi qui es cloué : mets une pièce entre les deux, chasse l'attaquant, ou déplace la pièce de derrière.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: '3k4/pp3ppp/2p5/3n4/8/8/PPP2PPP/3R2K1 w - - 0 1', h: `<p>Gagne la pièce clouée.</p>`, sol: ['c2c4'] },
          { t: 'case', fen: 'r2qk2r/ppp2ppp/2n2n2/1B1pp1B1/4P3/3P1N2/PPP2PPP/RN1QK2R b KQkq - 0 1', o: 'w', h: `<p>Deux pièces noires sont clouées. Touche-les toutes les deux.</p>`, cases: ['c6', 'f6'], tous: true },
          { t: 'trouve', fen: '4k3/pp3ppp/8/4q3/8/8/PP3PPP/1N1R1K2 w - - 0 1', h: `<p>Cloue la dame.</p>`, sol: ['d1e1'] },
        ],
        pioche: { theme: 'pin', n: 3 },
      },
      {
        id: 'enfilade', titre: 'L\'enfilade', duree: 7, cat: ['missedTactic', 'allowedTactic'], theme: 'skewer',
        but: 'Attaquer une pièce de valeur pour gagner celle qui se cache derrière.',
        etapes: [
          { t: 'trouve', fen: '7r/8/8/4k3/8/8/6PP/2B3K1 w - - 0 1', h: `<p>L'<b>enfilade</b>, c'est le clouage à l'envers : la pièce la plus précieuse est <b>devant</b>. Elle doit fuir, et tu prends celle de derrière.</p><p>Le roi et la tour noirs sont sur la même diagonale. Donne l'échec qui les embroche.</p>`, sol: ['c1b2', 'e5e6', 'b2h8'], ok: `Le roi s'écarte, la tour tombe.` },
          { t: 'trouve', fen: '8/8/8/8/3k3q/8/6PP/R5K1 w - - 0 1', h: `<p>Même idée avec la tour, sur une rangée.</p>`, sol: ['a1a4', 'd4d5', 'a4h4'], ok: `Quand roi et dame sont sur la même ligne, cherche l'échec en enfilade.` },
          { t: 'trouve', fen: 'r7/8/2k5/8/8/8/6PP/3Q2K1 w - - 0 1', h: `<p>Et avec la dame, en diagonale.</p>`, sol: ['d1f3', 'c6c7', 'f3a8'], indice: 'Roi en c6, tour en a8 : quelle diagonale ?' },
          { t: 'qcm', h: `<p>Quelle est la différence entre un clouage et une enfilade ?</p>`, choix: ['Aucune', 'Clouage : la pièce de devant vaut moins et ne peut pas bouger. Enfilade : la pièce de devant vaut plus et doit fuir.', 'L\'enfilade se fait avec un cavalier'], bon: 1 },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>Deux pièces adverses sur la même ligne : pense clouage ou enfilade.</li><li>L'enfilade commence presque toujours par un <b>échec</b>.</li><li>En défense : évite d'aligner ton roi avec ta dame ou tes tours.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: '8/8/q7/8/2k5/6P1/6B1/6K1 w - - 0 1', h: `<p>Trouve l'enfilade.</p>`, sol: ['g2f1', 'c4d4', 'f1a6'] },
          { t: 'trouve', fen: '4r3/8/8/4k3/8/8/6PP/R5K1 w - - 0 1', h: `<p>Trouve l'enfilade.</p>`, sol: ['a1e1', 'e5d6', 'e1e8'] },
        ],
        pioche: { theme: 'skewer', n: 3 },
      },
      {
        id: 'decouverte', titre: 'L\'attaque à la découverte', duree: 8, cat: ['missedTactic', 'allowedTactic'], theme: 'discoveredAttack',
        but: 'Bouger une pièce pour démasquer l\'attaque de celle qui est derrière : deux menaces d\'un coup.',
        etapes: [
          { t: 'trouve', fen: '4k3/pq3ppp/8/8/4N3/8/PP3PPP/4R1K1 w - - 0 1', fl: ['e1e8:hint'], h: `<p>Ta tour vise le roi noir, mais ton cavalier est sur le chemin. S'il s'écarte, c'est <b>échec à la découverte</b>… et le cavalier peut en profiter pour attaquer autre chose.</p><p>Trouve la case d'où il attaque la dame.</p>`, sol: ['e4d6', 'e8d7', 'd6b7'], ok: `Le roi doit s'occuper de l'échec, et le cavalier prend la dame. Ici c'était même un échec <b>double</b>.` },
          { t: 'trouve', fen: '3q1rk1/ppp2ppp/8/8/8/3B4/PPP1QPPP/3R2K1 w - - 0 1', fl: ['d1d8:hint'], h: `<p>Ta tour vise la dame noire à travers ton fou. Écarte le fou <b>avec échec</b> : les Noirs n'auront pas le temps de sauver leur dame.</p>`, sol: ['d3h7', 'g8h7', 'd1d8'], ok: `Tu donnes un fou et une tour, tu prends une dame et un pion.` },
          { t: 'trouve', fen: 'r3k3/pp3ppp/8/8/4B3/8/PP3PPP/4R1K1 w - - 0 1', h: `<p>À toi : le fou s'écarte, la tour donne échec, et le fou attaque quelque chose au passage.</p>`, sol: ['e4b7', 'e8d7', 'b7a8'], indice: 'Le fou peut prendre un pion et viser la tour a8.' },
          { t: 'qcm', h: `<p>Tu subis un <b>échec double</b> (deux pièces donnent échec en même temps). Que peux-tu faire ?</p>`, choix: ['Prendre l\'une des deux pièces', 'Mettre une pièce entre les deux', 'Uniquement bouger le roi'], bon: 2, ok: `On ne peut ni prendre ni couvrir deux échecs à la fois. C'est ce qui rend l'échec double si fort.` },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>Une de tes pièces est devant ta tour, ton fou ou ta dame ? Regarde ce qui se passe si elle bouge.</li><li>La pièce qui s'écarte doit créer <b>sa propre menace</b> : échec ou attaque d'une grosse pièce.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: '6k1/ppq2ppp/8/8/8/8/PPB2PPP/2R3K1 w - - 0 1', h: `<p>Trouve l'attaque à la découverte.</p>`, sol: ['c2h7', 'g8h7', 'c1c7'] },
          { t: 'trouve', fen: '3k4/1p3ppp/8/q7/3N4/8/PP3PPP/3R2K1 w - - 0 1', h: `<p>Trouve l'échec à la découverte qui gagne la dame.</p>`, sol: ['d4c6', 'd8c7', 'c6a5'], alt: ['d4b3'] },
        ],
        pioche: { theme: 'discoveredAttack', n: 3 },
      },
    ],
  },
  // ====================================================================================
  {
    id: 'm3', titre: 'Les mats à connaître', resume: 'Savoir conclure. Les mats élémentaires se travaillent contre le moteur jusqu\'à devenir automatiques.',
    lecons: [
      {
        id: 'couloir', titre: 'Le mat du couloir', duree: 6, cat: ['missedMate', 'allowedMate'], theme: 'backRankMate',
        but: 'Reconnaître le roi enfermé derrière ses pions, pour mater… et pour ne pas l\'être.',
        etapes: [
          { t: 'trouve', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', h: `<p>Le roi noir est enfermé derrière ses trois pions. Un échec sur la dernière rangée, et il n'a aucune case.</p>`, sol: ['d1d8'], ok: `C'est le mat du couloir, le mat le plus fréquent chez les amateurs.` },
          { t: 'trouve', fen: '3r2k1/5ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1', h: `<p>Ici la tour noire garde la dernière rangée. Mais tu as <b>deux</b> pièces sur la colonne e. Mat en deux coups.</p>`, sol: ['e2e8', 'd8e8', 'e1e8'], indice: 'Tu peux donner ta dame.', ok: `La dame se sacrifie pour attirer le défenseur, la tour mate.` },
          { t: 'qcm', fen: '4r1k1/5pp1/7p/8/8/8/5PPP/R5K1 w - - 0 1', h: `<p>Les Noirs ont joué h6 : leur roi a une case de fuite. Et toi ? Quel coup te protège pour de bon du mat du couloir ?</p>`, choix: ['h3 : une case de fuite pour mon roi', 'Ta7 : j\'attaque', 'Rh1'], bon: 0, ok: `Un petit coup de pion (h3 ou g3) au bon moment, et tes tours sont libres de quitter la première rangée.` },
          { t: 'qcm', fen: '6k1/5pp1/7p/8/8/8/5PPP/3R2K1 w - - 0 1', fl: ['d1d8:hint'], h: `<p>Td8+ : est-ce mat ?</p>`, choix: ['Oui', 'Non : le roi s\'échappe en h7'], bon: 1 },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>Roi adverse derrière trois pions sans case de fuite : cherche l'échec sur la dernière rangée.</li><li>Un défenseur ? Compte tes pièces lourdes sur la colonne.</li><li>Pour toi : avant de sortir tes tours, vérifie que ton roi a de l'air.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', h: `<p>Mat en un coup.</p>`, sol: ['e1e8'] },
          { t: 'trouve', fen: '2r3k1/5ppp/8/8/8/8/3Q1PPP/3R2K1 w - - 0 1', h: `<p>Mat en deux coups.</p>`, sol: ['d2d8', 'c8d8', 'd1d8'] },
          { t: 'qcm', fen: '4r1k1/p4ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', h: `<p>Peux-tu prendre le pion a7 avec ta tour ?</p>`, choix: ['Oui', 'Non : ma tour quitte la première rangée et je suis mat'], bon: 1 },
        ],
        pioche: { theme: 'backRankMate', n: 2 },
      },
      {
        id: 'berger', titre: 'Le mat du berger et sa parade', duree: 7, cat: ['allowedMate'], theme: 'mateIn1',
        but: 'Ne plus jamais tomber dans le piège de la dame sortie trop tôt, et savoir le punir.',
        etapes: [
          { t: 'demo', fen: START, h: `<p>Le <b>mat du berger</b> : dame et fou visent ensemble la case f7, défendue seulement par le roi. Regarde ce qui arrive si les Noirs ne font pas attention.</p>`, coups: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'], ok: `Mat en quatre coups. Le cavalier attaquait la dame, mais il fallait d'abord regarder la menace.` },
          { t: 'trouve', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', h: `<p>Tu as les Noirs. La dame et le fou blancs visent f7 : c'est mat au prochain coup. Pare la menace en chassant la dame avec un pion.</p>`, sol: ['g7g6'], alt: ['d8e7', 'd8f6', 'g8h6'], indice: 'Chasse la dame.', ok: `g6 ferme la route vers f7 et attaque la dame.` },
          { t: 'trouve', fen: 'r1bqkbnr/pppp1p1p/2n3p1/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 1 4', h: `<p>La dame recule en f3 et menace de nouveau f7. Pare en développant une pièce.</p>`, sol: ['g8f6'], alt: ['d8f6', 'd8e7', 'g8h6'], ok: `Le cavalier bloque la colonne f. Les Noirs ont maintenant deux pièces sorties, les Blancs ont perdu du temps avec leur dame.` },
          { t: 'trouve', fen: 'rnb1k1nr/pppp1ppp/8/2b1p3/2B1P2q/2N5/PPPP1PPP/R1BQK1NR w KQkq - 4 4', h: `<p>Maintenant c'est toi qui subis : la dame noire et le fou c5 visent f2. Défends avec un coup qui développe.</p>`, sol: ['d1e2'], alt: ['d1f3'], indice: 'Ta dame peut protéger f2.' },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>f7 (f2 pour les Blancs) est la case fragile du début de partie.</li><li>Dame adverse sortie tôt : pare la menace, puis développe-toi <b>en l'attaquant</b>. Tu gagnes du temps à chaque coup.</li><li>Toi, ne sors pas ta dame avant tes cavaliers et tes fous.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', h: `<p>Les Noirs viennent de jouer Cf6. Punis-les.</p>`, sol: ['h5f7'] },
          { t: 'trouve', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 3 3', h: `<p>Tu as les Noirs. Pare la menace en développant une pièce.</p>`, sol: ['g8f6'], alt: ['d8f6', 'd8e7', 'g8h6'] },
          { t: 'qcm', h: `<p>Ton adversaire sort sa dame au 2e coup. Quelle est la bonne attitude ?</p>`, choix: ['Sortir ma dame aussi', 'Parer la menace, puis développer mes pièces en attaquant sa dame', 'Avancer tous mes pions'], bon: 1 },
        ],
      },
      {
        id: 'escalier', titre: 'Deux tours : le mat de l\'escalier', duree: 6, cat: ['missedMate'], theme: 'mateIn2',
        but: 'Mater avec deux tours sans même avoir besoin du roi.',
        etapes: [
          { t: 'demo', fen: '7k/8/8/8/8/8/1R6/R5K1 w - - 0 1', h: `<p>Deux tours matent toutes seules : l'une <b>coupe</b> une rangée, l'autre donne échec sur la suivante. On monte comme sur un escalier.</p>`, coups: ['a1a7', 'h8g8', 'b2b8'], ok: `La tour a7 interdit la 7e rangée, la tour b8 mate sur la 8e.` },
          { t: 'trouve', fen: '6k1/R7/8/8/8/8/1R6/6K1 w - - 0 1', h: `<p>La 7e rangée est coupée. Termine.</p>`, sol: ['b2b8'] },
          { t: 'partie', fen: '8/8/8/3k4/8/8/8/RR4K1 w - - 0 1', but: 'mat', max: 15, h: `<p>À toi contre le moteur. Coupe une rangée, donne échec sur la suivante, et recommence. Si le roi s'approche d'une tour, éloigne-la à l'autre bout.</p>` },
        ],
        controle: [
          { t: 'partie', fen: '8/8/4k3/8/8/8/8/R5KR w - - 0 1', but: 'mat', max: 15, h: `<p>Mate avec tes deux tours, en 15 coups maximum.</p>` },
        ],
      },
      {
        id: 'dame-roi', titre: 'Dame et roi contre roi', duree: 9, cat: ['missedMate'], theme: 'mateIn1',
        but: 'Le mat qu\'il faut savoir faire les yeux fermés quand tu as promu un pion.',
        etapes: [
          { t: 'texte', fen: '8/8/8/4k3/8/8/8/KQ6 w - - 0 1', h: `<p>La méthode en trois temps :</p><ol><li><b>Enferme</b> le roi : place ta dame à un saut de cavalier de lui. À chaque coup qu'il joue, suis-le en gardant cette distance : sa « boîte » rétrécit.</li><li>Quand il est coincé au bord, <b>arrête-toi</b> et approche ton roi.</li><li>Ton roi en face du sien : la dame mate.</li></ol>` },
          { t: 'trouve', fen: '7k/8/6K1/8/8/8/8/1Q6 w - - 0 1', h: `<p>La fin d'abord. Ton roi est arrivé : mate en un coup.</p>`, sol: ['b1b8'], ok: `Le roi protège g7 et h7, la dame fait le reste.` },
          { t: 'qcm', fen: '7k/8/8/6Q1/8/8/8/K7 w - - 0 1', fl: ['g5g6:bad'], h: `<p>Le piège : le <b>pat</b>. Si le roi adverse n'est pas en échec et n'a plus aucun coup, la partie est nulle. Dg6 est-il un bon coup ici ?</p>`, choix: ['Oui, je resserre l\'étau', 'Non : le roi noir n\'a plus de coup, c\'est pat'], bon: 1, ok: `Dès que le roi est au bord, laisse-lui toujours une case et amène ton roi.` },
          { t: 'partie', fen: '8/8/8/4k3/8/8/8/KQ6 w - - 0 1', but: 'mat', max: 25, h: `<p>À toi contre le moteur. Enferme, approche le roi, mate. Attention au pat !</p>` },
        ],
        controle: [
          { t: 'partie', fen: '8/8/8/3k4/8/8/8/KQ6 w - - 0 1', but: 'mat', max: 25, h: `<p>Mate avec dame et roi, en 25 coups maximum.</p>` },
        ],
      },
      {
        id: 'tour-roi', titre: 'Tour et roi contre roi', duree: 10, cat: ['missedMate'], theme: 'mateIn2',
        but: 'Plus long que la dame, mais la même logique : couper, approcher, mater.',
        etapes: [
          { t: 'texte', fen: '8/8/8/4k3/8/8/8/R6K w - - 0 1', h: `<p>Avec une tour, ton roi doit travailler :</p><ol><li>La tour <b>coupe</b> le roi adverse sur une rangée ou une colonne.</li><li>Ton roi avance jusqu'à se trouver <b>en face</b> du sien, à un saut de cavalier puis en opposition.</li><li>Quand les rois sont face à face : échec de la tour, il doit reculer.</li><li>S'il te faut passer ton tour : joue un coup d'attente avec la tour, sur la même ligne.</li></ol>` },
          { t: 'trouve', fen: '3k4/8/3K4/8/8/8/8/7R w - - 0 1', h: `<p>Les rois sont face à face, le roi noir est au bord. Mate.</p>`, sol: ['h1h8'] },
          { t: 'trouve', fen: '2k5/8/3K4/8/8/8/8/7R w - - 0 1', h: `<p>Ici les rois ne sont pas en face. Trouve le coup de tour qui oblige le roi noir à venir se placer devant le tien. Mat en deux.</p>`, sol: ['h1b1', 'c8d8', 'b1b8'], indice: 'Retire-lui la colonne b.', ok: `La tour coupe la fuite, le roi n'a qu'un coup… et il vient se faire mater.` },
          { t: 'partie', fen: '8/8/8/4k3/8/8/8/R6K w - - 0 1', but: 'mat', max: 40, h: `<p>À toi contre le moteur. Prends ton temps : couper, approcher le roi, échec quand les rois sont face à face.</p>` },
        ],
        controle: [
          { t: 'partie', fen: '8/8/8/8/3k4/8/8/K6R w - - 0 1', but: 'mat', max: 40, h: `<p>Mate avec tour et roi, en 40 coups maximum.</p>` },
        ],
      },
    ],
  },
  // ====================================================================================
  {
    id: 'm4', titre: 'Bien débuter la partie', resume: 'Pas de théorie à apprendre par cœur : trois principes, quelques pièges à connaître et un répertoire simple.',
    lecons: [
      {
        id: 'principes', titre: 'Les trois principes d\'ouverture', duree: 7, cat: ['other'], theme: 'opening',
        but: 'Sortir de l\'ouverture avec une bonne position, sans rien connaître par cœur.',
        etapes: [
          { t: 'texte', fen: START, h: `<p>Dans les dix premiers coups, tu n'as que trois choses à faire :</p><ol><li><b>Le centre</b> : occupe-le avec un ou deux pions (e4, d4).</li><li><b>Le développement</b> : sors cavaliers et fous, une pièce par coup.</li><li><b>Le roi</b> : roque tôt.</li></ol>` },
          { t: 'demo', fen: START, h: `<p>Voici un début de partie modèle des deux côtés. Compte : en six coups, chaque camp a un pion au centre, trois pièces sorties et le roi à l'abri.</p>`, coups: ITALIENNE },
          { t: 'qcm', apres: ['e2e4', 'e7e5'], h: `<p>1. e4 e5. Quel est le meilleur deuxième coup pour les Blancs ?</p>`, choix: ['Cf3 : je sors une pièce et j\'attaque e5', 'Dh5 : je sors ma dame', 'a4 : j\'avance un pion du bord'], bon: 0, ok: `Un coup qui développe <b>et</b> qui menace : c'est l'idéal.` },
          { t: 'qcm', apres: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'd2d3', 'h7h6'], h: `<p>Tu as sorti cavalier et fou. Et maintenant ?</p>`, choix: ['Roquer : le roi à l\'abri, la tour en jeu', 'Fb5 : rejouer le fou', 'h4 : lancer l\'attaque'], bon: 0, ok: `Ne joue pas deux fois la même pièce tant que les autres dorment.` },
          { t: 'qcm', h: `<p>Laquelle de ces habitudes fait perdre le plus de parties dans l'ouverture ?</p>`, choix: ['Roquer trop tôt', 'Sortir la dame très tôt et la faire chasser par les pièces adverses', 'Mettre un pion au centre'], bon: 1 },
          { t: 'texte', h: `<p><b>Ta check-list d'ouverture</b></p><ul><li>Un pion au centre.</li><li>Cavaliers avant fous, dame en dernier.</li><li>Roque avant le 10e coup.</li><li>Relie tes tours : plus rien entre elles sur la première rangée.</li></ul>` },
        ],
        controle: [
          { t: 'qcm', apres: ['e2e4', 'e7e5', 'g1f3'], h: `<p>Tu as les Noirs. Ton pion e5 est attaqué. Le meilleur coup ?</p>`, choix: ['Cc6 : je défends en développant', 'f6 : je défends avec un pion', 'Dh4'], bon: 0 },
          { t: 'qcm', h: `<p>Dans quel ordre sortir ses pièces, en général ?</p>`, choix: ['Dame, tours, puis le reste', 'Cavaliers et fous, roque, puis dame et tours', 'Tous les pions d\'abord'], bon: 1 },
          { t: 'qcm', apres: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'], h: `<p>Quel coup respecte le mieux les principes ?</p>`, choix: ['Cg5', 'c3 ou d3, puis le roque', 'Fd5'], bon: 1 },
          { t: 'qcm', h: `<p>Pourquoi roquer tôt ?</p>`, choix: ['Pour mettre le roi à l\'abri et faire entrer une tour en jeu', 'Parce que c\'est obligatoire', 'Pour attaquer'], bon: 0 },
        ],
      },
      {
        id: 'pieges', titre: 'Les pièges d\'ouverture', duree: 9, cat: ['allowedMate', 'allowedTactic'], theme: 'opening',
        but: 'Connaître les quatre pièges classiques qu\'on te tendra tôt ou tard.',
        etapes: [
          { t: 'demo', fen: START, h: `<p><b>Le mat de l'idiot</b> : le mat le plus rapide. Les pions f et g protègent ton roi : ne les avance pas sans raison.</p>`, coups: ['f2f3', 'e7e5', 'g2g4', 'd8h4'] },
          { t: 'trouve', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4', h: `<p><b>L'attaque sur f7.</b> Tu as les Noirs. Cavalier et fou visent f7 : la fourchette roi-tour menace. Un seul coup coupe le fou.</p>`, sol: ['d7d5'], indice: 'Ferme la diagonale du fou c4 avec un pion.', ok: `d5 bloque le fou. Après exd5, ne reprends pas avec le cavalier : joue Ca5 pour chasser le fou.` },
          { t: 'demo', fen: START, h: `<p><b>Le mat de Légal.</b> Le cavalier f3 semble cloué sur la dame… mais il bouge quand même, et si les Noirs prennent la dame, ils sont mat.</p>`, coups: LEGAL, ok: `Un clouage sur la dame n'est pas un vrai clouage : vérifie toujours ce que la pièce « clouée » peut faire.` },
          { t: 'qcm', apres: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'c6d4'], fl: ['f3e5:hint'], h: `<p><b>Le pion empoisonné.</b> Les Noirs viennent de jouer Cd4 et laissent e5 sans défense. Tu prends ?</p>`, choix: ['Oui : Cxe5, un pion gratuit', 'Non : c\'est trop beau, je joue Cxd4 ou je roque'], bon: 1 },
          { t: 'demo', apres: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'c6d4'], o: 'w', h: `<p>Voici ce qui arrive à ceux qui prennent.</p>`, coups: ['f3e5', 'd8g5', 'e5f7', 'g5g2', 'h1f1', 'g2e4', 'c4e2', 'd4f3'], ok: `Quand un pion semble offert dans l'ouverture, fais ta routine avant de prendre.` },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>Ne touche pas aux pions f et g devant ton roi.</li><li>f7 et f2 sont les cases fragiles : surveille ce qui les vise.</li><li>Un cadeau dans l'ouverture ? Échecs, prises, menaces… puis décide.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', h: `<p>Tu as les Noirs. Punis.</p>`, sol: ['d8h4'] },
          { t: 'trouve', apres: LEGAL.slice(0, 12), h: `<p>Termine le mat de Légal.</p>`, sol: ['c3d5'] },
          { t: 'trouve', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4', h: `<p>Tu as les Noirs. Pare l'attaque sur f7.</p>`, sol: ['d7d5'] },
        ],
      },
      {
        id: 'repertoire', titre: 'Un répertoire simple', duree: 10, cat: ['other'], theme: 'opening',
        but: 'Une ouverture avec les Blancs, une réponse contre e4 et une contre d4 : de quoi jouer toutes tes parties.',
        etapes: [
          { t: 'demo', fen: START, h: `<p><b>Avec les Blancs : l'Italienne tranquille.</b> Centre, cavalier, fou, puis c3 et d3 pour une position solide, et le roque.</p>`, coups: ITALIENNE, ok: `Ton plan ensuite : Te1, le cavalier b1 passe par d2 et f1 vers g3, puis h3. Aucun risque, et toutes tes pièces jouent.` },
          { t: 'trouve', fen: START, strict: true, h: `<p>Rejoue les coups des Blancs de l'Italienne tranquille. Les Noirs répondent tout seuls.</p>`, sol: ITALIENNE.slice(0, 11), indice: 'e4, Cf3, Fc4, c3, d3, roque.' },
          { t: 'texte', apres: ITALIENNE, o: 'b', h: `<p><b>Avec les Noirs contre 1. e4</b> : la même position, de l'autre côté. Réponds e5, sors Cc6, Fc5, Cf6, joue d6 et roque. Tu connais déjà les pièges : f7, la dame sortie tôt, le pion empoisonné.</p>` },
          { t: 'demo', fen: START, o: 'b', h: `<p><b>Avec les Noirs contre 1. d4</b> : le Gambit dame refusé. Un pion en d5, soutenu par e6, puis le développement naturel.</p>`, coups: GDR, ok: `Solide comme un mur. Ton plan : Cbd7, c6, puis libérer ton jeu avec dxc4 suivi de c5 ou e5.` },
          { t: 'trouve', fen: START, strict: true, o: 'b', camp: 'b', h: `<p>Rejoue les coups des Noirs du Gambit dame refusé. Les Blancs jouent tout seuls.</p>`, sol: GDR, indice: 'd5, e6, Cf6, Fe7, roque.' },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>Joue <b>toujours les mêmes ouvertures</b> pendant quelques mois : tu retrouveras les mêmes positions et tu progresseras plus vite.</li><li>Quand l'adversaire sort du chemin, reviens aux trois principes.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: START, strict: true, h: `<p>De mémoire : l'Italienne tranquille avec les Blancs.</p>`, sol: ITALIENNE.slice(0, 11) },
          { t: 'trouve', fen: START, strict: true, o: 'b', camp: 'b', h: `<p>De mémoire : le Gambit dame refusé avec les Noirs.</p>`, sol: GDR },
        ],
      },
    ],
  },
  // ====================================================================================
  {
    id: 'm5', titre: 'Les finales de base', resume: 'Deux règles qui décident de la plupart des finales de pions : le carré et l\'opposition.',
    lecons: [
      {
        id: 'carre', titre: 'La règle du carré', duree: 7, cat: ['other'], theme: 'pawnEndgame',
        but: 'Savoir sans calculer si un roi rattrape un pion qui file à dame.',
        etapes: [
          { t: 'texte', fen: '8/8/8/8/1P4k1/8/8/7K b - - 0 1', o: 'w', mq: { b4: 'hint', c4: 'hint', d4: 'hint', e4: 'hint', f4: 'hint', b8: 'hint', c8: 'hint', d8: 'hint', e8: 'hint', f8: 'hint', b5: 'hint', b6: 'hint', b7: 'hint', f5: 'hint', f6: 'hint', f7: 'hint' }, h: `<p>Trace un <b>carré</b> qui part du pion et va jusqu'à sa case de promotion (ici de b4 à b8, donc jusqu'à la colonne f).</p><p>Si le roi adverse peut <b>entrer dans le carré</b> à son tour de jouer, il rattrape le pion. Sinon, le pion va à dame. La règle vaut quand l'autre roi est trop loin pour aider son pion.</p>` },
          { t: 'qcm', fen: '8/8/8/8/1P4k1/8/8/7K b - - 0 1', o: 'w', h: `<p>Trait aux <b>Noirs</b>. Le roi noir rattrape-t-il le pion ?</p>`, choix: ['Oui : il entre dans le carré en jouant sur la colonne f', 'Non, il est trop loin'], bon: 0 },
          { t: 'qcm', fen: '8/8/8/8/1P4k1/8/8/7K w - - 0 1', h: `<p>Même position, mais trait aux <b>Blancs</b>. Le pion avance d'abord : le carré rétrécit. Le roi le rattrape-t-il ?</p>`, choix: ['Oui', 'Non : après b5, le carré s\'arrête à la colonne e et le roi reste dehors'], bon: 1, ok: `Un seul temps change tout. Compte toujours <b>à qui est le trait</b>.` },
          { t: 'trouve', fen: '8/8/8/6k1/1P6/8/8/7K b - - 0 1', h: `<p>Tu as les Noirs. Entre dans le carré.</p>`, sol: ['g5f6'], alt: ['g5f5', 'g5f4'] },
          { t: 'partie', fen: '8/8/8/6k1/1P6/8/8/7K b - - 0 1', camp: 'b', but: 'nulle', max: 12, h: `<p>Va au bout : rattrape et prends le pion contre le moteur. Reste dans le carré à chaque coup.</p>` },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>Pion qui file : trace le carré, regarde si le roi peut y entrer.</li><li>Sur sa case de départ, le pion avance de deux cases : trace le carré comme s'il était déjà une case plus loin.</li></ul>` },
        ],
        controle: [
          { t: 'qcm', fen: '8/8/8/7k/P7/8/8/7K b - - 0 1', o: 'w', h: `<p>Trait aux Noirs. Le roi noir rattrape-t-il le pion a4 ?</p>`, choix: ['Oui', 'Non'], bon: 1 },
          { t: 'qcm', fen: '8/8/8/5k2/P7/8/8/7K b - - 0 1', o: 'w', h: `<p>Trait aux Noirs. Et maintenant ?</p>`, choix: ['Oui', 'Non'], bon: 0 },
          { t: 'partie', fen: '8/8/8/5k2/P7/8/8/7K b - - 0 1', camp: 'b', but: 'nulle', max: 12, h: `<p>Prouve-le : rattrape le pion.</p>` },
        ],
      },
      {
        id: 'opposition', titre: 'Roi et pion contre roi', duree: 10, cat: ['other'], theme: 'pawnEndgame',
        but: 'Savoir quand un pion de plus gagne, et comment annuler quand c\'est toi qui défends.',
        etapes: [
          { t: 'texte', fen: '8/8/4k3/8/4K3/8/8/8 w - - 0 1', fl: ['e4e6:hint'], h: `<p>Deux rois face à face avec une case entre eux sont en <b>opposition</b>. Celui qui <b>n'est pas au trait</b> « a l'opposition » : l'autre doit s'écarter et laisser passer.</p><p>C'est la clé de toutes les finales de pions.</p>` },
          { t: 'texte', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', h: `<p><b>Pour gagner</b> : ton roi doit passer <b>devant</b> ton pion. Roi sur la 6e rangée devant son pion : c'est gagné, quel que soit le trait.</p>` },
          { t: 'partie', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', but: 'promo', max: 12, h: `<p>Amène ce pion à dame contre le moteur. Écarte ton roi d'un côté, puis avance le pion sans jamais laisser le roi noir se placer devant lui.</p>` },
          { t: 'trouve', fen: '8/8/4k3/8/3KP3/8/8/8 b - - 0 1', h: `<p><b>Pour annuler</b> : tu as les Noirs. Le roi blanc est à côté de son pion, pas devant. Un seul coup tient : prends l'opposition.</p>`, sol: ['e6d6'], indice: 'Place ton roi en face du sien.', ok: `Face à face : le roi blanc ne passe pas.` },
          { t: 'partie', fen: '8/4k3/8/8/4P3/4K3/8/8 w - - 0 1', camp: 'b', but: 'nulle', max: 30, h: `<p>Défends cette finale contre le moteur. La recette : reste <b>devant le pion</b>, et quand le roi blanc avance, mets-toi <b>en face de lui</b>. Quand tu dois reculer, recule tout droit.</p>` },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>Attaquant : le roi <b>devant</b> le pion, jamais derrière.</li><li>Défenseur : devant le pion, et en opposition dès que possible.</li><li>Le pion de tour (colonnes a et h) annule presque toujours si le roi défenseur atteint le coin.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: '4k3/8/8/4K3/4P3/8/8/8 b - - 0 1', h: `<p>Tu as les Noirs. Un seul coup annule.</p>`, sol: ['e8e7'] },
          { t: 'partie', fen: '4k3/8/8/4K3/8/4P3/8/8 w - - 0 1', but: 'promo', max: 18, h: `<p>Gagne cette finale : fais une dame.</p>` },
          { t: 'partie', fen: '8/8/8/4k3/8/4P3/4K3/8 w - - 0 1', camp: 'b', but: 'nulle', max: 30, h: `<p>Tu as les Noirs. Tiens la nulle.</p>` },
        ],
      },
    ],
  },
  // ====================================================================================
  {
    id: 'm6', titre: 'Construire un plan', resume: 'Que jouer quand il n\'y a rien à prendre ? Deux habitudes simples qui remplacent les coups au hasard.',
    lecons: [
      {
        id: 'pire-piece', titre: 'Améliorer sa plus mauvaise pièce', duree: 7, cat: ['other'], theme: 'middlegame',
        but: 'Toujours avoir un coup utile à jouer, même sans tactique.',
        etapes: [
          { t: 'texte', h: `<p>Ta routine ne trouve ni échec, ni prise, ni menace ? Pose-toi une seule question :</p><p><b>« Quelle est ma pièce la moins active, et où serait-elle mieux ? »</b></p><p>Une pièce est active quand elle contrôle beaucoup de cases, vise le camp adverse et ne gêne pas les autres.</p>` },
          { t: 'case', fen: 'r2q1rk1/ppp2ppp/2nb1n2/3p4/3P4/2PB1N2/PP3PPP/RNBQ1RK1 w - - 0 1', h: `<p>Les Blancs ont roqué mais n'ont pas fini leur développement. Touche une pièce qui n'a pas encore joué.</p>`, cases: ['b1', 'c1'], ok: `Cavalier b1 et fou c1 dorment encore, et ils enferment la tour a1. Les sortir est ton plan pour les prochains coups.` },
          { t: 'qcm', fen: '6k1/ppp2ppp/8/8/8/8/PPP2PPP/R5K1 w - - 0 1', h: `<p>Où ta tour est-elle la plus utile ?</p>`, choix: ['En a1, derrière son pion', 'Sur une colonne ouverte (d ou e), sans pion devant elle', 'En b1'], bon: 1, ok: `Une tour a besoin d'une <b>colonne ouverte</b> pour entrer dans le camp adverse.` },
          { t: 'trouve', fen: 'r5k1/pp3pp1/7p/8/8/8/PP3PPP/3R2K1 w - - 0 1', h: `<p>Ta tour est déjà sur la colonne ouverte. Où va-t-elle maintenant ?</p>`, sol: ['d1d7'], indice: 'La rangée où dorment les pions adverses.', ok: `La <b>7e rangée</b> : la tour attaque les pions par le côté et enferme le roi.` },
          { t: 'qcm', h: `<p>Ton cavalier est en a3, au bord. Pourquoi est-ce une mauvaise case ?</p>`, choix: ['Au bord, il contrôle deux fois moins de cases qu\'au centre', 'Il gêne la tour', 'Ce n\'est pas une mauvaise case'], bon: 0, ok: `« Cavalier au bord, cavalier mort. » Ramène-le vers le centre.` },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>Rien de tactique ? Améliore ta plus mauvaise pièce.</li><li>Tours : colonnes ouvertes, puis 7e rangée.</li><li>Cavaliers : au centre. Fous : sur de longues diagonales libres.</li></ul>` },
        ],
        controle: [
          { t: 'trouve', fen: 'r5k1/pp3pp1/7p/8/8/8/PP3PPP/4R1K1 w - - 0 1', h: `<p>Active ta tour au maximum.</p>`, sol: ['e1e7'] },
          { t: 'qcm', h: `<p>Tu n'as ni échec, ni prise, ni menace à parer. Que fais-tu ?</p>`, choix: ['J\'avance un pion devant mon roi', 'J\'améliore ma pièce la moins active', 'Je déplace ma dame au hasard'], bon: 1 },
          { t: 'qcm', h: `<p>Quelle est la meilleure place pour une tour ?</p>`, choix: ['Derrière ses propres pions', 'Sur une colonne ouverte', 'Dans un coin'], bon: 1 },
        ],
      },
      {
        id: 'simplifier', titre: 'Gagner une partie gagnée', duree: 6, cat: ['other', 'hanging'], theme: 'endgame',
        but: 'Convertir un avantage matériel sans se faire remonter.',
        etapes: [
          { t: 'texte', h: `<p>Tu as une pièce de plus ? La partie n'est pas finie, mais la méthode est simple :</p><ol><li><b>Échange les pièces</b> (pas les pions) : plus il reste peu de pièces, plus ton avantage pèse.</li><li><b>Sécurité d'abord</b> : pas d'aventure, ton roi à l'abri.</li><li><b>Pas de précipitation</b> : la routine à chaque coup, comme si la partie était égale.</li></ol>` },
          { t: 'trouve', fen: '6k1/5pp1/4p2p/3q4/8/8/Q4PPP/R5K1 w - - 0 1', h: `<p>Tu as une tour de plus. Les dames se font face : simplifie.</p>`, sol: ['a2d5'], ok: `Sans les dames, plus de contre-jeu : ta tour va gagner tranquillement.` },
          { t: 'qcm', h: `<p>Tu as une tour de plus. Ton adversaire te propose d'échanger les dames. Tu acceptes ?</p>`, choix: ['Oui : chaque échange de pièces me rapproche du gain', 'Non : je garde ma dame pour attaquer'], bon: 0 },
          { t: 'qcm', h: `<p>À l'inverse, tu as une pièce de <b>moins</b>. Que cherches-tu ?</p>`, choix: ['Échanger les pièces au plus vite', 'Garder les pièces, compliquer le jeu et viser son roi', 'Abandonner'], bon: 1, ok: `À ton niveau, l'adversaire fera encore des erreurs. Ne lui simplifie pas la tâche.` },
          { t: 'texte', h: `<p><b>À retenir</b></p><ul><li>En avance : échange les pièces, garde les pions.</li><li>En retard : garde les pièces, cherche les complications.</li><li>Dans tous les cas : n'abandonne pas ta routine parce que « c'est gagné ».</li></ul>` },
        ],
        controle: [
          { t: 'qcm', h: `<p>Tu as un cavalier de plus. Que cherches-tu à échanger ?</p>`, choix: ['Les pions', 'Les pièces', 'Rien'], bon: 1 },
          { t: 'qcm', fen: '7k/8/8/6Q1/8/8/8/K7 w - - 0 1', h: `<p>Tu as une dame de plus. Dg6 est-il un bon coup ?</p>`, choix: ['Oui', 'Non : c\'est pat, la partie est nulle'], bon: 1 },
          { t: 'qcm', h: `<p>Tu viens de gagner une pièce. Quel est le plus grand danger ?</p>`, choix: ['Me relâcher et oublier ma routine', 'Manquer de temps', 'Aucun'], bon: 0 },
        ],
      },
    ],
  },
  // ====================================================================================
  {
    id: 'm7', titre: 'Face à un humain', resume: 'Contre un vrai adversaire, la moitié du jeu est dans la tête : la pendule, les nerfs, la gaffe qu\'on vient de faire.',
    lecons: [
      {
        id: 'sang-froid', titre: 'Garder son sang-froid', duree: 6, cat: ['hanging', 'other'], theme: 'mix',
        but: 'Jouer contre un humain comme tu joues contre un personnage de Caïssa.',
        etapes: [
          { t: 'texte', h: `<p>Contre un humain, on joue souvent moins bien que contre une machine. Pas parce qu'on est moins fort : parce qu'on <b>abandonne sa méthode</b>. On joue vite parce qu'il joue vite, on panique après une erreur, on a peur de son classement.</p><p>La parade tient en une phrase : <b>joue la position, pas l'adversaire.</b></p>` },
          { t: 'qcm', h: `<p>Ton adversaire joue ses coups en deux secondes. Que fais-tu ?</p>`, choix: ['Je joue vite aussi pour ne pas le laisser prendre l\'avantage à la pendule', 'Je garde mon rythme : ma routine à chaque coup', 'Je propose nulle'], bon: 1, ok: `Sa vitesse est son problème. En 15 + 10, tu as largement le temps de faire ta routine à chaque coup.` },
          { t: 'qcm', h: `<p>Tu viens de perdre une pièce sur une gaffe. Quelle est la meilleure réaction ?</p>`, choix: ['Jouer vite pour passer à autre chose', 'Abandonner tout de suite', 'Respirer, lâcher la pendule des yeux dix secondes, puis reprendre la routine'], bon: 2, ok: `Entre 800 et 1200, l'adversaire rend très souvent la pièce. Mais la gaffe qui suit une gaffe, elle, est presque toujours fatale.` },
          { t: 'qcm', h: `<p>Où dépenser ton temps de réflexion ?</p>`, choix: ['Le même temps sur chaque coup', 'Sur les coups qui changent la position : prises, échecs, poussées de pions', 'Surtout dans l\'ouverture'], bon: 1 },
          { t: 'qcm', h: `<p>Ton adversaire a 300 points de plus que toi. Comment jouer ?</p>`, choix: ['Chercher la nulle dès le début', 'Exactement comme d\'habitude : les pièces ne connaissent pas son classement', 'Attaquer à tout prix'], bon: 1 },
          { t: 'texte', h: `<p><b>Ton rituel de partie</b></p><ul><li>Avant : une cadence lente (15 + 10), et trois problèmes faciles pour s'échauffer.</li><li>Pendant : la routine à chaque coup, une respiration avant chaque coup important.</li><li>Après : analyse la partie, gagnée ou perdue, et demande le débrief du professeur.</li></ul><p>Pour t'entraîner : les personnages de 1100 à 1900 jouent — et se trompent — comme des humains.</p>` },
        ],
        controle: [
          { t: 'qcm', h: `<p>L'adversaire joue très vite. Tu…</p>`, choix: ['accélères', 'gardes ton rythme'], bon: 1 },
          { t: 'qcm', h: `<p>Tu viens de gaffer une pièce. Tu…</p>`, choix: ['respires et reprends ta routine', 'joues vite pour te rattraper', 'abandonnes'], bon: 0 },
          { t: 'qcm', h: `<p>Quelle cadence choisir pour progresser ?</p>`, choix: ['1 minute', '5 minutes', '15 minutes + 10 secondes par coup'], bon: 2 },
          { t: 'qcm', h: `<p>Après une partie perdue, tu…</p>`, choix: ['en relances une tout de suite pour te refaire', 'l\'analyses pour trouver le moment où elle a basculé'], bon: 1 },
        ],
      },
    ],
  },
];

export const LECONS = MODULES.flatMap(m => m.lecons.map(l => ({ ...l, module: m })));
export function leconById(id) { return LECONS.find(l => l.id === id) || null; }

// Leçons conseillées pour chaque type d'erreur relevé dans les parties
export const POUR_CATEGORIE = {
  hanging: ['compter', 'valeur', 'routine'],
  missedTactic: ['fourchette', 'clouage', 'enfilade', 'decouverte'],
  missedMate: ['couloir', 'escalier', 'dame-roi', 'tour-roi'],
  allowedMate: ['couloir', 'berger', 'routine', 'pieges'],
  allowedTactic: ['routine', 'fourchette', 'clouage', 'decouverte'],
  other: ['principes', 'pire-piece', 'simplifier', 'repertoire'],
};
