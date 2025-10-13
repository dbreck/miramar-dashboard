/**
 * Authentication utilities
 */

import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'miramar-session';
const SESSION_TOKEN = 'authenticated';

export async function createSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, SESSION_TOKEN, {
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

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  return session?.value === SESSION_TOKEN;
}

export function validatePassword(password: string): boolean {
  const validPassword = process.env.DASHBOARD_PASSWORD || 'miramar2025';
  return password === validPassword;
}
