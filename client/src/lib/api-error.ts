export interface ParsedApiError {
  status?: number;
  message: string;
  rawMessage: string;
}

function extractStatusAndPayload(raw: string) {
  const match = raw.match(/^\s*(\d{3}):\s*([\s\S]*)$/);
  if (!match) return { status: undefined, payload: raw };
  const status = Number.parseInt(match[1], 10);
  const payload = match[2] ?? '';
  return { status, payload };
}

function normalizeMessage(payload: string, raw: string) {
  const trimmed = payload?.trim?.() ?? '';
  if (!trimmed) return raw;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string' && parsed.trim().length > 0) {
      return parsed;
    }
    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
      const msg = (parsed as any).message;
      if (typeof msg === 'string' && msg.trim().length > 0) {
        return msg;
      }
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

export function parseApiError(error: unknown): ParsedApiError {
  if (error instanceof Error) {
    const raw = error.message;
    const { status, payload } = extractStatusAndPayload(raw);
    const message = normalizeMessage(payload, raw);
    return { status, message, rawMessage: raw };
  }
  if (typeof error === 'string') {
    return { status: undefined, message: error, rawMessage: error };
  }
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    const msg = (error as any).message;
    return { status: undefined, message: msg, rawMessage: msg };
  }
  return { status: undefined, message: 'Erro desconhecido', rawMessage: '' };
}

export function isStatusError(error: unknown, statusCode: number): boolean {
  const parsed = parseApiError(error);
  return parsed.status === statusCode;
}

export function isForbiddenError(error: unknown): boolean {
  return isStatusError(error, 403);
}
