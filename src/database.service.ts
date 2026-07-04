import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

interface Row {
  [column: string]: unknown;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db: ReturnType<typeof initSqlJs> extends Promise<infer P>
    ? P extends { Database: new (...args: never[]) => infer D }
      ? D
      : never
    : never;
  private dbPath: string;

  async onModuleInit() {
    const SQL = await initSqlJs();

    this.dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data.db');
    this.logger.log(`Abriendo base de datos: ${this.dbPath}`);

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.exec(`CREATE TABLE IF NOT EXISTS tasas_historica (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      moneda TEXT NOT NULL,
      valor REAL NOT NULL,
      fecha TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    this.db.exec(
      'CREATE INDEX IF NOT EXISTS idx_moneda_fecha ON tasas_historica (moneda, fecha)',
    );

    this.persist();
  }

  onModuleDestroy() {
    this.persist();
    this.db.close();
  }

  persist(): void {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  queryAll(sql: string, params: (number | string | null)[] = []): Row[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows: Row[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as Row);
    }
    stmt.free();
    return rows;
  }

  queryOne(sql: string, params: (number | string | null)[] = []): Row | null {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const row = stmt.step() ? (stmt.getAsObject() as Row) : null;
    stmt.free();
    return row;
  }

  exec(sql: string, params: (number | string | null)[] = []): void {
    this.db.run(sql, params);
  }

  begin(): void {
    this.db.run('BEGIN');
  }

  commit(): void {
    this.db.run('COMMIT');
    this.persist();
  }
}
