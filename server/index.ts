import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import net from "node:net";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const SENSITIVE_FIELDS = ["password", "passwordHash", "token", "secret"];

export function sanitizeLogData(obj: any): any {
  if (obj == null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeLogData(item));
  return Object.entries(obj).reduce<Record<string, any>>((acc, [key, value]) => {
    if (SENSITIVE_FIELDS.includes(key)) {
      return acc;
    }
    acc[key] = sanitizeLogData(value);
    return acc;
  }, {});
}

export function createLoggingMiddleware(logger = log) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson: any, ...args: any[]) {
      capturedJsonResponse = bodyJson;
      return (originalResJson as any).apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${path} ${res.statusCode} in ${duration}ms`;
        if (process.env.LOG_RESPONSES === "true" && capturedJsonResponse) {
          let sanitized = sanitizeLogData(capturedJsonResponse);
          let serialized = JSON.stringify(sanitized);
          if (serialized.length > 80) {
            serialized = serialized.slice(0, 79) + "…";
          }
          logLine += ` :: ${serialized}`;
        }

        logger(logLine);
      }
    });

    next();
  };
}

// In dev, keep the process alive and surface errors clearly
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

const app = express();

// Security: HTTP headers (relax CSP in development for Vite HMR / inline react-refresh)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: process.env.NODE_ENV === 'development'
    ? false
    : {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "https:", "'unsafe-inline'"],
          "img-src": ["'self'", 'data:'],
          "font-src": ["'self'", "https:", 'data:'],
          "connect-src": ["'self'"],
          "object-src": ["'none'"],
          "frame-ancestors": ["'self'"],
          "upgrade-insecure-requests": [],
        },
      },
}));

// CORS restricted (allow env ORIGIN or default localhost during dev)
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.ORIGIN || "http://localhost:5173")
  .split(/[,;\s]+/)
  .filter(Boolean);
app.use(cors({
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser / same-origin requests
    if (!origin) return cb(null, true);

    // Exact allowed origins from env
    if (allowedOrigins.includes(origin)) return cb(null, true);

    // Allow any localhost (dev) if explicitly enabled OR typical Vite dev
    const allowLocalhost = process.env.CORS_ALLOW_LOCALHOST === 'true';
    if (/^https?:\/\/localhost(?::\d+)?$/i.test(origin) || /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)) {
      if (allowLocalhost || allowedOrigins.some(o => /localhost/.test(o))) return cb(null, true);
    }

    // Deny silently (no CORS headers) instead of throwing to avoid noisy logs
    if (process.env.DEBUG_CORS === 'true') {
      log(`CORS denied for origin ${origin}`);
    }
    return cb(null, false);
  },
  credentials: true,
}));

// Parse bodies
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Basic rate limiter for auth & sensitive write endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(["/api/auth", "/api/users", "/api/technicians", "/api/buildings", "/api/reports"], authLimiter);

app.use(createLoggingMiddleware());

if (process.env.NODE_ENV !== "test") {
  (async () => {
    const server = await registerRoutes(app);

  // CSRF error handler (placed after routes so csurf can throw)
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({ message: 'Token CSRF inválido ou ausente' });
    }
    return next(err);
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the error but do not rethrow, to avoid crashing the dev server
    console.error("Unhandled application error:", err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Choose a port: prefer PORT env, otherwise 5000; if it's busy, pick the next available
  async function findAvailablePort(start: number, maxTries = 20): Promise<number> {
    function check(port: number): Promise<boolean> {
      return new Promise((resolve) => {
        const tester = net.createServer()
          .once('error', () => resolve(false))
          .once('listening', () => tester.close(() => resolve(true)))
          .listen(port, '0.0.0.0');
      });
    }
    let port = start;
    for (let i = 0; i < maxTries; i++, port++) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await check(port);
      if (ok) return port;
    }
    return start; // fallback
  }

  const preferred = parseInt(process.env.PORT || '5000', 10);
  const port = await findAvailablePort(preferred);
  const listenOptions: any = {
    port,
    host: process.env.HOST || "0.0.0.0",
  };
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }
    server.listen(listenOptions, () => {
      if (port !== preferred) {
        log(`port ${preferred} in use, serving on port ${port}`);
      } else {
        log(`serving on port ${port}`);
      }
    });
  })();
}
