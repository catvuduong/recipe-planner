import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

// Add new tables here as extra statements; they are all created once, behind a lock.
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, title TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())',
  `CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    minutes INTEGER NOT NULL CHECK (minutes >= 0),
    servings INTEGER NOT NULL CHECK (servings >= 1),
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC,
    unit TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS ingredients_recipe_idx ON ingredients (recipe_id)',
  `CREATE TABLE IF NOT EXISTS steps (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    text TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS steps_recipe_idx ON steps (recipe_id)',
  `CREATE TABLE IF NOT EXISTS meal_plan (
    id SERIAL PRIMARY KEY,
    day DATE NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    UNIQUE (day, slot)
  )`,
];

// Minimal query surface shared by the pool and by a transaction client.
export interface Queryable {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
    : null;
  private ready: Promise<void> | null = null;

  get enabled(): boolean {
    return this.pool !== null;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.pool) throw new ServiceUnavailableException('database is not configured');
    await this.ensureSchema();
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  // Runs fn inside BEGIN/COMMIT on a single connection; any throw rolls everything back.
  async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    if (!this.pool) throw new ServiceUnavailableException('database is not configured');
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(this.wrap(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private wrap(client: PoolClient): Queryable {
    return {
      query: async <T>(sql: string, params: unknown[] = []) => {
        const res = await client.query(sql, params);
        return res.rows as T[];
      },
    };
  }

  private ensureSchema(): Promise<void> {
    this.ready ??= (async () => {
      // Concurrent instances (serverless cold starts, parallel test files) race on CREATE TABLE IF NOT EXISTS,
      // so serialize schema setup behind a transaction-scoped advisory lock.
      const client = await this.pool!.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(727274)');
        for (const statement of SCHEMA) await client.query(statement);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        this.ready = null;
        throw err;
      } finally {
        client.release();
      }
    })();
    return this.ready;
  }
}
