# EzMindSphere Installation Guide

## Requirements

- Docker Desktop or Docker Engine with Docker Compose
- A machine reachable by classroom devices
- TCP port 3000 available on the host
- An EzMindSphere activation key

## Docker installation

1. Clone the repository and enter it:

   ```bash
   git clone https://github.com/ejoetso/EzMindSphere.git
   cd EzMindSphere
   ```

2. Create the environment file:

   ```bash
   cp .env.example .env
   ```

3. Set a long random `JWT_SECRET`. Optionally set `APP_URL` to the public HTTPS address. If `APP_URL` is not set, EzMindSphere automatically selects the active LAN IPv4 address for QR codes.

4. Build and start:

   ```bash
   docker compose up -d --build
   ```

5. Open `http://localhost:3000`, enter the institution details and activation key, then sign in.

## Default educator login

- Username: `ezmindsphere`
- Password: `admin@123`

Change or replace this account from the administrator console before production use.

## Classroom network access

Allow inbound TCP port 3000 from the local subnet. Students must use the same network or a configured public HTTPS address. QR codes automatically use `APP_URL`, proxy headers, the requested network host, or the detected LAN address—in that order.

## Operations

```bash
docker compose logs -f
docker compose restart
docker compose down
docker compose pull
docker compose up -d --build
```

Persistent application state is stored in `./data`. Back up this directory regularly.
