import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { TasasHistoryService } from './tasas-history.service';
import { TasasService } from './tasas.service';
import { acquireLock, releaseLock } from '../common/cron-lock.util';

const MIN_INTERVALO_MS = 15 * 60 * 1000; // 15 minutos
const MAX_INTERVALO_MS = 30 * 60 * 1000; // 30 minutos

@Injectable()
export class TasasCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TasasCronService.name);
  private timeoutRef: NodeJS.Timeout | null = null;
  private detenido = false;

  constructor(
    private readonly tasasService: TasasService,
    private readonly tasasHistoryService: TasasHistoryService,
  ) {}

  onModuleInit() {
    // Primera corrida con un pequeño delay inicial, para no disparar
    // justo al arrancar el proceso (ej. en cada redeploy).
    this.programarSiguiente(this.randomEntre(30_000, 90_000));
  }

  onModuleDestroy() {
    this.detenido = true;
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }
  }

  private randomEntre(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min));
  }

  private programarSiguiente(delayMs: number) {
    if (this.detenido) return;

    this.timeoutRef = setTimeout(async () => {
      await this.guardarSnapshotPeriodico();

      // Cada vuelta calcula un intervalo NUEVO y aleatorio entre 15 y 30 min,
      // así el patrón nunca se repite exacto.
      const proximoIntervalo = this.randomEntre(
        MIN_INTERVALO_MS,
        MAX_INTERVALO_MS,
      );
      this.logger.log(
        `Próxima actualización en ~${Math.round(proximoIntervalo / 60000)} min`,
      );
      this.programarSiguiente(proximoIntervalo);
    }, delayMs);
  }

  private async guardarSnapshotPeriodico() {
    if (!acquireLock()) {
      this.logger.warn(
        'Ya hay otra instancia ejecutando el snapshot (lock activo). Se omite esta corrida.',
      );
      return;
    }

    try {
      if (this.tasasHistoryService.yaSeEjecutoRecientemente(5)) {
        this.logger.warn(
          'Ya existe un snapshot muy reciente. Se omite esta corrida.',
        );
        return;
      }

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