# Backend skill

When generating or reviewing backend code for RentFlow 2.0, follow these rules:

## Route handlers
- Every handler must be `async` and wrapped in `try/catch`:
  ```js
  router.get('/', auth, async (req, res) => {
    try {
      // ...
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  ```
- Return `{ error: string }` JSON for all error responses with an appropriate HTTP status.

## Prisma
- Import the shared singleton: `const prisma = require('../lib/prisma')`.
- Never call `new PrismaClient()` inside a route file.

## Auth & security
- Every route except `/api/auth/*` must apply the `auth` middleware as the second argument.
- CORS must use `cors({ origin: process.env.FRONTEND_URL })` — never a wildcard.
- Validate required request body fields before any database call; return `400` with a descriptive error.

## Input handling
- Parse URL parameter IDs with `parseInt(req.params.id)`.
- Validate date strings before passing to `new Date()`.
- Use `parseInt()` for numeric body fields (e.g., `quantity`, `totalStock`).

## Error messages
- Write error messages in English for consistency.
