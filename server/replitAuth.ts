import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import express, { type Express, type RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Allow local development without Replit OIDC by falling back to a simple dev auth
const isDev = process.env.NODE_ENV !== "production";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
  createTableIfMissing: isDev,
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
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Ensure (de)serializers are always registered, including in dev fallback
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));
  
  // If missing REPLIT_DOMAINS or REPL_ID in dev, use a simple local auth stub
  if (
    isDev && (!process.env.REPLIT_DOMAINS || !process.env.REPL_ID)
  ) {
    // Very basic username login stored in session for local testing only
    app.post("/api/dev/login", express.json(), async (req, res) => {
      const { email = "dev@example.com", id = "dev-user" } = req.body ?? {};
      const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1h
      const user = {
        claims: {
          sub: id,
          email,
          first_name: "Dev",
          last_name: "User",
          profile_image_url: "",
          exp,
        },
        expires_at: exp,
      } as any;
      await storage.upsertUser({
        id,
        email,
        firstName: "Dev",
        lastName: "User",
        profileImageUrl: "",
      });
      // Regenerate session to avoid fixation and ensure persistence
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          console.error("Dev login session regenerate failed:", regenErr);
          return res.status(500).json({ message: "Login failed" });
        }
        (req as any).login(user, (err: any) => {
          if (err) {
            console.error("Dev login failed:", err);
            return res.status(500).json({ message: "Login failed" });
          }
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error("Dev login session save failed:", saveErr);
              return res.status(500).json({ message: "Login failed" });
            }
            res.json({ ok: true });
          });
        });
      });
    });

    app.post("/api/dev/logout", (_req, res) => {
      _req.logout(() => res.json({ ok: true }));
    });

    // Map expected routes to dev ones
    app.get("/api/login", (_req, res) => res.redirect("/"));
    app.get("/api/callback", (_req, res) => res.redirect("/"));
    app.get("/api/logout", (req, res) => {
      req.logout(() => res.redirect("/"));
    });

  return; // Skip real OIDC setup
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }


  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // In development, accept a session user even if Passport doesn't mark as authenticated yet
  if (isDev) {
    const sessionUser = (req as any).session?.passport?.user;
    if (sessionUser) {
      (req as any).user = sessionUser;
      return next();
    }
  }

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
