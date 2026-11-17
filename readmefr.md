# Snake multijoueur coopératif

🇬🇧 [English version](README.md)

Un seul serpent sur un écran commun (PC / TV). Jusqu'à **4 joueurs** sur leur téléphone :
chacun contrôle **une seule direction**.

| Couleur | Direction |
|---------|-----------|
| 🟦 Bleu  | Haut |
| 🟥 Rouge | Bas |
| 🟨 Jaune | Gauche |
| 🟩 Vert  | Droite |

Le serpent prend la dernière direction cliquée. Il faut donc se coordonner !

> L'interface du jeu (écran principal et manettes) est en anglais.

## Prérequis

- [Node.js](https://nodejs.org) 18 ou plus récent
- Tous les appareils (PC et téléphones) sur le **même réseau Wi-Fi**

## Lancer le jeu

```bash
cd snake-coop
npm install      # une seule fois
npm start
```

Le terminal affiche deux adresses :

```
Écran principal : http://localhost:3000/
Joueurs (QR)    : http://192.168.x.x:3000/play
```

1. **Écran principal** : ouvrez `http://localhost:3000/` sur le PC (idéalement en plein écran).
2. **Joueurs** : scannez le QR code affiché à droite de l'écran avec le téléphone (ou tapez l'adresse `/play`).
   Chaque téléphone reçoit automatiquement la première couleur libre.
3. **Jouer** : cliquez sur « Play » ou appuyez sur **espace** sur l'écran principal
   (un clic sur un téléphone lance aussi la partie).
4. Touchez l'écran de votre téléphone pour orienter le serpent vers votre direction.
   Il grandit en mangeant les pommes et accélère à chaque pomme.
5. Game over si le serpent touche un mur ou sa queue : **Play again** (espace).

## Modes de difficulté

Choisissez le mode sur l'écran principal avant de lancer la partie (boutons **Easy** / **Hard**).
Le mode ne change pas pendant une partie.

- **Easy** (facile, par défaut) : chaque joueur garde sa direction pendant toute la partie.
- **Hard** (difficile) 🔀 : à chaque clic, le serpent part dans la direction de la couleur affichée,
  puis les 4 directions sont **redistribuées au hasard** entre les joueurs. Chaque joueur voit
  alors sa couleur changer : 1 chance sur 4 de garder la même direction, 3 sur 4 d'en recevoir une autre.

## Règles

- Le demi-tour direct est ignoré (haut puis bas immédiat ne fait rien).
- Score = nombre de pommes mangées ; la vitesse augmente jusqu'à un plafond. Elle est affichée
  en cases par seconde (de 4,5 au départ à 14,3 au maximum, atteint à 19 pommes).
- Une 5ᵉ personne qui se connecte est spectatrice. Une place libérée (téléphone déconnecté)
  est réattribuée au prochain arrivant.
- Sons : générés par le navigateur de l'écran principal. Cliquez une fois sur la page ou
  appuyez sur une touche pour activer le son. Les téléphones vibrent aux clics et au game over.

## Options

| Variable | Rôle | Défaut |
|----------|------|--------|
| `PORT` | Port du serveur | `3000` |
| `PUBLIC_URL` | Adresse encodée dans le QR code (utile si l'IP détectée est mauvaise) | `http://<IP locale>:PORT` |

Exemple : `PORT=8080 PUBLIC_URL=http://192.168.1.20:8080 npm start`

## Dépannage

- **Le téléphone n'arrive pas à se connecter** : vérifiez qu'il est sur le même Wi-Fi (pas en
  4G) et que le pare-feu du PC autorise le port 3000 (ex. Linux : `sudo ufw allow 3000/tcp`).
  Certains Wi-Fi invités isolent les appareils entre eux.
- **Le QR code pointe vers la mauvaise IP** (VPN, plusieurs cartes réseau) : lancez avec `PUBLIC_URL`.
- **Pas de son** : cliquez sur la page de l'écran principal pour débloquer l'audio.
- **Jouer seul** : possible, mais vous ne contrôlez qu'une direction. Ouvrez plusieurs onglets
  sur `/play` pour tester les 4 directions.

## Structure

```
snake-coop/
├── server.js            serveur HTTP + WebSocket + boucle de jeu
├── game.js              logique pure du jeu (mouvement, collisions, pomme)
├── test.js              tests de la logique (npm test)
└── public/
    ├── display.html     écran principal (canvas, QR code, sons)
    └── controller.html  page joueur (couleur plein écran)
```

## Tests

```bash
npm test
```
