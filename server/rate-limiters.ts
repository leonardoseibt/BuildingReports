import rateLimit from "express-rate-limit";

// Rate limiters específicos por tipo de operação

export const strictLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por IP
  skipSuccessfulRequests: true, // Não conta logins bem-sucedidos
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas de login. Aguarde 15 minutos." },
});

export const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // 60 requisições GET por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Limite de requisições excedido. Aguarde 1 minuto." },
});

export const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 operações de escrita por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Limite de operações excedido. Aguarde 1 minuto." },
});

export const heavyOperationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 relatórios gerados em 5 minutos
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Limite de geração de relatórios excedido. Aguarde alguns minutos." },
});

export const userCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 usuários criados por hora
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Limite de criação de usuários excedido. Aguarde 1 hora." },
});
