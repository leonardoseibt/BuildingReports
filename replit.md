# Replit Integration (legacy)

This document described the previous Replit-based authentication and setup. The project has been migrated to a standalone local auth based on express-session with a PostgreSQL session store.

What changed:
- Replit OIDC and openid-client were removed from the runtime.
- New auth endpoints are available: GET /api/login (demo user), POST /api/login, GET /api/logout.
- Client landing buttons now use /api/login.

Action: You can delete this file if no longer relevant to your workflow.

### Data Management
- **TanStack React Query**: Server state management and caching
- **React Hook Form**: Performant form library with minimal re-renders
- **Zod**: TypeScript-first schema validation for runtime type checking
- **date-fns**: Modern JavaScript date utility library

### Geographic Services
The application integrates with Brazilian postal code (CEP) lookup services for automatic address completion and bioclimatic zone determination based on geographic location.