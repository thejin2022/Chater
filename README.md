# Chater
A Real-time chat system built with Django REST Framework.

## Getting Started
Make sure you have Docker and Docker Compose installed.

Clone the repository:

```bash
git clone https://github.com/thejin2022/Chater
cd Chater
```

Create environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Start the system:

```bash
docker compose up -d --build
```

Visit:
- Frontend: `http://localhost:8080`
- Health check: `http://localhost:8080/api/health/`

## Features

- Create group chat room - `POST /api/chat/chatrooms/`
- List my chat rooms - `GET /api/chat/chatrooms/`
- Create or get direct chat room - `POST /api/chat/chatrooms/direct/`
- Rename group chat room (owner only) - `PATCH /api/chat/chatrooms/{uri}/`
- Send message - `POST /api/chat/chatrooms/{uri}/messages/`
- List messages (pagination supported) - `GET /api/chat/chatrooms/{uri}/messages/`
- Search messages by keyword - `GET /api/chat/chatrooms/{uri}/messages/?keyword={keyword}`
- List members - `GET /api/chat/chatrooms/{uri}/members/`
- Invite member (group owner only) - `POST /api/chat/chatrooms/{uri}/members/`
- List pending invitations - `GET /api/chat/invitations/`
- Respond invitation - `POST /api/chat/invitations/{invitation_id}/respond/`

Realtime endpoints:
- Room messages WebSocket - `/ws/chat/{uri}/`
- Notification WebSocket - `/ws/notifications/`

## Authentication

The system uses HttpOnly JWT cookie authentication.

Auth endpoints:
- Register - `POST /api/auth/register/`
- Login - `POST /api/auth/login/`
- Refresh access token - `POST /api/auth/refresh/`
- Get CSRF cookie - `GET /api/auth/csrf/`
- Get current user - `GET /api/auth/me/`
- Logout - `POST /api/auth/logout/`

- Unauthenticated users can access auth endpoints only.
- Authenticated users can access their own chat rooms and messages.
- Group owner permissions:
  - Rename group room
  - Invite members
- Direct chat creation validates invitation and membership state.

CSRF protection is enabled for unsafe methods (`POST`, `PATCH`, `DELETE`, etc.).

## Notes

- Nginx serves frontend assets and proxies `/api` + `/ws` to Django ASGI.
- Redis is used as Channels layer backend for WebSocket messaging.
- PostgreSQL stores persistent data (users, chat rooms, messages, invitations).