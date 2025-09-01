import express, { type Express, type RequestHandler } from "express";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "./storage";
import csurf from "csurf";
import rateLimit from "express-rate-limit";
import { createRequire } from "module";

const isProd = process.env.NODE_ENV === "production";

// Idle (rolling) and absolute lifetimes
const SESSION_IDLE_MS = Number(process.env.SESSION_IDLE_MS || 60 * 60 * 1000); // 1h cookie idle auto-refresh window
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000); // 7d absolute
// Per-user claim lifetime (logical auth expiry separate from cookie idle)
const CLAIM_LIFETIME_SEC = Number(process.env.CLAIM_LIFETIME_SEC || 60 * 60); // 1h logical token expiry
// If remaining lifetime is below this window, we extend (rolling logic)
const ROLLING_RENEW_WINDOW_SEC = Number(process.env.ROLLING_RENEW_WINDOW_SEC || 5 * 60); // 5m

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const require = createRequire(import.meta.url);
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

let loginRateLimit: RequestHandler;
try {
  const redisUrl = process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL;
  let store: any;
  if (redisUrl) {
    const { createClient } = require("redis");
    const { RedisStore } = require("rate-limit-redis");
    const client = createClient({ url: redisUrl });
    client.on("error", (err: unknown) => {
      console.error("Redis error", err);
    });
    client.connect().catch((err: unknown) => {
      console.error("Redis connection error", err);
    });
    store = new RedisStore({
      sendCommand: (...args: string[]) => client.sendCommand(args),
    });
  }

  loginRateLimit = rateLimit({
    windowMs: WINDOW_MS,
    limit: MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ message: "Muitas tentativas. Tente novamente mais tarde." });
    },
    ...(store ? { store } : {}),
  });
} catch (err) {
  console.error("Failed to initialize rate limiter", err);
  loginRateLimit = rateLimit({
    windowMs: WINDOW_MS,
    limit: MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ message: "Muitas tentativas. Tente novamente mais tarde." });
    },
  });
}

let cachedSessionMw: any; // cache single instance to avoid multiple pools

function buildSessionMiddleware() {
  const PgStore = connectPg(session);
  const ttlSeconds = Math.floor(SESSION_TTL_MS / 1000); // connect-pg-simple expects seconds
  const store: any = new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: !isProd,
    ttl: ttlSeconds,
    tableName: "sessions",
    // Pass through minimal pool config to reduce idle disconnect churn
    pruneSessionInterval: Number(process.env.SESSION_PRUNE_INTERVAL_SEC || 60),
  });
  // Rebuild store on ECONNRESET (network flakiness / Neon socket close)
  store.on?.('error', (err: any) => {
    if (err?.code === 'ECONNRESET') {
      console.error('[session-store] ECONNRESET detected, recreating session store');
      cachedSessionMw = null; // force rebuild next request
    } else {
      console.error('[session-store] error', err);
    }
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store,
    resave: false,
    saveUninitialized: false,
    name: process.env.SESSION_COOKIE_NAME || 'sid',
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: (process.env.SESSION_SAMESITE as any) || (isProd ? 'lax' : 'lax'),
      maxAge: Math.min(SESSION_IDLE_MS, SESSION_TTL_MS),
    },
  });
}

export function getSession() {
  if (!cachedSessionMw) {
    cachedSessionMw = buildSessionMiddleware();
  }
  return cachedSessionMw;
}

export async function setupAuth(app: Express) {
  if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY));
  else app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Absolute TTL enforcement middleware (independent of rolling idle)
  app.use((req, res, next) => {
  const s: any = req.session as any;
    const now = Date.now();
    if (!s.createdAt) {
      s.createdAt = now;
    } else if (now - s.createdAt > SESSION_TTL_MS) {
      req.session.destroy(() => {
        return res.status(440).json({ message: "Sessão expirada" });
      });
      return;
    }
    next();
  });

  // CSRF protection: skip login/logout endpoints entirely; apply to all others.
  const csrfProtection = csurf({ cookie: false });
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/login') || req.path.startsWith('/api/logout')) {
      return next(); // no CSRF required for auth endpoints
    }
    return csrfProtection(req, res, next);
  });

  // Token endpoint must have csrfProtection run (above) to generate secret+token (GET is safe so no validation failure)
  app.get('/api/csrf-token', (req: any, res) => {
    try {
      const token = (req as any).csrfToken?.();
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json({ token: token || null });
    } catch {
      res.status(500).json({ token: null });
    }
  });

  // Simple (de)serializers storing the full user object in session
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Local login endpoints
  // GET /api/login => auto login demo user (for convenience in non-production)
  app.get("/api/login", async (req, res) => {
    if (isProd) return res.status(404).json({ message: "Not found" });
    const email = "dev@example.com";
    const normalizedEmail = email.trim().toLowerCase();
    const dbUser = await storage.ensureUserByEmail(normalizedEmail, "Dev User");
    const exp = Math.floor(Date.now() / 1000) + CLAIM_LIFETIME_SEC;
    const user: any = {
      claims: { sub: dbUser.id, email: normalizedEmail, full_name: dbUser.fullName, exp },
      expires_at: exp,
    };
    req.session.regenerate((regenErr) => {
      if (regenErr) return res.status(500).json({ message: "Login failed" });
      (req as any).login(user, (err: any) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        req.session.save((saveErr) => {
          if (saveErr) return res.status(500).json({ message: "Login failed" });
          res.redirect("/");
        });
      });
    });
  });

  app.get("/api/verify-email", async (req, res) => {
    const token = req.query.token;
    if (typeof token !== "string") return res.status(400).json({ message: "Token inválido" });
    const user = await storage.verifyUserByToken(token);
    if (!user) return res.status(400).json({ message: "Token inválido" });
    res.redirect("/login?verified=1");
  });

  app.post("/api/login", loginRateLimit, express.json(), async (req, res) => {
    try {
      const { email, password } = authSchema.parse(req.body);
      const normalizedEmail = email.trim().toLowerCase();
      const dbUser = await storage.getUserByEmail(normalizedEmail);
      if (!dbUser || !dbUser.passwordHash) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      if (isProd && !dbUser.emailVerified) {
        return res.status(401).json({ message: "E-mail não verificado" });
      }
      const match = await bcrypt.compare(password, dbUser.passwordHash);
      if (!match) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
  const exp = Math.floor(Date.now() / 1000) + CLAIM_LIFETIME_SEC; // claim expiry
      const user: any = {
        claims: {
          sub: dbUser.id,
          email: dbUser.email,
          full_name: dbUser.fullName,
          exp,
        },
        expires_at: exp,
      };
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((regenErr) => {
          if (regenErr) return reject(regenErr);
          (req as any).login(user, (err: any) => {
            if (err) return reject(err);
            req.session.save((saveErr) => {
              if (saveErr) return reject(saveErr);
              resolve();
            });
          });
        });
      });
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: err.errors });
      }
      if ((err as any)?.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ message: 'Falha de verificação CSRF' });
      }
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/login");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user: any = req.user as any;
  const sessionUser = (req as any).session?.passport?.user;
  // If user object exists in session, enforce per-claim expiration (soft TTL distinct from absolute SESSION_TTL_MS)
  if (sessionUser?.expires_at && Date.now() / 1000 > sessionUser.expires_at) {
    // Destroy session and signal client to re-authenticate
    return req.session.destroy(() => {
      res.status(401).json({ message: 'Sessão expirada' });
    });
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const activeUser = sessionUser || (req.isAuthenticated() ? user : null);
  if (activeUser?.expires_at) {
    // Rolling renewal: extend if within window but not yet expired
    const remaining = activeUser.expires_at - nowSec;
    if (remaining > 0 && remaining < ROLLING_RENEW_WINDOW_SEC) {
      const newExp = nowSec + CLAIM_LIFETIME_SEC;
      activeUser.expires_at = newExp;
      if (activeUser.claims) activeUser.claims.exp = newExp;
      // Persist updated user in session if present
      if ((req as any).session?.passport?.user) {
        (req as any).session.passport.user = activeUser;
        try { await new Promise(r => (req.session as any).save(r)); } catch { /* ignore save errors */ }
      }
    }
    (req as any).user = activeUser;
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

// Explicit refresh helper for client: extends claim if still valid (not expired)
export const refreshSession: RequestHandler = async (req, res) => {
  const sessionUser = (req as any).session?.passport?.user;
  const nowSec = Math.floor(Date.now() / 1000);
  if (!sessionUser?.expires_at) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (nowSec >= sessionUser.expires_at) {
    return res.status(401).json({ message: 'Sessão expirada' });
  }
  const remaining = sessionUser.expires_at - nowSec;
  // Only refresh if in renewal window (avoid unbounded extension by spamming)
  if (remaining < ROLLING_RENEW_WINDOW_SEC) {
    const newExp = nowSec + CLAIM_LIFETIME_SEC;
    sessionUser.expires_at = newExp;
    if (sessionUser.claims) sessionUser.claims.exp = newExp;
    try { await new Promise(r => (req.session as any).save(r)); } catch { /* ignore */ }
  }
  res.json({ expires_at: sessionUser.expires_at, now: nowSec });
};
