# 🕹️ PETIT JUEGO

Une borne d'arcade rétro pour apprendre à se connaître à trois. Un téléphone qu'on se passe, cinq mini-jeux, un score cumulé sur la soirée et des titres décernés au podium.

**Trois joueurs.** Au lancement, le jeu demande les prénoms de chacun ; « Nouvelle soirée » remet joueurs, scores et titres à zéro.

## Les 5 jeux

| # | Jeu | Principe | Points |
|---|-----|----------|--------|
| 01 | 🎯 **Qui de nous 3 ?** | Une question du genre *« Qui finirait en prison en premier ? »*. Chacun vote en secret, puis parie sur qui sera désigné. | +1 bon pari · +2 lucidité si tu t'es désigné toi-même et que les autres sont d'accord |
| 02 | ⏱️ **5 secondes chrono** | START, la consigne tombe (*« 3 endroits insolites où faire l'amour »*), 5 secondes pour citer 3 réponses. Les deux autres jugent. | +2 réussi · +1 presque · 0 raté |
| 03 | 🤥 **Menteur !** | 2 vérités, 1 mensonge écrits en secret. Les autres cherchent le mensonge. | +1 si tu le trouves · +2 à l'auteur si personne ne le trouve |
| 04 | 🧠 **Dans la tête de…** | Un joueur sur la sellette répond en secret, les autres devinent sa réponse. | +2 au plus proche · +1 à l'énigme si personne ne trouve |
| 05 | ⚖️ **Tu préfères ?** | Dilemme impossible. Chacun choisit et prédit le choix des deux autres. | +1 par prédiction · +1 bonus si les deux |

Plus de **350 questions**, un mode **🌶️ HOT** à activer sur la borne, et un écran **✏️ Nos questions** pour ajouter vos private jokes.

## Lancer

C'est du HTML/CSS/JS pur, sans build ni serveur.

- Ouvrir `index.html` dans un navigateur, ou
- l'héberger sur GitHub Pages (Settings → Pages → branche `main`, dossier `/`).

Tout (scores, stats, questions perso, questions déjà jouées) est stocké dans le `localStorage` du téléphone. Zéro tracking, zéro backend.

## Structure

```
index.html      la borne
css/style.css   style rétro CRT (scanlines, néons, pixel font)
js/data.js      toutes les questions, punchlines et titres
js/app.js       moteur : écrans, flux « passe le téléphone », scores, sons (WebAudio)
```

## Ajouter des questions

Éditer `js/data.js`. Pour *Dans la tête de…*, `{P}` est remplacé par le prénom du joueur sur la sellette. Pour *Tu préfères ?*, chaque dilemme est une paire `["A", "B"]`.

---
*fait maison par ske-media · Press Start*
