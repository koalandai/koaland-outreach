import { nanoid } from 'nanoid';
import crypto from 'crypto';

export function generateToken(length = 24): string {
  return nanoid(length);
}

export function generatePdfToken(): string {
  return nanoid(32);
}

export function generateTrackingToken(data: Record<string, string>): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.DASHBOARD_ACCESS_TOKEN || 'koaland')
    .update(payload).digest('base64url').slice(0, 8);
  return `${payload}.${sig}`;
}

export function decodeTrackingToken(token: string): Record<string, string> | null {
  try {
    const [payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}
