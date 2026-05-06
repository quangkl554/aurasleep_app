# AuraSleep MVP Deploy

## Frontend on Vercel

1. Deploy the project root as a static site.
2. Before deploying, set `config.js`:

```js
window.AURASLEEP_CONFIG = {
  API_BASE_URL: 'https://your-railway-api.up.railway.app'
};
```

3. Keep `index.html`, `styles.css`, `app.js`, `config.js`, and `assets/` in the Vercel project.

## Backend on Railway

1. Create a Railway service from the `server` directory.
2. Add a Railway MySQL database.
3. Set the environment variables from `server/.env.example`.
4. Required production values:

```text
NODE_ENV=production
PORT=5000
DB_HOST=...
DB_PORT=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
JWT_SECRET=...
CORS_ORIGIN=https://your-vercel-app.vercel.app
APP_PUBLIC_URL=https://your-vercel-app.vercel.app
GROQ_API_KEY=...
VNP_TMN_CODE=...
VNP_HASH_SECRET=...
VNP_RETURN_URL=https://your-vercel-app.vercel.app/#profile
```

5. Run `npm run db:sync` once from Railway shell to create tables for the MVP database.
6. Use `/health` as the health endpoint.

## Local Checks

```bash
cd server
npm install
npm run check
npm run db:sync
npm start
```

## MVP Notes

- VNPay is sandbox/demo only until you implement return verification and IPN/webhook handling.
- Device control is still simulated in the database; no MQTT/WebSocket hardware bridge is included yet.
- Production startup verifies the database connection but does not alter tables.
