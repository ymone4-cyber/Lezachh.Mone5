# LeZachh — Cyber · Hacking éthique · Tech

Site vitrine responsive avec boutique, guides, accessoires, formation, annonces, statistiques consenties et espace d’administration protégé.

## Déploiement Cloudflare Workers

La capture du site publié montre un domaine `workers.dev`. Le déploiement doit donc inclure le Worker API, ses fichiers statiques, D1 et les secrets. Le glisser-déposer d’un dossier contenant seulement les pages ne déploie pas les API.

1. Connectez Wrangler au compte Cloudflare : `npx wrangler login`.
2. Dans `wrangler.worker.toml`, remplacez `REPLACE_WITH_YOUR_CLOUDFLARE_D1_DATABASE_ID` par l’identifiant de la base D1 `lezachh-admin` déjà utilisée par le site. Si aucune base n’existe, créez-la dans Cloudflare **Workers & Pages → D1**. Le nom de liaison doit rester `DB`.
3. Appliquez les migrations. Sur une base neuve, Wrangler applique `0001`, `0002` et `0003`. Sur une base existante, il applique seulement les migrations qui manquent :

   ```powershell
   npx wrangler d1 migrations apply lezachh-admin --remote --config wrangler.worker.toml
   ```

4. Définissez les secrets du Worker. Le générateur demande le mot de passe (10 caractères minimum) en saisie masquée et n’enregistre que son empreinte PBKDF2. Le mot de passe en clair n’est pas intégré au ZIP ni au code public.

   ```powershell
   npx wrangler secret put ADMIN_USERNAME --config wrangler.worker.toml
   node scripts/hash-admin-password.mjs
   npx wrangler secret put ADMIN_PASSWORD_HASH --config wrangler.worker.toml
   node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))"
   npx wrangler secret put ADMIN_SESSION_SECRET --config wrangler.worker.toml
   ```

   Copiez l’empreinte du script dans la demande Wrangler pour `ADMIN_PASSWORD_HASH`. Pour `ADMIN_SESSION_SECRET`, copiez la valeur aléatoire produite puis retirez-la de l’historique ou de vos notes temporaires. Ne publiez jamais ces valeurs.

5. Publiez le site et ses API sur le Worker déjà associé à `patient-river-127b.workers.dev` :

   ```powershell
   npx wrangler deploy --config wrangler.worker.toml
   ```

6. Ouvrez `https://patient-river-127b.workers.dev/api/health`. Le résultat doit être `"status":"ok"` avec chaque indicateur à `true`. Ensuite, vérifiez `/admin/` et connectez-vous.

Si le nom `patient-river-127b` diffère du Worker réel dans le compte Cloudflare, mettez à jour `name` dans `wrangler.worker.toml` avant le déploiement. La configuration envoie d’abord `/api/*` au Worker et sert les pages et images depuis `public/`.

## Espace administration

Ouvrez `/admin/` après le déploiement. L’administration permet de consulter les visites consenties, gérer les produits et leurs prix, publier des annonces et changer l’arrière-plan. Les nouvelles offres de matériel sont ajoutées par la migration `0003_hardware_products_and_currencies.sql`.

Les devises vendeur prises en charge sont USD, FCFA, COP et AUD. Les cartes de produits utilisent une liste locale d’images associée à leur identifiant ; les images et textes distants ne sont pas injectés comme HTML. L’écran de connexion reprend le style de carte vitrée du visuel de référence et indique les protections réellement actives.

La connexion utilise un mot de passe PBKDF2, une session signée qui expire après 8 heures, un cookie `HttpOnly`/`SameSite=Strict`, une limitation des tentatives et un contrôle d’origine contre les requêtes intersites. Les modifications utilisent du JSON validé et des requêtes SQL paramétrées. Le site ne conserve pas l’adresse IP des visiteurs. Les statistiques ne sont mesurées qu’après accord ; le pied de page permet de retirer ce choix.

## Développement local

Après avoir configuré l’identifiant D1 dans `wrangler.worker.toml`, appliquez les migrations locales puis lancez le Worker :

```powershell
npx wrangler d1 migrations apply lezachh-admin --local --config wrangler.worker.toml
npx wrangler dev --config wrangler.worker.toml
```

Pour ouvrir l’administration en local, ajoutez `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` et `ADMIN_SESSION_SECRET` à `.dev.vars` (ignoré par Git). Utilisez des identifiants de développement différents de ceux de production.

## Contrôles

```powershell
npm run security-check
```

Le contrôle vérifie notamment le routage API, les migrations, l’authentification, le CSRF, l’injection SQL, le XSS stocké, les liens dangereux, les limites de requête et l’absence d’enregistrement d’adresses IP.

## Fichiers principaux

- `public/` : site, administration, images et règles d’en-têtes ;
- `public/admin/admin-refresh.css` : présentation vitrée du panneau d’administration ;
- `worker.js` : routage Workers des API et des fichiers statiques ;
- `functions/` : handlers API partagés ;
- `migrations/` : schéma D1 et catalogue de produits ;
- `wrangler.worker.toml` : déploiement Workers, assets et liaison D1 ;
- `wrangler.toml` : configuration Pages conservée pour l’ancienne cible.
