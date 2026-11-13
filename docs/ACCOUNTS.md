# Accounts (guest and registered users)

Guests keep everything in the browser (localStorage). A farmer can also create an account with a phone number, a name and a password. There is no text-message code: the phone number is not verified. Account farms are saved in a database and load on any device.

All account code is in one serverless function, `api/account.js`, because the free Vercel plan allows 12 functions. Helpers are in `api/_lib/` (`store.js`, `auth.js`).

## Settings (Vercel > Project > Settings > Environment Variables). Never put these in the code.

Database (Upstash Redis, from the Vercel Marketplace; it adds these for you):
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`)

Without the database, the Log in / Register option shows "accounts not available" and guests are not affected.

## What is saved to the account
Locations and their plots with details, the active plot, rotation prices and yields, irrigation and water choices, and priorities. Photos are not saved (they are fetched again).

## Safety rules built in
Passwords are stored as scrypt hashes. Login and sign-up tries are rate limited. The login cookie is HttpOnly and lasts 30 days.
