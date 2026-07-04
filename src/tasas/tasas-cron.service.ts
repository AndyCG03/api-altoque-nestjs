import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TasasHistoryService } from './tasas-history.service';
import { TasasService } from './tasas.service';
import { acquireLock, releaseLock } from '../common/cron-lock.util';

@Injectable()
export class TasasCronService {
  private readonly logger = new Logger(TasasCronService.name);

  constructor(
    private readonly tasasService: TasasService,
    private readonly tasasHistoryService: TasasHistoryService,
  ) {}

  // Minutos 7 y 37 de cada hora, en vez de "en punto" (:00 y :30),
  // para no tener un patrón perfectamente predecible frente a Cloudflare.
  @Cron('7,37 * * * *')
  async guardarSnapshotPeriodico() {
    if (!acquireLock()) {
      this.logger.warn(
        'Ya hay otra instancia ejecutando el snapshot (lock activo). Se omite esta corrida.',
      );
      return;
    }

    try {
      // pequeño jitter aleatorio: evita que la petición salga siempre
      // en el mismo segundo exacto
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 4000));

      const snapshot = await this.tasasService.getLatestSnapshot();
      const result = await this.tasasHistoryService.guardarSnapshot(
        snapshot.fecha,
        snapshot.tasas,
      );
      this.logger.log(
        `Snapshot guardado: ${result.created} tasas en ${snapshot.fecha.toISOString()}`,
      );
    } catch (error) {
      this.logger.error('Error guardando snapshot periódico', error as Error);
    } finally {
      releaseLock();
    }
  }
}