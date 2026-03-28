/**
 * User management with Vercel Blob storage
 *
 * Users are stored as a JSON blob in Vercel Blob storage,
 * persisting across deployments and cold starts.
 * Falls back to /tmp/ file for local development.
 */

import { createHash, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

let blobModule: typeof import('@vercel/blob') | null = null;

function useBlobStorage(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function getBlob() {
  if (!blobModule) {
    blobModule = await import('@vercel/blob');
  }
  return blobModule;
}

export interface UserPermissions {
  reconcile: boolean;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  reconcile: false,
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
  permissions: UserPermissions;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export type UserPublic = Omit<User, 'passwordHash' | 'salt'>;

const BLOB_PATH = 'miramar-users.json';

// Local file path for development (when Vercel Blob is not available)
const LOCAL_DATA_DIR = join(process.cwd(), '.data');
const LOCAL_USERS_FILE = join(LOCAL_DATA_DIR, 'users.json');

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex');
}

function generateId(): string {
  return randomBytes(8).toString('hex');
}

function backfillPermissions(users: User[]): User[] {
  return users.map(u => ({
    ...u,
    permissions: u.permissions || { ...DEFAULT_PERMISSIONS },
  }));
}

// In-memory cache to avoid reading storage on every request within same invocation
let memoryCache: { users: User[]; timestamp: number } | null = null;
const MEMORY_TTL = 10_000; // 10 seconds

function readUsersLocal(): User[] {
  try {
    if (!existsSync(LOCAL_USERS_FILE)) return [];
    const data = readFileSync(LOCAL_USERS_FILE, 'utf-8');
    return backfillPermissions(JSON.parse(data));
  } catch {
    return [];
  }
}

function writeUsersLocal(users: User[]): void {
  if (!existsSync(LOCAL_DATA_DIR)) {
    mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }
  writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

async function readUsers(): Promise<User[]> {
  if (memoryCache && Date.now() - memoryCache.timestamp < MEMORY_TTL) {
    return memoryCache.users;
  }

  // Local file storage when Blob is not configured
  if (!useBlobStorage()) {
    const users = readUsersLocal();
    memoryCache = { users, timestamp: Date.now() };
    return users;
  }

  try {
    const blob = await getBlob();
    const { blobs } = await blob.list({ prefix: BLOB_PATH });
    if (blobs.length === 0) return [];

    const fetchUrl = blobs[0].downloadUrl || blobs[0].url;
    const response = await fetch(fetchUrl);
    if (!response.ok) return [];

    const users: User[] = await response.json();
    const result = backfillPermissions(users);
    memoryCache = { users: result, timestamp: Date.now() };
    return result;
  } catch (e: any) {
    console.error('Failed to read users from blob:', e?.message || e);
    return [];
  }
}

async function writeUsers(users: User[]): Promise<void> {
  // Local file storage when Blob is not configured
  if (!useBlobStorage()) {
    writeUsersLocal(users);
    memoryCache = { users, timestamp: Date.now() };
    return;
  }

  try {
    const blob = await getBlob();

    // Delete old blob(s) first, then write new one
    const { blobs: existing } = await blob.list({ prefix: BLOB_PATH });
    if (existing.length > 0) {
      await blob.del(existing.map(b => b.url));
    }

    await blob.put(BLOB_PATH, JSON.stringify(users, null, 2), {
      access: 'private',
      contentType: 'application/json',
    });
    memoryCache = { users, timestamp: Date.now() };
  } catch (e: any) {
    console.error('Failed to write users to blob:', e?.message || e, e?.stack);
    throw new Error('Failed to save user data: ' + (e?.message || 'unknown error'));
  }
}

function buildDefaultAdmin(): User {
  const password = process.env.DASHBOARD_PASSWORD || 'miramar2025';
  const email = (process.env.ADMIN_EMAIL || 'admin@miramar.com').toLowerCase();
  const name = process.env.ADMIN_NAME || 'Admin';
  const salt = createHash('sha256').update('miramar-admin-salt-' + email).digest('hex').slice(0, 32);
  return {
    id: 'default-admin',
    email,
    name,
    role: 'admin',
    permissions: { reconcile: true },
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date('2026-03-27').toISOString(),
  };
}

export async function ensureDefaultAdmin(): Promise<void> {
  let users = await readUsers();
  const defaultAdmin = buildDefaultAdmin();

  const existingById = users.find(u => u.id === 'default-admin');
  const existingByEmail = users.find(u => u.email === defaultAdmin.email);

  if (existingById) {
    if (existingById.passwordHash !== defaultAdmin.passwordHash) {
      existingById.passwordHash = defaultAdmin.passwordHash;
      existingById.salt = defaultAdmin.salt;
      existingById.email = defaultAdmin.email;
      existingById.name = defaultAdmin.name;
      await writeUsers(users);
    }
    return;
  }

  if (existingByEmail) {
    users = users.filter(u => u.email !== defaultAdmin.email);
  }

  users.unshift(defaultAdmin);
  await writeUsers(users);
}

export async function listUsers(): Promise<UserPublic[]> {
  await ensureDefaultAdmin();
  const users = await readUsers();
  return users.map(({ passwordHash, salt, ...rest }) => rest);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  await ensureDefaultAdmin();
  const users = await readUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export async function getUserById(id: string): Promise<User | undefined> {
  await ensureDefaultAdmin();
  const users = await readUsers();
  return users.find(u => u.id === id);
}

export async function validateUserPassword(email: string, password: string): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return null;

  return user;
}

export async function createUser(email: string, name: string, password: string, role: 'admin' | 'viewer', permissions?: Partial<UserPermissions>): Promise<UserPublic> {
  await ensureDefaultAdmin();
  const users = await readUsers();

  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('A user with this email already exists');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const salt = randomBytes(16).toString('hex');
  const user: User = {
    id: generateId(),
    email: email.toLowerCase(),
    name,
    role,
    permissions: { ...DEFAULT_PERMISSIONS, ...permissions },
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeUsers(users);

  const { passwordHash: _, salt: __, ...publicUser } = user;
  return publicUser;
}

export async function updateUser(id: string, updates: { name?: string; role?: 'admin' | 'viewer'; password?: string; permissions?: Partial<UserPermissions> }): Promise<UserPublic> {
  await ensureDefaultAdmin();
  const users = await readUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) throw new Error('User not found');

  if (updates.name !== undefined) users[index].name = updates.name;
  if (updates.role !== undefined) users[index].role = updates.role;
  if (updates.permissions !== undefined) {
    users[index].permissions = { ...(users[index].permissions || DEFAULT_PERMISSIONS), ...updates.permissions };
  }
  if (updates.password !== undefined) {
    if (updates.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    const salt = randomBytes(16).toString('hex');
    users[index].salt = salt;
    users[index].passwordHash = hashPassword(updates.password, salt);
  }

  await writeUsers(users);

  const { passwordHash: _, salt: __, ...publicUser } = users[index];
  return publicUser;
}

export async function deleteUser(id: string): Promise<void> {
  await ensureDefaultAdmin();
  const users = await readUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) throw new Error('User not found');

  if (users[index].id === 'default-admin') {
    throw new Error('Cannot delete the default admin user');
  }

  const adminCount = users.filter(u => u.role === 'admin').length;
  if (users[index].role === 'admin' && adminCount <= 1) {
    throw new Error('Cannot delete the last admin user');
  }

  users.splice(index, 1);
  await writeUsers(users);
}
