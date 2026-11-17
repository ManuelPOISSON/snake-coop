# Snake multijoueur coopératif

🇬🇧 [English version](README.md)

Un seul serpent sur un écran commun (PC / TV). **2, 3 ou 4 joueurs** sur leur téléphone se
partagent les 4 directions (voir [Nombre de joueurs](#nombre-de-joueurs)). À 4 joueurs, chacun
contrôle **une seule direction**.

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

Le terminal affiche deux adresses (la seconde est celle encodée dans le QR code) :

```
Main display : http://localhost:3000/
Players (QR) : http://192.168.x.x:3000/play
```

**Si le QR code ne fonctionne pas** (l'IP détectée n'est pas celle que les téléphones peuvent
joindre, par exemple sur Eduroam où le PC peut avoir une adresse en `10.x.x.x`), passez l'adresse
IP de votre PC en argument :

```bash
npm start -- 10.1.2.3
```

Le QR code pointe alors vers `http://10.1.2.3:3000/play`. (`--ip 10.1.2.3` et `--ip=10.1.2.3`
fonctionnent aussi. Le `--` est nécessaire pour que npm transmette l'argument au jeu.) Sans IP
donnée, le terminal liste aussi toutes les adresses détectées, pour choisir la bonne.

1. **Écran principal** : ouvrez `http://localhost:3000/` sur le PC (idéalement en plein écran).
2. **Joueurs** : scannez le QR code affiché à droite de l'écran avec le téléphone (ou tapez l'adresse `/play`).
   Chaque téléphone reçoit automatiquement la première couleur libre.
3. **Jouer** : cliquez sur « Play » ou appuyez sur **espace** sur l'écran principal
   (un clic sur un téléphone lance aussi la partie).
4. Touchez l'écran de votre téléphone pour orienter le serpent vers votre direction.
   Il grandit en mangeant les pommes et accélère à chaque pomme.
5. Game over si le serpent touche un mur ou sa queue : **Play again** (espace).

## Nombre de joueurs

Choisissez **2 / 3 / 4 joueurs** (boutons « players ») sur l'écran principal avant de lancer
la partie (4 par défaut). Le choix ne change pas pendant une partie.

| Joueurs | Qui contrôle quoi |
|---------|-------------------|
| 4 | Une direction par joueur. |
| 3 | Un joueur tiré au sort contrôle **2 directions**, les deux autres 1 chacun. |
| 2 | Chaque joueur contrôle **2 directions**. |

- Un téléphone qui a 2 directions voit son écran coupé en **deux moitiés colorées** : touchez la
  moitié de la direction voulue.
- En mode Easy, les directions sont **tirées au sort au début de chaque partie** à 2 ou 3 joueurs
  (à 4 joueurs, l'ordre est fixe : bleu = haut, rouge = bas, jaune = gauche, vert = droite).
- Les téléphones au-delà du nombre choisi sont spectateurs et prennent une place automatiquement
  dès qu'elle se libère (un téléphone part, ou un nombre de joueurs plus grand est choisi).

## Modes de difficulté

Choisissez le mode sur l'écran principal avant de lancer la partie (boutons **Easy** / **Hard**).
Le mode ne change pas pendant une partie.

- **Easy** (facile, par défaut) : chaque joueur garde sa direction pendant toute la partie.
- **Hard** (difficile) 🔀 : à chaque clic, le serpent part dans la direction de la couleur touchée,
  puis les 4 directions sont **entièrement redistribuées au hasard** entre les joueurs. Chaque
  téléphone voit ses couleurs changer. À 3 joueurs, celui qui contrôle 2 directions change aussi.

## Scoreboard (classement)

Après un game over, l'écran principal affiche le **top 10** du mode qui vient d'être joué
(Easy et Hard ont chacun leur classement). Le score de la partie terminée est mis en évidence,
et affiché sous la liste s'il est hors du top 10.

- Chaque partie reçoit un **nom d'animal aléatoire**, mythologique ou non, en anglais
  (ex. « Griffin », « Otter »).
- Le nom d'équipe peut être **modifié** depuis l'écran principal (champ « Team name »,
  Entrée pour valider) ou depuis n'importe quel téléphone (champ + **Save**), jusqu'au début
  de la partie suivante. Les noms sont limités à 20 caractères.
- Les scores de 0 ne sont pas enregistrés.
- Les scores sont sauvegardés dans `scores.json` (100 meilleurs par mode) et rechargés au
  démarrage du serveur : ils survivent donc à un redémarrage. Le fichier est ignoré par git :
  chaque machine garde ses propres scores. Pour remettre le classement à zéro, arrêtez le
  serveur et supprimez le fichier.

## Règles

- Le demi-tour direct est ignoré (haut puis bas immédiat ne fait rien).
- Score = nombre de pommes mangées ; la vitesse augmente jusqu'à un plafond. Elle est affichée
  en cases par seconde (de 4,5 au départ à 14,3 au maximum, atteint à 19 pommes).
- Les téléphones en trop sont spectateurs ; une place libérée va au spectateur qui attend depuis
  le plus longtemps.
- Sons : générés par le navigateur de l'écran principal. Cliquez une fois sur la page ou
  appuyez sur une touche pour activer le son. Les téléphones vibrent aux clics et au game over.

## Options

| Variable | Rôle | Défaut |
|----------|------|--------|
| `PORT` | Port du serveur | `3000` |
| `PUBLIC_URL` | Adresse complète encodée dans le QR code (l'argument IP, s'il est donné, est prioritaire) | `http://<IP locale>:PORT` |
| `SCORES_FILE` | Chemin du fichier de scores | `scores.json` à côté de `server.js` |

Exemple : `PORT=8080 PUBLIC_URL=http://192.168.1.20:8080 npm start`

## Dépannage

- **Le téléphone n'arrive pas à se connecter** : vérifiez qu'il est sur le même Wi-Fi (pas en
  4G) et que le pare-feu du PC autorise le port 3000 (ex. Linux : `sudo ufw allow 3000/tcp`).
  Certains Wi-Fi invités isolent les appareils entre eux.
- **Le QR code pointe vers la mauvaise IP** (VPN, plusieurs cartes réseau, Eduroam) : lancez avec
  l'IP de votre PC, par ex. `npm start -- 10.1.2.3`. Sous Linux, `hostname -I` ou `ip -4 addr`
  affiche vos adresses. Certains réseaux (Eduroam compris) isolent les appareils entre eux : si les
  téléphones ne se connectent toujours pas avec la bonne IP, utilisez le partage de connexion
  d'un téléphone ou un autre Wi-Fi.
- **Pas de son** : cliquez sur la page de l'écran principal pour débloquer l'audio.
- **Jouer seul** : possible, mais vous ne contrôlez que les directions de votre place (avec
  2 joueurs sélectionnés : 2 sur 4). Ouvrez plusieurs onglets sur `/play` pour tester toutes les directions.

## Structure

```
snake-coop/
├── server.js            serveur HTTP + WebSocket + boucle de jeu
├── game.js              logique pure du jeu (mouvement, collisions, pomme, distribution des directions)
├── scores.js            classement persistant (fichier JSON, noms d'animaux aléatoires)
├── test.js              tests de la logique et du classement (npm test)
├── scores.json          créé au premier score enregistré (ignoré par git)
└── public/
    ├── display.html     écran principal (canvas, QR code, sons)
    └── controller.html  page joueur (couleur plein écran)
```

## Tests

```bash
npm test
```
