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

  // Cada 5 minutos. Solo este cron le pega a elTOQUE;
  // el resto de la app lee siempre desde la base de datos.
  @Cron('*/5 * * * *')
  async guardarSnapshotPeriodico() {
    if (!acquireLock()) {
      this.logger.warn(
        'Ya hay otra instancia ejecutando el snapshot (lock activo). Se omite esta corrida.',
      );
      return;
    }

    try {
      // Protección extra: si por algún motivo ya se guardó algo hace
      // muy poco (ej. otra instancia terminó justo antes de que este
      // proceso revisara el lock), no insistimos.
      if (this.tasasHistoryService.yaSeEjecutoRecientemente(2)) {
        this.logger.warn(
          'Ya existe un snapshot muy reciente. Se omite esta corrida.',
        );
        return;
      }

      // Jitter aleatorio: evita que la petición salga siempre en el
      // mismo segundo exacto (patrón demasiado predecible para Cloudflare).
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