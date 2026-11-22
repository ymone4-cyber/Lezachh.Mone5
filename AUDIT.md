# Audit LeZachh (v6) : pourquoi « rien ne marche »

Constat : en local, le code fonctionne (connexion, produits, annonces, statistiques, import de photo : testés). Les échecs viennent du **déploiement** et de la **structure** du projet.

## Causes des pannes
1. **Identifiant de base D1 jamais renseigné** (`REPLACE_WITH_YOUR_CLOUDFLARE_D1_DATABASE_ID`) : sans lui, l'API répond « base non configurée » et l'administration reste bloquée.
2. **Secrets absents** (`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`) : la connexion échoue, sans explication affichée.
3. **Glisser-déposer du dossier dans Cloudflare** : le dossier `functions/` n'est alors pas exécuté, donc aucune API, aucune administration. Rien ne le signalait.
4. **Migrations non appliquées** : tables absentes, erreurs vagues.
5. **Messages d'erreur inutiles** : « Connexion impossible » ne dit pas quoi corriger.

## Failles de structure (corrigées en v7)
- Le dossier publié était la racine (`pages_build_output_dir = "."`) : `wrangler.toml`, `migrations/`, `scripts/`, et **`.dev.vars` (secrets)** pouvaient être mis en ligne. Désormais seul `public/` est publié.
- Aucune page 404 : toute adresse inconnue renvoyait l'accueil (200).
- Aucun diagnostic : `/api/health` dit maintenant ce qui manque (base, migrations, secrets).
- Contenu en triple (HTML, JS, base de données) : source de dérives.

## Pourquoi cela ne ressemblait pas à un travail d'ingénieur confirmé
- Livré sans avoir été exécuté de bout en bout dans un navigateur ni avec Cloudflare en local.
- Pas de parcours d'installation vérifié ni de diagnostic intégré.
- Un seul fichier de 1 200 lignes avec CSS et JS intégrés.
- Design par défaut : étiquettes en capitales espacées partout, numérotation sans suite logique, palette noir et vert fluo.
- Texte de rareté fixe (« Plus que 7 disponibles ») non lié à un vrai stock.

## Ce qui reste à faire de votre côté
Créer la base D1, la lier au projet (liaison `DB`), appliquer les migrations, définir les 3 secrets. Voir README.
