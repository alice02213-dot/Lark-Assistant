# Lark Assistant

A self-hosted React + Node.js web application that automates three common Lark (Feishu) workspace tasks:

1. **Meeting Room Booking** — browse available rooms and create calendar events directly from the UI
2. **HK Public Holiday Sync** — import Hong Kong public holidays from the government iCal feed into a Lark calendar
3. **Birthday Auto-Wishes** — maintain a birthday list and automatically send personalised IM greetings every morning

---

## Table of Contents

- [Design](#design)
- [Implementation](#implementation)
- [Dependencies](#dependencies)
- [Lark App Setup](#lark-app-setup)
- [Deployment](#deployment)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)

---

## Design

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser                                        │
│  React SPA (Vite + Tailwind)                    │
└──────────────────┬──────────────────────────────┘
                   │ /api/*  (proxied by nginx)
┌──────────────────▼──────────────────────────────┐
│  frontend container  (nginx:alpine, port 80)    │
│  · serves static build                          │
│  · reverse-proxies /api → backend:3001          │
└──────────────────┬──────────────────────────────┘
                   │ HTTP
┌──────────────────▼──────────────────────────────┐
│  backend container  (node:20-alpine, port 3001) │
│  · Express REST API                             │
│  · Lark API client (token cache)                │
│  · node-cron birthday scheduler                 │
│  · birthdays.json  (volume-mounted)             │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
         ┌─────────▼─────────┐
         │  Lark Open API    │
         │  open.feishu.cn   │
         └───────────────────┘
```

The frontend and backend are packaged as separate Docker images and wired together with `docker-compose`. nginx handles static file serving and API proxying in one container, removing any CORS concerns. Birthday data is persisted in a JSON file on a Docker volume so it survives container restarts.

### Feature Design

#### 1 — Meeting Room Booking

Lark does not have a dedicated "book a room" endpoint. Rooms are booked by creating a **Calendar v4 event** with the room listed as an attendee of type `"resource"`. The booking flow is:

1. Backend fetches the room list from the `meeting_room/room/list` (v1) API.
2. User picks a room, fills in title, start/end datetime, and optional attendee emails.
3. Backend posts a calendar event to `/calendar/v4/calendars/{calendarId}/events` with the room's `resource_id` in the attendees array.

#### 2 — HK Public Holiday Sync

The Hong Kong government publishes a standard iCal feed at `https://www.1823.gov.hk/common/ical/gc/tc.ic`. The flow is:

1. Backend fetches the raw iCal text with `node-fetch`.
2. `node-ical` parses the VEVENT components (handles CRLF line endings and character encoding automatically).
3. Each event is mapped to a Lark all-day event (`start_time.date` / `end_time.date`) and created sequentially with a 200 ms delay between calls to respect Lark's ~5 QPS rate limit on calendar writes.
4. The UI shows a summary of created vs. failed events.

#### 3 — Birthday Auto-Wishes

Birthday records are stored in `backend/data/birthdays.json`. A `node-cron` job runs every day at **09:00 (Asia/Hong_Kong)**, reads the file, and sends an IM text message via the Lark Messages API to anyone whose month and day match the current date. A "Test Send" button in the UI lets you verify the message delivery before the scheduled time.

---

## Implementation

### Directory Structure

```
.
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── data/                        # birthday data (Docker volume)
│   │   └── birthdays.json
│   └── src/
│       ├── index.ts                 # Express app + cron startup
│       ├── config.ts                # typed env validation
│       ├── lark/
│       │   ├── auth.ts              # tenant_access_token cache
│       │   ├── client.ts            # Axios instance (token injection, error unwrapping)
│       │   ├── rooms.ts             # room list + booking
│       │   ├── calendar.ts          # all-day event creation, batch helper
│       │   └── im.ts                # IM text message sender
│       ├── routes/
│       │   ├── index.ts
│       │   ├── rooms.ts             # GET /api/rooms, POST /api/rooms/book
│       │   ├── holidays.ts          # POST /api/holidays/sync
│       │   └── birthdays.ts         # CRUD + POST /api/birthdays/:id/test
│       ├── services/
│       │   ├── holidayParser.ts     # iCal fetch + parse
│       │   └── birthdayScheduler.ts # node-cron, file read/write
│       └── middleware/
│           └── errorHandler.ts
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── App.tsx                  # react-router routes
        ├── index.css                # Tailwind directives
        ├── main.tsx
        ├── api/client.ts            # Axios instance
        ├── types/index.ts
        ├── components/
        │   ├── Layout.tsx           # sidebar nav
        │   └── ui/
        │       ├── Button.tsx
        │       └── Spinner.tsx
        └── pages/
            ├── RoomBooking.tsx
            ├── HolidaySync.tsx
            └── BirthdayWishes.tsx
```

### Key Implementation Notes

**Token caching (`lark/auth.ts`)**
The `tenant_access_token` expires every 7,200 seconds. The module caches it in memory and proactively refreshes when fewer than 60 seconds remain, so no request ever uses an expired token.

**Lark error detection (`lark/client.ts`)**
Every Lark API response is HTTP 200, even for errors. The Axios response interceptor inspects `data.code` and throws if it is non-zero, converting Lark error codes into standard JavaScript `Error` objects with a `larkCode` property.

**IM message format (`lark/im.ts`)**
Lark's `/im/v1/messages` endpoint requires the `content` field to be a **JSON-serialised string** (not a nested object). Passing a plain object causes a cryptic 400 error.

**File write safety (`services/birthdayScheduler.ts`)**
All writes to `birthdays.json` are chained through a module-level `Promise` to prevent concurrent write races when multiple API requests arrive simultaneously.

**Birthday scheduler timezone**
`node-cron` accepts an IANA timezone string via its `timezone` option. The default is `Asia/Hong_Kong`, configurable via `CRON_TIMEZONE`.

---

## Dependencies

### Backend

| Package | Purpose |
|---|---|
| `express` | HTTP server and routing |
| `axios` | HTTP client for Lark API calls |
| `cors` | Cross-origin headers for local dev |
| `node-cron` | Cron scheduler for birthday wishes |
| `node-fetch` | Fetch the HK government iCal URL |
| `node-ical` | Parse iCal/iCS format |
| `uuid` | Generate unique IDs for birthday records |
| `typescript` | Type safety |
| `ts-node-dev` | Hot-reload for local development |

### Frontend

| Package | Purpose |
|---|---|
| `react` + `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `axios` | HTTP client for backend API calls |
| `vite` | Build tool and dev server |
| `tailwindcss` | Utility-first CSS |
| `typescript` | Type safety |

### Runtime

| Requirement | Version |
|---|---|
| Node.js | 20+ |
| Docker | 24+ |
| Docker Compose | v2 (`docker compose`) |

---

## Lark App Setup

Before running the application you need a Lark Open Platform app with the correct scopes.

1. Go to [https://open.feishu.cn/app](https://open.feishu.cn/app) and create a new app (企業自建應用).
2. Under **Permissions & Scopes**, enable the following:

   | Scope | Purpose |
   |---|---|
   | `meeting_room:room:readonly` | List meeting rooms |
   | `calendar:calendar` | Create calendar events (room booking + holiday sync) |
   | `im:message:send_as_bot` | Send birthday IM messages |

3. Under **Bot**, enable the bot feature and add it to the workspace.
4. Under **App Credentials**, copy the **App ID** and **App Secret**.
5. Publish / release the app inside your organisation.

> **Receive ID type for birthday wishes:** The Lark user ID format you store must match the `receiveIdType` field in the birthday record. `open_id` is the safest default as it is stable and always available. If you only have `user_id` values, select `user_id` in the dropdown when adding a record.

---

## Deployment

### Docker (recommended)

```bash
# 1. Clone / copy the project
cd "Lark Assistant"

# 2. Create your .env from the example
cp .env.example .env
# Fill in LARK_APP_ID and LARK_APP_SECRET at minimum

# 3. Build and start
docker compose up --build -d

# App is now available at http://localhost
# Backend health check: http://localhost:3001/health
```

To stop:

```bash
docker compose down
```

Birthday data persists in `./backend/data/birthdays.json` via the Docker volume mount and survives `docker compose down`. To wipe it, delete that file manually.

### Updating

```bash
docker compose down
docker compose up --build -d
```

The `./backend/data` volume mount means no data is lost on rebuild.

---

## Local Development

Run backend and frontend in separate terminals without Docker.

**Prerequisites:** Node.js 20+

```bash
# Terminal 1 — Backend
cd backend
npm install
cp ../.env.example ../.env   # edit .env with real credentials
# Export env vars (or use a tool like direnv)
export $(grep -v '^#' ../.env | xargs)
npm run dev
# Listening on http://localhost:3001
```

```bash
# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# Vite dev server on http://localhost:5173
# /api/* is proxied to http://localhost:3001 via vite.config.ts
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `LARK_APP_ID` | Yes | — | Lark app ID (`cli_...`) |
| `LARK_APP_SECRET` | Yes | — | Lark app secret |
| `LARK_CALENDAR_ID` | No | `primary` | Target calendar for holiday events |
| `CRON_TIMEZONE` | No | `Asia/Hong_Kong` | IANA timezone for birthday cron |
| `PORT` | No | `3001` | Backend listen port |
| `DATA_DIR` | No | `/app/data` (prod) / `./data` (dev) | Directory for `birthdays.json` |
| `VITE_API_BASE_URL` | No | `/api` | Frontend API base path (build-time) |

---

## API Reference

All endpoints are prefixed with `/api`.

### Rooms

| Method | Path | Description |
|---|---|---|
| `GET` | `/rooms` | List all meeting rooms |
| `POST` | `/rooms/book` | Book a room (create calendar event) |

**POST `/rooms/book` body:**
```json
{
  "calendarId": "primary",
  "summary": "週會",
  "description": "optional",
  "roomId": "omm_xxxxxxxx",
  "startTime": "2026-05-10T10:00",
  "endTime": "2026-05-10T11:00",
  "attendeeEmails": ["a@example.com"]
}
```

### Holidays

| Method | Path | Description |
|---|---|---|
| `POST` | `/holidays/sync` | Fetch HK iCal and create events in Lark Calendar |

**Response:**
```json
{ "total": 17, "created": 17, "failed": 0, "errors": [] }
```

### Birthdays

| Method | Path | Description |
|---|---|---|
| `GET` | `/birthdays` | List all birthday records |
| `POST` | `/birthdays` | Add a birthday record |
| `DELETE` | `/birthdays/:id` | Remove a birthday record |
| `POST` | `/birthdays/:id/test` | Send a test wish immediately |

**POST `/birthdays` body:**
```json
{
  "name": "陳大文",
  "receiveId": "ou_xxxxxxxxxx",
  "receiveIdType": "open_id",
  "month": 8,
  "day": 15,
  "message": "生日快樂！🎂"
}
```
`message` is optional; omitting it uses the default Chinese/English greeting.
