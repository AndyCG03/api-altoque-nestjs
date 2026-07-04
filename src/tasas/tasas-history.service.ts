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

  /**
   * Usado por el script de backfill: permite saltar días que ya
   * fueron guardados previamente, para poder reanudar sin duplicar.
   */
  existeDia(fecha: Date): boolean {
    const row = this.db.queryOne(
      'SELECT id FROM tasas_historica WHERE fecha = ? LIMIT 1',
      [fecha.toISOString()],
    );
    return row !== null;
  }

  /**
   * Usado por el cron para detectar si ya se guardó un snapshot
   * hace muy poco (protección extra ante instancias duplicadas).
   */
  yaSeEjecutoRecientemente(minutos: number): boolean {
    const limite = new Date(Date.now() - minutos * 60 * 1000).toISOString();
    const row = this.db.queryOne(
      'SELECT id FROM tasas_historica WHERE created_at >= ? LIMIT 1',
      [limite],
    );
    return row !== null;
  }

  /**
   * Trae el snapshot más reciente guardado en la base de datos.
   * Es lo que ahora sirve el endpoint público GET /tasas,
   * en vez de llamar a elTOQUE en tiempo real.
   */
  getUltimoSnapshot(): { fecha: string; tasas: Record<string, number> } | null {
    const ultimaFecha = this.db.queryOne(
      'SELECT MAX(fecha) as fecha FROM tasas_historica',
    );

    if (!ultimaFecha || !ultimaFecha.fecha) {
      return null;
    }

    const filas = this.db.queryAll(
      'SELECT moneda, valor FROM tasas_historica WHERE fecha = ?',
      [ultimaFecha.fecha as string],
    );

    const tasas = filas.reduce<Record<string, number>>((acc, fila) => {
      acc[fila.moneda as string] = fila.valor as number;
      return acc;
    }, {});

    return { fecha: ultimaFecha.fecha as string, tasas };
  }

  /**
   * Información de diagnóstico: cuántos registros hay, y el rango de
   * fechas cubierto. Útil para verificar si el histórico se está
   * borrando entre deploys/reinicios.
   */
  getDbInfo() {
    const total = this.db.queryOne(
      'SELECT COUNT(*) as total FROM tasas_historica',
    );
    const masAntiguo = this.db.queryOne(
      'SELECT MIN(fecha) as fecha FROM tasas_historica',
    );
    const masReciente = this.db.queryOne(
      'SELECT MAX(fecha) as fecha FROM tasas_historica',
    );

    return {
      total: total?.total ?? 0,
      masAntiguo: masAntiguo?.fecha ?? null,
      masReciente: masReciente?.fecha ?? null,
    };
  }
}