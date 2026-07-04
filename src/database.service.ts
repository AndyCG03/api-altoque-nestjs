import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit {
  public db: Database.Database;

  onModuleInit() {
    const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data.db');
    this.db = new Database(dbPath);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasas_historica (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moneda TEXT NOT NULL,
        valor REAL NOT NULL,
        fecha TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_moneda_fecha ON tasas_historica (moneda, fecha);
    `);
  }
}
