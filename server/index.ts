import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(createLoggingMiddleware());

if (process.env.NODE_ENV !== "test") {
  (async () => {
    const server = await registerRoutes(app);

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
