# Outils

- `convert.py` + `net.proto` : convertit les réseaux Maia (`maia-XXXX.pb.gz`, format Leela Chess Zero,
  https://github.com/CSSLab/maia-chess) en fichiers `maia/maia-XXXX.bin` lus par `js/maia.js`.
  `python3 -m grpc_tools.protoc -I. --python_out=. net.proto && python3 convert.py maia-1100.pb.gz maia-1100.bin`
- `calibration-match.mjs` (+ `uci.js`) : matchs entre personnages sous Node pour mesurer leur Elo
  (ancrage : Maia 1100 sans filtre = 1100, échelle Lichess). Résultats utilisés dans `js/bots.js`.
