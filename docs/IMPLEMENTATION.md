# EzMindSphere Implementation Guide

## Recommended rollout

1. **Pilot:** deploy to a private staff network and activate the instance.
2. **Secure:** replace default secrets and accounts, enable HTTPS, and restrict port 3000 to approved networks.
3. **Configure:** validate QR links, educator accounts, browser camera permissions, storage, and backups.
4. **Test:** create a mind-map session and a live poll; join from a separate student device.
5. **Train:** review educator dashboards, moderation, Q&A, polling, exports, and account management.
6. **Launch:** publish the approved URL and support contact to educators.

## Architecture

- React and Vite client
- Express API and static production server
- WebSocket real-time collaboration
- JSON persistence in the mounted `data` directory
- Optional Gemini integration through `GEMINI_API_KEY`
- License validation using public SHA-256 key hashes and a local activation record

## Production checklist

- Set `JWT_SECRET` to a long random value.
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Replace the default educator password.
- Set `APP_URL` to the HTTPS URL when deployed behind a proxy.
- Mount and back up `/app/data`.
- Restrict firewall access appropriately.
- Test QR access from a separate mobile device.
- Review institutional privacy and student-data requirements.
- Do not commit `.env`, `data`, or raw activation keys.

## Validation

```bash
npm ci
npm run lint
npm run build
docker compose config
docker compose up -d --build
```

Confirm `/api/license/status`, educator login, admin account management, mind-map collaboration, live polling, student Q&A, and QR access before handoff.
