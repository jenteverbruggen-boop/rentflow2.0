# UI / Frontend skill

When generating or reviewing frontend code for RentFlow 2.0, follow these rules:

## Component structure
- Each page lives in `Frontend/src/pages/` and each reusable piece in `Frontend/src/components/`.
- All route-protected pages must be wrapped with `<ProtectedRoute>` in `App.jsx`.
- Use the `useAuth()` hook (from `AuthContext`) for any auth-related data — never access `localStorage` directly.

## Styling
- Use **Tailwind CSS utility classes only**; do not add inline styles or create new CSS files.
- Dark-theme palette already used: `bg-gray-950`, `bg-gray-900`, `border-gray-800`, `text-gray-300/500`.
- Action buttons: `bg-blue-600 hover:bg-blue-500 text-white rounded-lg`.
- Modals: `fixed inset-0 bg-black/60 flex items-center justify-center z-50`.

## Data fetching
- Always use the shared Axios client: `import api from '../api/client'`.
- Call `api.get/post/put/delete` — never use `fetch()` directly.
- Handle errors by catching the rejected promise and surfacing a user-visible message.

## Forms
- Use controlled inputs (`value` + `onChange`).
- Mark required fields with the `required` HTML attribute and a `*` in the placeholder.
