/**
 * Authentication utilities with per-user sessions
 */

import { cookies } from 'next/headers';
import { createHmac } from 'crypto';

const SESSION_COOKIE_NAME = 'miramar-session';

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
}

function getSecret(): string {
  return process.env.SESSION_SECRET || 'dev-secret-change-me';
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

function encodeSession(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64');
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function decodeSession(token: string): SessionData | null {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expectedSig = sign(payload);
    if (signature !== expectedSig) return null;

    return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

export async function createSession(data: SessionData) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encodeSession(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return null;

  return decodeSession(cookie.value);
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return session?.role === 'admin';
}

/**
 * Decode a session token without using the cookies() API.
 * Used in middleware (Edge Runtime) where cookies() is not available.
 */
export function decodeSessionToken(token: string): SessionData | null {
  return decodeSession(token);
}

// Keep backward compat for old single-password flow during migration
export function validatePassword(password: string): boolean {
  const validPassword = process.env.DASHBOARD_PASSWORD || 'miramar2025';
  return password === validPassword;
}
