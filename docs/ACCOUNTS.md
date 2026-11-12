# Accounts (guest and registered users)

Guests keep everything in the browser (localStorage). Registered users register with a phone number and a one-time code (OTP),
and their farms are saved in a database and loaded on any device.

All account code is in one serverless function, `api/account.js`, because the free Vercel plan allows 12 functions.
Helpers are in `api/_lib/` (`store.js`, `sms.js`, `auth.js`).

## Settings (Vercel > Project > Settings > Environment Variables). Never put these in the code.

Database (Upstash Redis, from the Vercel Marketplace; it adds the first two for you):
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`)

Text messages, choose one provider with `SMS_PROVIDER`:
- `twilio`: also `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
- `bulksmsbd`: also `BULKSMSBD_API_KEY`, `BULKSMSBD_SENDER_ID`

Without the database or an SMS provider, the Log in / Register option shows "accounts not available" and guests are not affected.

## Working on your own computer
Put this in `.env.local` (the file is never committed). The code is then shown on screen and nothing is sent, and a temporary in-memory store is used:

    AUTH_DEV_OTP=1

Never set `AUTH_DEV_OTP` on Vercel.

## What is saved to the account
My Farm fields and their details, the active field, rotation prices and yields, irrigation and water choices, and priorities.
Photos are not saved (they are fetched again).

## Safety rules built in
Passwords are stored as scrypt hashes. A code works for 10 minutes and allows 5 tries. A new code can be asked for once a minute
(5 per hour per number, 20 per hour per network address). Login tries are limited. The login cookie is HttpOnly and lasts 30 days.
