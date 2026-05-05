# RentFlow 2.0 — Copilot Instructions

## Project Overview
RentFlow 2.0 is a rental/planning tool used to manage **projects**, **people**, **materials**, and **bookings**. It prevents double-booking of people and materials across overlapping project date ranges.

## Repository Layout
```
rentflow2.0/
├── Backend/          # Node.js / Express REST API
│   ├── Prisma/       # Prisma schema & migrations
│   └── src/
│       ├── lib/      # Shared singletons (prisma.js)
│       ├── middleware/
│       └── routes/
├── Frontend/         # React + Vite + Tailwind SPA
│   └── src/
│       ├── api/      # Axios client with auth interceptor
│       ├── components/
│       ├── context/  # AuthContext (JWT stored in localStorage)
│       └── pages/
├── Workflows/        # GitHub Actions workflow files
└── docker-compose.yml
```

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Express 4, Prisma 5, PostgreSQL 15 |
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6, Axios |
| Auth | JWT (`jsonwebtoken`), bcryptjs |
| Containerisation | Docker (multi-stage builds), Docker Compose |
| CI/CD | GitHub Actions → Docker Hub |

## Coding Conventions

### General
- Keep files ≤ 150 lines; extract helpers or sub-components when exceeded.
- Use English for code, variable names, comments, and commit messages.
- Never commit secrets; use environment variables loaded from `.env` (see `docker-compose.yml`).

### Backend
- **All** route handlers must be `async` and wrapped in `try/catch` returning `{ error: string }` JSON on failure.
- Use the **shared Prisma singleton** from `src/lib/prisma.js` — never instantiate `new PrismaClient()` inside route files.
- Every route (except `/api/auth/*`) must use the `auth` middleware.
- CORS must be restricted to the `FRONTEND_URL` environment variable — never `app.use(cors())` without an origin option.
- Validate required fields before calling Prisma; return `400` for missing/invalid input.
- Use `parseInt()` for all ID parameters from URL params (`req.params.id`).

### Frontend
- Auth state is managed through `AuthContext`; use the `useAuth()` hook — do not read `localStorage` directly in components.
- Use the shared Axios client from `src/api/client.js` for every API call.
- Component files use **PascalCase** (e.g., `ProjectDetail.jsx`); utility files use **camelCase**.
- Style exclusively with Tailwind utility classes — no inline styles or separate CSS files except `index.css`.
- Protect every non-login route with `<ProtectedRoute>`.

### Docker
- Use pinned base image tags (e.g., `node:20-alpine`, `nginx:1.27-alpine`).
- Each image must have a `HEALTHCHECK` instruction.
- Always include a `.dockerignore` in each service directory to exclude `node_modules`, `.git`, and build artefacts.

### GitHub Actions
- Workflow context paths must match the exact directory casing in the repository (`./Backend`, `./Frontend`).
- Always pin action versions to the latest stable major tag (e.g., `@v6`).
- Include Docker layer caching (`cache-from`/`cache-to` with `type=gha`) to speed up builds.
