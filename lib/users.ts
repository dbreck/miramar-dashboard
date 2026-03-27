/**
 * User management with JSON file storage
 *
 * Local dev: uses data/users.json (writable)
 * Vercel: uses /tmp/users.json (only writable path)
 *   - Default admin is re-seeded on each cold start from env vars
 *   - Dynamically-added users persist until next cold start
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash, randomBytes } from 'crypto';

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

// Always use /tmp/ — writable on both Vercel and local dev
const USERS_FILE = '/tmp/miramar-users.json';

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex');
}

function generateId(): string {
  return randomBytes(8).toString('hex');
}

function readUsers(): User[] {
  const file = USERS_FILE;
  if (!existsSync(file)) {
    return [];
  }
  try {
    const data = readFileSync(file, 'utf-8');
    const users: User[] = JSON.parse(data);
    // Backfill permissions for users created before this field existed
    return users.map(u => ({
      ...u,
      permissions: u.permissions || { ...DEFAULT_PERMISSIONS },
    }));
  } catch {
    return [];
  }
}

function writeUsers(users: User[]): void {
  const file = USERS_FILE;
  const dir = dirname(file);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(file, JSON.stringify(users, null, 2), 'utf-8');
}

/**
 * Build the default admin from env vars.
 * Always available, even on Vercel cold starts.
 */
function buildDefaultAdmin(): User {
  const password = process.env.DASHBOARD_PASSWORD || 'miramar2025';
  const email = (process.env.ADMIN_EMAIL || 'admin@miramar.com').toLowerCase();
  const name = process.env.ADMIN_NAME || 'Admin';
  // Use a deterministic salt for the env-var admin so the hash is stable
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

/**
 * Ensure the default admin exists. Called on reads.
 * On Vercel, re-seeds /tmp/users.json on each cold start.
 */
export function ensureDefaultAdmin(): void {
  let users = readUsers();
  const defaultAdmin = buildDefaultAdmin();

  // Check if default admin already exists (by ID or email)
  const existingById = users.find(u => u.id === 'default-admin');
  const existingByEmail = users.find(u => u.email === defaultAdmin.email);

  if (existingById) {
    // Update password hash in case DASHBOARD_PASSWORD changed
    if (existingById.passwordHash !== defaultAdmin.passwordHash) {
      existingById.passwordHash = defaultAdmin.passwordHash;
      existingById.salt = defaultAdmin.salt;
      existingById.email = defaultAdmin.email;
      existingById.name = defaultAdmin.name;
      writeUsers(users);
    }
    return;
  }

  if (existingByEmail) {
    // Old-format admin exists (random ID from first deploy) — replace it
    users = users.filter(u => u.email !== defaultAdmin.email);
  }

  // Seed default admin
  users.unshift(defaultAdmin);
  writeUsers(users);
}

export function listUsers(): UserPublic[] {
  ensureDefaultAdmin();
  return readUsers().map(({ passwordHash, salt, ...rest }) => rest);
}

export function getUserByEmail(email: string): User | undefined {
  ensureDefaultAdmin();
  return readUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

export function getUserById(id: string): User | undefined {
  ensureDefaultAdmin();
  return readUsers().find(u => u.id === id);
}

export function validateUserPassword(email: string, password: string): User | null {
  const user = getUserByEmail(email);
  if (!user) return null;

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return null;

  return user;
}

export function createUser(email: string, name: string, password: string, role: 'admin' | 'viewer', permissions?: Partial<UserPermissions>): UserPublic {
  ensureDefaultAdmin();
  const users = readUsers();

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
  writeUsers(users);

  const { passwordHash: _, salt: __, ...publicUser } = user;
  return publicUser;
}

export function updateUser(id: string, updates: { name?: string; role?: 'admin' | 'viewer'; password?: string; permissions?: Partial<UserPermissions> }): UserPublic {
  ensureDefaultAdmin();
  const users = readUsers();
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

  writeUsers(users);

  const { passwordHash: _, salt: __, ...publicUser } = users[index];
  return publicUser;
}

export function deleteUser(id: string): void {
  ensureDefaultAdmin();
  const users = readUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) throw new Error('User not found');

  // Prevent deleting the default admin
  if (users[index].id === 'default-admin') {
    throw new Error('Cannot delete the default admin user');
  }

  // Prevent deleting the last admin
  const adminCount = users.filter(u => u.role === 'admin').length;
  if (users[index].role === 'admin' && adminCount <= 1) {
    throw new Error('Cannot delete the last admin user');
  }

  users.splice(index, 1);
  writeUsers(users);
}
