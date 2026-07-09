# README_IMAGES.md

## Gestion des images produits - Escale Olfactive

Ce document décrit la procédure complète permettant :

* d'importer un nouveau catalogue mensuel
* de réutiliser les images déjà validées
* de valider uniquement les nouveaux parfums
* de télécharger les images localement
* de générer le catalogue final utilisé par Angular

---

## ⚠️ IMPORTANT

Ne jamais supprimer :

```txt
public/images/parfums/
public/data/product-image-groups.json
```

Ces deux éléments représentent tout le travail de validation réalisé depuis le début du projet.

---

## Fichiers principaux

### Catalogue brut

```txt
public/data/parfums_with_type_<mois>_<année>.json
```

### Catalogue final utilisé par Angular

```txt
public/data/parfums_with_type_<mois>_<année>_with_images.json
```

### Base des validations

```txt
public/data/product-image-groups.json
```

### Images locales

```txt
public/images/parfums/
```

---

## Scripts utilisés

```txt
scripts/generate-image-worklist.cjs
scripts/generate-image-groups.cjs
scripts/image-review-server.cjs
scripts/download-validated-images.cjs
scripts/build-final-catalog.cjs
```

---
# Pipeline mensuelle - Mise à jour du catalogue parfums Escale Olfactive

## Objectif

À chaque réception d'un nouveau catalogue fournisseur :

* Réutiliser les images déjà validées
* Ne valider que les nouveaux parfums
* Générer automatiquement le catalogue final avec images
* Mettre à jour Angular sans casser l'existant

---

# 1. Sauvegarde

Avant toute manipulation :

```bash
cp public/data/product-image-groups.json public/data/product-image-groups-backup.json
cp public/data/parfums_with_type_*_with_images.json backup/
```

---

# 2. Import du nouveau catalogue

Exemple pour juillet :

```txt
public/data/parfums_with_type_juillet_2026.json
```

Ne jamais remplacer les anciens fichiers.

Toujours conserver :

```txt
parfums_with_type_mai_2026.json
parfums_with_type_juin_2026.json
parfums_with_type_juillet_2026.json
...
```

---

# 3. Modifier les scripts

## generate-image-worklist.cjs

Remplacer :

```js
parfums_with_type_juin_2026.json
```

par :

```js
parfums_with_type_juillet_2026.json
```

---

## build-final-catalog.cjs

Entrée :

```js
parfums_with_type_juillet_2026.json
```

Sortie :

```js
parfums_with_type_juillet_2026_with_images.json
```

---

# 4. Générer la worklist

```bash
node scripts/generate-image-worklist.cjs
```

Résultat :

```txt
public/data/product-image-sources.json
```

---

# 5. Générer les groupes

```bash
node scripts/generate-image-groups.cjs
```

Résultat :

```txt
public/data/product-image-groups.json
```

---

# 6. Réutilisation des images existantes

Le fichier :

```txt
product-image-groups.json
```

contient déjà toutes les validations réalisées les mois précédents.

Les parfums déjà connus réutilisent automatiquement leurs images.

Aucune action manuelle nécessaire.

---

# 7. Validation des nouveaux parfums

Lancer :

```bash
node scripts/image-review-server.cjs
```

Ouvrir :

```txt
http://localhost:3001
```

Pour chaque nouveau groupe :

* Vérifier les candidats proposés
* Choisir la bonne image
* Cliquer sur :

```txt
✅ Choisir cette image
```

Éviter les images ne correspondant pas exactement au parfum.

---

# 8. Télécharger les images validées

```bash
node scripts/download-validated-images.cjs
```

Résultat :

```txt
public/images/parfums/
```

Les nouvelles images sont téléchargées localement.

---

# 9. Générer le catalogue final

```bash
node scripts/build-final-catalog.cjs
```

Résultat :

```txt
public/data/parfums_with_type_juillet_2026_with_images.json
```

---

# 10. Mise à jour Angular

Dans :

```txt
src/app/services/parfum.service.ts
```

Remplacer :

```ts
'/data/parfums_with_type_juin_2026_with_images.json'
```

par :

```ts
'/data/parfums_with_type_juillet_2026_with_images.json'
```

---

# 11. Vérification

Lancer :

```bash
ng serve
```

Vérifier :

* Accueil
* Marques
* Recherche
* Panier
* Images produits

Contrôler visuellement plusieurs marques :

* Dior
* Chanel
* Guerlain
* Hermès
* Cartier
* Creed
* Xerjoff

---

# Fichiers à ne jamais supprimer

```txt
public/images/parfums/
public/data/product-image-groups.json
```

Ces deux éléments représentent tout le travail de validation réalisé.

---

# Fichiers principaux utilisés

```txt
scripts/generate-image-worklist.cjs
scripts/generate-image-groups.cjs
scripts/image-review-server.cjs
scripts/download-validated-images.cjs
scripts/build-final-catalog.cjs
```

---

# Résultat final

Pipeline complète :

Catalogue brut
→ Worklist
→ Groupes
→ Validation humaine assistée
→ Téléchargement local
→ Catalogue enrichi
→ Angular

Objectif :

* 0 dépendance Bing
* 0 dépendance Google Images au chargement
* Images locales rapides
* Réutilisation des validations d'un mois sur l'autre
* Validation uniquement des nouveaux parfums

```
```
## 🔍 Recontrôler les images validées

Il est possible de revoir toutes les images validées à tout moment.

### Démarrer l'outil de validation

```bash
node scripts/image-review-server.cjs
```

Ouvrir ensuite :

```txt
http://localhost:3001
```

---

### Revoir une image précise

Chaque groupe possède un index.

Exemples :

```txt
http://localhost:3001/review/0
http://localhost:3001/review/1
http://localhost:3001/review/283
```

⚠️ L'index commence à 0.

Exemple :

```txt
Groupe 284 / 570
```

correspond à :

```txt
http://localhost:3001/review/283
```

---

### Revoir toutes les images depuis le début

Ouvrir :

```txt
http://localhost:3001/review/0
```

Puis utiliser :

```txt
Suivant →
```

pour parcourir tous les groupes.

---

### Corriger une mauvaise image

Si une image est incorrecte :

1. Rechercher une meilleure image candidate.
2. Cliquer sur :

```txt
✅ Choisir cette image
```

ou

3. Coller une URL manuellement.
4. Valider à nouveau.

La nouvelle image remplacera automatiquement l'ancienne dans :

```txt
public/data/product-image-groups.json
```

---

### Régénérer le catalogue après correction

Après avoir modifié des images :

```bash
node scripts/download-validated-images.cjs
node scripts/build-final-catalog.cjs
```

Puis recharger l'application Angular.

Les nouvelles images apparaîtront automatiquement dans le catalogue.
