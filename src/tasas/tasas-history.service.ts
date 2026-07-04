import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

export interface TasaHistoricaPunto {
  fecha: Date;
  valor: number;
}

@Injectable()
export class TasasHistoryService {
  constructor(private readonly db: DatabaseService) {}

  guardarSnapshot(snapshotDate: Date, tasas: Record<string, number>) {
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

    this.db.begin();
    for (const entry of entries) {
      this.db.exec(
        'INSERT INTO tasas_historica (moneda, valor, fecha) VALUES (?, ?, ?)',
        [entry.moneda, entry.valor, entry.fecha],
      );
    }
    this.db.commit();

    return { created: entries.length };
  }

  getHistorial(moneda: string, desde: Date, hasta: Date): TasaHistoricaPunto[] {
    const filas = this.db.queryAll(
      'SELECT fecha, valor FROM tasas_historica WHERE moneda = ? AND fecha BETWEEN ? AND ? ORDER BY fecha ASC',
      [moneda, desde.toISOString(), hasta.toISOString()],
    );

    return filas.map((f) => ({
      fecha: new Date(f.fecha as string),
      valor: f.valor as number,
    }));
  }

  getVariacion(moneda: string, desde: Date, hasta: Date) {
    const datos = this.getHistorial(moneda, desde, hasta);

    if (datos.length === 0) {
      return null;
    }

    const inicial = datos[0].valor;
    const final = datos[datos.length - 1].valor;
    const variacionAbsoluta = final - inicial;
    const variacionPorcentual =
      inicial === 0 ? 0 : (variacionAbsoluta / inicial) * 100;

    return {
      moneda,
      valor_inicial: inicial,
      valor_final: final,
      variacion_absoluta: variacionAbsoluta,
      variacion_porcentual: Number(variacionPorcentual.toFixed(2)),
    };
  }

  existeRegistro(moneda: string, fecha: Date) {
    const row = this.db.queryOne(
      'SELECT id FROM tasas_historica WHERE moneda = ? AND fecha = ? LIMIT 1',
      [moneda, fecha.toISOString()],
    );

    return row ?? null;
  }
}
