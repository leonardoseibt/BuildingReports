import winston from 'winston';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

// Configuração do Winston Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'building-reports',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Logs de erro em arquivo separado
    new winston.transports.File({ 
      filename: path.join('logs', 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Logs gerais
    new winston.transports.File({ 
      filename: path.join('logs', 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
});

// Console logs apenas em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

/**
 * Tipos de eventos auditáveis
 */
export enum AuditEventType {
  // Autenticação
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILURE = 'auth.login.failure',
  LOGOUT = 'auth.logout',
  SESSION_EXPIRED = 'auth.session.expired',
  
  // Autorização
  ACCESS_DENIED = 'authz.access.denied',
  
  // CRUD Operations
  CREATE = 'data.create',
  READ = 'data.read',
  UPDATE = 'data.update',
  DELETE = 'data.delete',
  
  // Security Events
  RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  CSRF_VIOLATION = 'security.csrf.violation',
  INVALID_INPUT = 'security.input.invalid',
  SQL_INJECTION_ATTEMPT = 'security.sql_injection.attempt',
  
  // System Events
  SERVER_START = 'system.server.start',
  SERVER_STOP = 'system.server.stop',
  DB_CONNECTION_ERROR = 'system.db.connection_error',
  MIGRATION_RUN = 'system.migration.run',
}

/**
 * Interface para eventos de auditoria
 */
interface AuditEvent {
  eventType: AuditEventType;
  userId?: number;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  resourceId?: number | string;
  action?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Logger de auditoria
 */
export function logAudit(event: AuditEvent) {
  logger.info('AUDIT_EVENT', {
    ...event,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Middleware de logging de requisições
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Captura a resposta
  const originalSend = res.send;
  res.send = function(data: any) {
    res.send = originalSend;
    
    const duration = Date.now() - startTime;
    const user = (req as any).user;
    
    // Log da requisição
    logger.info('HTTP_REQUEST', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: user?.id,
      userName: user?.fullName,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    });
    
    // Log de auditoria para operações de escrita
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const resource = req.originalUrl.split('/')[2]; // /api/buildings -> buildings
      const resourceId = req.params.id;
      
      let eventType: AuditEventType;
      switch (req.method) {
        case 'POST': eventType = AuditEventType.CREATE; break;
        case 'PUT':
        case 'PATCH': eventType = AuditEventType.UPDATE; break;
        case 'DELETE': eventType = AuditEventType.DELETE; break;
        default: eventType = AuditEventType.READ;
      }
      
      logAudit({
        eventType,
        userId: user?.id,
        userName: user?.fullName,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        resource,
        resourceId,
        action: req.method,
        success: res.statusCode >= 200 && res.statusCode < 300,
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Middleware para log de erros
 */
export function errorLogger(err: any, req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  logger.error('ERROR', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    userId: user?.id,
    userName: user?.fullName,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    body: req.body,
    params: req.params,
    query: req.query,
  });
  
  next(err);
}

/**
 * Helper para log de eventos de segurança
 */
export function logSecurityEvent(
  type: AuditEventType,
  req: Request,
  details?: Record<string, any>
) {
  const user = (req as any).user;
  
  logAudit({
    eventType: type,
    userId: user?.id,
    userName: user?.fullName,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    success: false,
    metadata: details,
  });
}

export default logger;
