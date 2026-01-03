# Guide de Déploiement (Render.com)

Ce guide vous explique comment mettre votre site **Tigo** en ligne gratuitement avec une base de données **PostgreSQL** sur Render.com.

## Prérequis
- Un compte GitHub (votre code doit être sur GitHub).
- Un compte sur [Render.com](https://render.com).

## Étape 1 : Base de Données (PostgreSQL)
1. Connectez-vous sur le tableau de bord Render.
2. Cliquez sur **New +** et sélectionnez **PostgreSQL**.
3. Remplissez les champs :
   - **Name**: `tigo-db` (ou autre)
   - **Database**: `tigo`
   - **User**: `tigo`
   - **Region**: Choisissez la plus proche (ex: Frankfurt).
   - **Instance Type**: Free
4. Cliquez sur **Create Database**.
5. Une fois créée, copiez l'**Internal Database URL** (pour plus tard) ou l'**External Database URL** si vous voulez vous y connecter depuis votre PC.

## Étape 2 : Le Web Service (Site Node.js)
1. Sur le tableau de bord Render, cliquez sur **New +** et sélectionnez **Web Service**.
2. Connectez votre compte GitHub et sélectionnez le dépôt `tigo`.
3. Remplissez la configuration :
   - **Name**: `tigo-app`
   - **Environment**: Node
   - **Region**: La même que la base de données.
   - **Branch**: `main` (ou master)
   - **Build Command**: `npm install`
   - **Start Command**: `node backend/server.js`
   - **Instance Type**: Free

4. **Important : Variables d'Environnement**
   Cliquez sur **Advanced** (ou défilez jusqu'à "Environment Variables") et ajoutez :
   
   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | *Collez ici l'Internal Database URL copié à l'étape 1* |
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` (Render définit ce port automatiquement, mais bon à savoir) |

5. Cliquez sur **Create Web Service**.

## Étape 3 : Vérification
- Render va commencer le déploiement (cela peut prendre quelques minutes).
- Surveillez les logs (lignes de texte qui défilent).
- Si vous voyez `✅ Connected to PostgreSQL`, c'est gagné !
- Cliquez sur l'URL de votre site (en haut à gauche, ex: `https://tigo-app.onrender.com`).

## Notes
- La version gratuite de Render "endort" le site après 15 min d'inactivité. Le premier chargement peut être un peu lent (environ 30s) le temps qu'il se réveille.
- La base de données gratuite expire au bout de 90 jours (vous pourrez en créer une nouvelle ou passer au plan payant).
