# 🚗 Tigo - Covoiturage & Livraison de Colis

**Tigo** est une plateforme web moderne combinant le covoiturage et la livraison/récupération d'objets entre particuliers.

![Tigo Preview](https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80)

## ✨ Fonctionnalités

- 🏠 **Page d'accueil** - Présentation du service avec design moderne
- 🚗 **Liste des trajets** - Recherche et filtrage des trajets disponibles
- 🗺️ **Carte interactive** - Visualisation des trajets sur une carte de France (Leaflet.js)
- 📅 **Calendrier** - Vue mensuelle des trajets planifiés
- 📝 **Poster un trajet** - Formulaire complet pour créer un trajet
- 👤 **Authentification** - Inscription, connexion, profil utilisateur
- 💬 **Messagerie interne** - Communication entre utilisateurs
- 🔔 **Notifications** - Alertes pour demandes reçues/acceptées/refusées

## 🛠️ Technologies

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Base de données**: SQLite (better-sqlite3)
- **Carte**: Leaflet.js
- **Authentification**: Sessions Express + bcrypt
- **Design**: Thème vert moderne (#36c36b)

## 📦 Installation

### Prérequis
- Node.js (v16 ou supérieur)
- npm

### Étapes

1. **Cloner ou copier le projet**
```bash
cd tigo
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Créer les dossiers d'upload**
```bash
mkdir -p uploads/profiles uploads/trips
```

4. **Lancer le serveur**
```bash
npm start
```

5. **Ouvrir dans le navigateur**
```
http://localhost:3000
```

## 📁 Structure du projet

```
tigo/
├── backend/
│   ├── server.js           # Serveur Express
│   ├── database.js         # Configuration SQLite + données exemple
│   ├── middleware/
│   │   └── auth.js         # Middleware d'authentification
│   └── routes/
│       ├── auth.js         # Routes d'authentification
│       ├── trips.js        # Routes des trajets
│       ├── messages.js     # Routes des messages
│       └── notifications.js # Routes des notifications
├── public/
│   ├── index.html          # Page d'accueil
│   ├── trips.html          # Liste des trajets
│   ├── map.html            # Carte interactive
│   ├── calendar.html       # Calendrier
│   ├── post-trip.html      # Poster un trajet
│   ├── trip-detail.html    # Détail d'un trajet
│   ├── login.html          # Connexion
│   ├── register.html       # Inscription
│   ├── profile.html        # Profil utilisateur
│   ├── messages.html       # Messagerie
│   ├── css/
│   │   ├── style.css       # Styles principaux
│   │   └── components.css  # Composants (carte, calendrier, messages)
│   ├── js/
│   │   ├── app.js          # Utilitaires communs
│   │   ├── auth.js         # Gestion de session
│   │   ├── trips.js        # Logique liste trajets
│   │   ├── map.js          # Carte Leaflet
│   │   ├── calendar.js     # Calendrier
│   │   └── messages.js     # Messagerie
│   └── assets/
│       └── images/         # Images et avatars
├── uploads/
│   ├── profiles/           # Photos de profil
│   └── trips/              # Photos de trajets
├── package.json
└── README.md
```

## 🔐 Comptes de test

Des utilisateurs sont créés automatiquement au premier lancement :

| Email | Mot de passe |
|-------|--------------|
| marie.dupont@email.com | password123 |
| thomas.martin@email.com | password123 |
| sophie.bernard@email.com | password123 |

## 🎨 Charte graphique

| Élément | Valeur |
|---------|--------|
| Couleur principale | #36c36b |
| Couleur secondaire | #70d69a |
| Fond accent | #e9fff5 |
| Police | Inter (Google Fonts) |
| Bordures | 12px (cartes), 8px (boutons) |

## 📱 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/me` - Utilisateur courant
- `PUT /api/auth/profile` - Modifier profil

### Trajets
- `GET /api/trips` - Liste des trajets (avec filtres)
- `GET /api/trips/:id` - Détail d'un trajet
- `POST /api/trips` - Créer un trajet
- `POST /api/trips/:id/request` - Demander un trajet
- `PUT /api/trips/requests/:id/respond` - Accepter/Refuser

### Messages
- `GET /api/messages/conversations` - Liste conversations
- `GET /api/messages/conversations/:id/messages` - Messages
- `POST /api/messages/conversations/:id/messages` - Envoyer

### Notifications
- `GET /api/notifications` - Liste notifications
- `PUT /api/notifications/:id/read` - Marquer comme lu

## 🚀 Développement

```bash
# Mode développement avec rechargement automatique
npm run dev
```

## 📝 License

MIT License - Créé avec ❤️ par **Claude AI** (Anthropic)
