# 🕹️ PETIT JUEGO

Une borne d'arcade rétro pour apprendre à se connaître à trois. Un téléphone qu'on se passe, vingt mini-jeux en quatre ambiances, un score cumulé sur la soirée et des titres décernés au podium.

**Trois joueurs.** Au lancement, le jeu demande les prénoms de chacun ; « Nouvelle soirée » remet joueurs, scores et titres à zéro.

## Les 20 jeux

| # | Jeu | Principe |
|---|-----|----------|
| 🧠 **Se connaître** | | |
| 01 | 🎯 Qui de nous ? | Vote secret + pari sur le désigné. +2 lucidité si tu te désignes toi-même et que les autres sont d'accord. |
| 02 | 🧠 Dans la tête de… | La sellette répond en secret, les autres devinent sa réponse. |
| 03 | ⚖️ Tu préfères ? | Dilemme impossible, choix secret et prédiction des deux autres. |
| 04 | 📏 Échelle de 1 à 10 | Note-toi sur un trait (« radin », « jaloux »…), les autres devinent ta note. |
| 05 | 🎰 Pourcentage | « Combien de chances que X déménage à l'étranger ? » Le plus proche de l'intéressé gagne. |
| 06 | 🙊 Le Confessionnal | Confession anonyme, les autres devinent l'auteur. |
| 07 | ⚰️ Le Testament | Tu laisses quoi à qui ? Les autres devinent qui hérite. |
| 🎭 **Bluff & impro** | | |
| 08 | 🤥 Menteur ! | 2 vérités, 1 mensonge. |
| 09 | 📖 La Fausse Définition | Mot rare, définitions inventées, vote pour la vraie. |
| 10 | 🕵️ Le Détecteur | 5 réponses dont une fausse, trouve laquelle. |
| 11 | 📣 Le Slogan | Produit absurde, slogan, vote. |
| 12 | ⚖️ Le Juge Suprême | Deux réponses anonymes, un juge tranche. |
| ⚡ **Réflexes & apéro** | | |
| 13 | ⏱️ 5 secondes chrono | 3 réponses en 5 secondes, les autres jugent. |
| 14 | 🎨 Réflexe Couleur | Tape la couleur de l'encre, pas le mot (effet Stroop). |
| 15 | 🔁 Simon dit | Séquence de couleurs de plus en plus longue. |
| 16 | ⏳ Chrono Humain | Appuie pile à 10 secondes, à l'aveugle. |
| 17 | 👊 Tap Battle | 5 secondes, tape le plus vite possible. |
| 🌶️ **Ça glisse** | | |
| 18 | 🙈 Jamais / Toujours | « Je n'ai jamais… », réponse secrète puis paris. |
| 19 | 😏 La Pire Punchline | La pire phrase de drague (lieu imposé) gagne. |
| 20 | 🔥 Roast Gentil | 20 secondes pour clasher tendrement, la victime note. |

## Les ambiances

Choisie au début de la soirée (et modifiable à tout moment) :

- 🧠 **Se connaître** : questions, aveux, prédictions.
- 🍻 **Apéro** : jeux de réflexes mis en avant, et **celui qui perd boit** (sanctions affichées à chaque manche).
- 🌶️ **Ça glisse** : questions épicées et les 3 jeux réservés.
- 🎲 **Mix** : un peu de tout, le hasard décide à chaque set si l'apéro s'applique.

## Rythme

Chaque jeu se joue par **set** (3 manches, ou un tour de table). À chaque manche on peut arrêter ; à la fin du set, l'écran propose **un jeu au hasard** (tirage futé : pas le même jeu, pas le même type, pondéré par l'ambiance), **encore le même**, **choisir à la borne** ou **le podium**.

## Lancer

C'est du HTML/CSS/JS pur, sans build ni serveur.

- Ouvrir `index.html` dans un navigateur, ou
- l'héberger sur GitHub Pages (Settings → Pages → branche `main`, dossier `/`).

Tout (scores, stats, questions perso, questions déjà jouées) est stocké dans le `localStorage` du téléphone. Zéro tracking, zéro backend.

## Structure

```
index.html      la borne
css/prompts.css styles des invites (partagé avec la version écran)
css/style.css   style rétro CRT (scanlines, néons, pixel font)
js/data.js      toutes les questions, punchlines, titres, ambiances
js/common.js    avatars pixel, sons 8-bit
js/prompts.js   rendu des invites : boutons, texte, échelle, réflexes…
js/games.js     les 20 jeux, écrits une seule fois (partagé avec la version écran)
js/app.js       runtime « un téléphone qu'on se passe » : état, borne, sets
```

## Ajouter des questions

Éditer `js/data.js`. Pour *Dans la tête de…*, `{P}` est remplacé par le prénom du joueur sur la sellette. Pour *Tu préfères ?*, chaque dilemme est une paire `["A", "B"]`.

---
*fait maison par ske-media · Press Start*
