import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

export interface TasaHistoricaPunto {
  fecha: Date;
  valor: number;
}

@Injectable()
export class TasasHistoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  async guardarSnapshot(
    snapshotDate: Date,
    tasas: Record<string, number>,
  ) {
    const entries = Object.entries(tasas)
      .filter(([, valor]) => Number.isFinite(valor))
      .map(([moneda, valor]) => ({
        moneda,
        valor,
        fecha: snapshotDate.toISOString(),
      }));

    if (entries.length === 0) {
      return { created: 0 };
    }

    const insert = this.databaseService.db.prepare(
      'INSERT INTO tasas_historica (moneda, valor, fecha) VALUES (?, ?, ?)',
    );

    const insertMany = this.databaseService.db.transaction(
      (rows: { moneda: string; valor: number; fecha: string }[]) => {
        for (const row of rows) {
          insert.run(row.moneda, row.valor, row.fecha);
        }
      },
    );

    insertMany(entries);

    return { created: entries.length };
  }

  async getHistorial(moneda: string, desde: Date, hasta: Date) {
    const filas = this.databaseService.db
      .prepare(
        'SELECT fecha, valor FROM tasas_historica WHERE moneda = ? AND fecha BETWEEN ? AND ? ORDER BY fecha ASC',
      )
      .all(moneda, desde.toISOString(), hasta.toISOString()) as { fecha: string; valor: number }[];

    return filas.map((f) => ({ fecha: new Date(f.fecha), valor: f.valor }));
  }

  async getVariacion(moneda: string, desde: Date, hasta: Date) {
    const datos = await this.getHistorial(moneda, desde, hasta);

    if (datos.length === 0) {
      return null;
    }

    const inicial = datos[0].valor;
    const final = datos[datos.length - 1].valor;
    const variacionAbsoluta = final - inicial;
    const variacionPorcentual = inicial === 0 ? 0 : (variacionAbsoluta / inicial) * 100;

    return {
      moneda,
      valor_inicial: inicial,
      valor_final: final,
      variacion_absoluta: variacionAbsoluta,
      variacion_porcentual: Number(variacionPorcentual.toFixed(2)),
    };
  }

  async existeRegistro(moneda: string, fecha: Date) {
    const row = this.databaseService.db
      .prepare('SELECT id FROM tasas_historica WHERE moneda = ? AND fecha = ? LIMIT 1')
      .get(moneda, fecha.toISOString()) as { id: number } | undefined;

    return row ?? null;
  }
}
