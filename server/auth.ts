import express, { type Express, type RequestHandler } from "express";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storage } from "./storage";

const isProd = process.env.NODE_ENV === "production";

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
  // GET /api/login => auto login demo user (for convenience)
  app.get("/api/login", async (req, res) => {
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

  // POST /api/login => accepts { email, fullName? }
  app.post("/api/login", express.json(), async (req, res) => {
    const { email = "dev@example.com", fullName = "Dev User" } = req.body ?? {};
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email é obrigatório" });
    }
    const dbUser = await storage.ensureUserByEmail(normalizedEmail, fullName);
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
          res.json({ ok: true });
        });
      });
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
