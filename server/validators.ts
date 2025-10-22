import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

/**
 * Valida e sanitiza IDs numéricos de parâmetros de rota
 */
export function validateNumericId(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    const rawId = req.params[paramName];
    const id = Number(rawId);
    
    // Verificações de segurança
    if (!rawId || rawId.trim() === '') {
      return res.status(400).json({ message: 'ID não fornecido' });
    }
    
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'ID inválido: deve ser um número' });
    }
    
    if (id < 1) {
      return res.status(400).json({ message: 'ID inválido: deve ser positivo' });
    }
    
    if (id > Number.MAX_SAFE_INTEGER) {
      return res.status(400).json({ message: 'ID inválido: valor muito grande' });
    }
    
    // ID válido - disponibiliza para próximo middleware
    (req as any).validatedId = id;
    next();
  };
}

/**
 * Sanitiza strings para prevenir XSS
 */
export function sanitizeString(str: string): string {
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove tags HTML básicas
    .substring(0, 10000); // Limita tamanho
}

/**
 * Valida CPF/CNPJ
 */
export function validateCpfCnpj(value: string): boolean {
  const cleaned = value.replace(/\D/g, '');
  
  // CPF: 11 dígitos
  if (cleaned.length === 11) {
    // Verifica se não é sequência repetida (111.111.111-11, etc)
    if (/^(\d)\1{10}$/.test(cleaned)) return false;
    
    // Validação de dígitos verificadores do CPF
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned.charAt(i)) * (10 - i);
    }
    let remainder = 11 - (sum % 11);
    let digit1 = remainder >= 10 ? 0 : remainder;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned.charAt(i)) * (11 - i);
    }
    remainder = 11 - (sum % 11);
    let digit2 = remainder >= 10 ? 0 : remainder;
    
    return parseInt(cleaned.charAt(9)) === digit1 && 
           parseInt(cleaned.charAt(10)) === digit2;
  }
  
  // CNPJ: 14 dígitos
  if (cleaned.length === 14) {
    // Verifica se não é sequência repetida
    if (/^(\d)\1{13}$/.test(cleaned)) return false;
    
    // Validação de dígitos verificadores do CNPJ
    const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
    const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleaned.charAt(i)) * weights1[i];
    }
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;
    
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleaned.charAt(i)) * weights2[i];
    }
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;
    
    return parseInt(cleaned.charAt(12)) === digit1 && 
           parseInt(cleaned.charAt(13)) === digit2;
  }
  
  return false;
}

/**
 * Schema Zod para validação de pagination
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  offset: z.coerce.number().int().min(0).optional().default(0),
  page: z.coerce.number().int().min(1).optional(),
});

/**
 * Schema Zod para validação de CEP
 */
export const cepSchema = z.string()
  .regex(/^[0-9]{5}-?[0-9]{3}$/, 'CEP inválido')
  .transform(val => val.replace(/\D/g, ''));

/**
 * Middleware para sanitizar body antes de processar
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }
  next();
}

/**
 * Valida tamanho de upload
 */
export function validateFileSize(maxSizeInMB: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      if (sizeInMB > maxSizeInMB) {
        return res.status(413).json({ 
          message: `Arquivo muito grande. Tamanho máximo: ${maxSizeInMB}MB` 
        });
      }
    }
    next();
  };
}
