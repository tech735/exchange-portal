// @ts-nocheck
// Vanilla Redis TCP client for Deno Edge Functions.
// Requires REDIS_URL in Supabase secrets (e.g. redis://default:password@host:port from Railway).
// Falls back silently when not configured so the app keeps working without Redis.

import { connect } from "https://deno.land/x/redis@v0.32.1/mod.ts";

const REDIS_URL = Deno.env.get('REDIS_URL');

let _client: any = null;

function parseURL(url: string) {
  const u = new URL(url);
  return {
    hostname: u.hostname,
    port: u.port ? parseInt(u.port) : 6379,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    tls: u.protocol === 'rediss:',
    maxRetryCount: 3,
  };
}

async function getClient() {
  if (!REDIS_URL) return null;
  if (_client) return _client;
  try {
    _client = await connect(parseURL(REDIS_URL));
    return _client;
  } catch (e) {
    console.error('[redis] connection failed:', e);
    return null;
  }
}

export async function get<T>(key: string): Promise<T | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    _client = null; // force reconnect on next call
    return null;
  }
}

export async function set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = await getClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch {
    _client = null;
  }
}

export async function del(key: string): Promise<void> {
  const client = await getClient();
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    _client = null;
  }
}

export function isAvailable(): boolean {
  return !!REDIS_URL;
}
