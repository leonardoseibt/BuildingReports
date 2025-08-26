import express, { type Express, type RequestHandler } from "express";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "./storage";
import csurf from "csurf";

const isProd = process.env.NODE_ENV === "production";

// Idle (rolling) and absolute lifetimes
const SESSION_IDLE_MS = Number(process.env.SESSION_IDLE_MS || 60 * 60 * 1000); // 1h
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000); // 7d

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Simple IP-based login attempt limiter
const loginAttempts = new Map<string, { count: number; first: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

const rateLimit: RequestHandler = (req, res, next) => {
  const ip = req.ip || "";
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, first: now });
    return next();
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return res.status(429).json({ message: "Muitas tentativas. Tente novamente mais tarde." });
  }
  entry.count++;
  next();
};

export function getSession() {
  const pgStore = connectPg(session);
  const store = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: !isProd,
    ttl: SESSION_TTL_MS,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store,
    resave: false,
    saveUninitialized: false,
    name: process.env.SESSION_COOKIE_NAME || "sid",
    rolling: true, // idle timeout refresh
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: (process.env.SESSION_SAMESITE as any) || (isProd ? "lax" : "lax"),
      maxAge: Math.min(SESSION_IDLE_MS, SESSION_TTL_MS),
    },
  });
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
    const exp = Math.floor(Date.now() / 1000) + 60 * 60;
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

  app.post("/api/login", rateLimit, express.json(), async (req, res) => {
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
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // claim expiry (1h)
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
  if (sessionUser) {
    (req as any).user = sessionUser;
    return next();
  }
  if (req.isAuthenticated() && user?.expires_at) {
    if (Date.now() / 1000 > user.expires_at) {
      return req.session.destroy(() => {
        res.status(401).json({ message: 'Sessão expirada' });
      });
    }
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
