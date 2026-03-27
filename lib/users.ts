/**
 * User management with JSON file storage
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash, randomBytes } from 'crypto';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export type UserPublic = Omit<User, 'passwordHash' | 'salt'>;

const USERS_FILE = join(process.cwd(), 'data', 'users.json');

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex');
}

function generateId(): string {
  return randomBytes(8).toString('hex');
}

function readUsers(): User[] {
  if (!existsSync(USERS_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeUsers(users: User[]): void {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/**
 * Initialize with default admin user if no users exist.
 * Uses DASHBOARD_PASSWORD env var as the initial admin password.
 */
export function ensureDefaultAdmin(): void {
  const users = readUsers();
  if (users.length > 0) return;

  const password = process.env.DASHBOARD_PASSWORD || 'miramar2025';
  const salt = randomBytes(16).toString('hex');
  const admin: User = {
    id: generateId(),
    email: 'admin@miramar.com',
    name: 'Admin',
    role: 'admin',
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
  };

  writeUsers([admin]);
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
  return readUsers().find(u => u.id === id);
}

export function validateUserPassword(email: string, password: string): User | null {
  const user = getUserByEmail(email);
  if (!user) return null;

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return null;

  return user;
}

export function createUser(email: string, name: string, password: string, role: 'admin' | 'viewer'): UserPublic {
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
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeUsers(users);

  const { passwordHash: _, salt: __, ...publicUser } = user;
  return publicUser;
}

export function updateUser(id: string, updates: { name?: string; role?: 'admin' | 'viewer'; password?: string }): UserPublic {
  const users = readUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) throw new Error('User not found');

  if (updates.name !== undefined) users[index].name = updates.name;
  if (updates.role !== undefined) users[index].role = updates.role;
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
  const users = readUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) throw new Error('User not found');

  // Prevent deleting the last admin
  const adminCount = users.filter(u => u.role === 'admin').length;
  if (users[index].role === 'admin' && adminCount <= 1) {
    throw new Error('Cannot delete the last admin user');
  }

  users.splice(index, 1);
  writeUsers(users);
}
