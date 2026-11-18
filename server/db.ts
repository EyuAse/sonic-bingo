import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();

// Configure WebSocket for Node.js environment
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('FATAL: DATABASE_URL environment variable is required to connect to Neon PostgreSQL.');
}

// Neon Serverless Connection Pool with High-Concurrency Optimization
// max: 50 connections accommodates 200+ concurrent cartela purchases during lobby countdown spikes
// connectionTimeoutMillis: 10000 (10s fast-fail guard prevents infinite request queue starvation)
// idleTimeoutMillis: 180000 (3 minutes keeps active pool warm while safely recycling idle sockets)
export const pool = new Pool({
  connectionString,
  max: 50,
  idleTimeoutMillis: 180000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false
});

pool.on('error', (err) => {
  console.error('❌ [Neon DB Pool] Error:', err);
});

/**
 * Execute a single query against Neon PostgreSQL
 */
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 150) {
      console.log(`⏱️ [Neon DB Query] took ${duration}ms, rows: ${res.rowCount}`);
    }
    return { rows: res.rows as T[], rowCount: res.rowCount || 0 };
  } catch (error) {
    console.error('❌ [Neon DB Query Error]:', text, params, error);
    throw error;
  }
}

/**
 * Execute a series of queries inside an isolated ACID Transaction
 */
export async function withTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.warn('⚠️ [Neon DB Rollback Note]:', rbErr);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verify live connection to Neon PostgreSQL
 */
export async function checkDbConnection(): Promise<{ connected: boolean; latencyMs: number; version?: string; error?: string }> {
  const start = Date.now();
  try {
    await query('SELECT 1');
    const latencyMs = Date.now() - start;
    return {
      connected: true,
      latencyMs,
      version: 'Neon PostgreSQL 17 (Serverless Pooler)'
    };
  } catch (err: any) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err.message || String(err)
    };
  }
}

export interface TableStorageInfo {
  tableName: string;
  rowCount: number;
  totalBytes: number;
  totalFormatted: string;
}

export interface DatabaseStorageStats {
  totalBytes: number;
  totalFormatted: string;
  quotaBytes: number;
  quotaFormatted: string;
  usagePercent: number;
  status: 'healthy' | 'warning' | 'critical';
  tables: TableStorageInfo[];
  checkedAt: string;
}

/**
 * Query live PostgreSQL disk usage and per-table breakdowns against Neon Free-Tier limits (512 MB)
 */
export async function getDatabaseStorageStats(): Promise<DatabaseStorageStats> {
  const FREE_TIER_QUOTA_BYTES = 512 * 1024 * 1024; // 512 MB (536,870,912 bytes)

  const [sizeRes, tablesRes] = await Promise.all([
    query<{ total_bytes: string }>('SELECT pg_database_size(current_database()) as total_bytes'),
    query<{ table_name: string; row_count: string; total_bytes: string }>(`
      SELECT 
        relname AS table_name,
        COALESCE(n_live_tup, 0) AS row_count,
        COALESCE(pg_total_relation_size(relid), 0) AS total_bytes
      FROM pg_stat_user_tables
      ORDER BY total_bytes DESC
    `)
  ]);

  const totalBytes = parseInt(sizeRes.rows[0]?.total_bytes || '0', 10);
  const usagePercent = Math.min(100, Number(((totalBytes / FREE_TIER_QUOTA_BYTES) * 100).toFixed(2)));

  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (usagePercent > 85) {
    status = 'critical';
  } else if (usagePercent > 70) {
    status = 'warning';
  }

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`;
    return `${bytes} B`;
  };

  const tables: TableStorageInfo[] = tablesRes.rows.map(r => ({
    tableName: r.table_name,
    rowCount: parseInt(r.row_count || '0', 10),
    totalBytes: parseInt(r.total_bytes || '0', 10),
    totalFormatted: formatBytes(parseInt(r.total_bytes || '0', 10))
  }));

  return {
    totalBytes,
    totalFormatted: formatBytes(totalBytes),
    quotaBytes: FREE_TIER_QUOTA_BYTES,
    quotaFormatted: '512 MB',
    usagePercent,
    status,
    tables,
    checkedAt: new Date().toISOString()
  };
}

