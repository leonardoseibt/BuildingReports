import express, { type Express, type RequestHandler } from "express";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storage } from "./storage";

const isProd = process.env.NODE_ENV === "production";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; first: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

const rateLimit: RequestHandler = (req, res, next) => {
  const ip = req.ip ?? "";
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
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: !isProd,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

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
      const exp = Math.floor(Date.now() / 1000) + 60 * 60;
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
  if (sessionUser) {
    (req as any).user = sessionUser;
    return next();
  }
  if (req.isAuthenticated() && user?.expires_at) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
