# Tremplin — interface publique

Code source public de l'interface web Tremplin, en français et en anglais.

- Application en ligne : https://tremplin-tau.vercel.app/
- Technologies : React, TypeScript et Vite.
- Ce dépôt contient uniquement le front-end. Il ne contient pas le serveur, la base de données, ni de clés ou mots de passe.

## Développement

```bash
npm ci
npm run dev
```

Le serveur Vite utilise le proxy local `/api` configuré dans `vite.config.ts`. Pour utiliser ce front-end avec un serveur local, démarre le backend séparément sur `http://localhost:8000`.

## Compilation

```bash
npm run build
```
