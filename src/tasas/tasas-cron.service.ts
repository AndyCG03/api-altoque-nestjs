import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TasasHistoryService } from './tasas-history.service';
import { TasasService } from './tasas.service';

@Injectable()
export class TasasCronService {
  private readonly logger = new Logger(TasasCronService.name);

  constructor(
    private readonly tasasService: TasasService,
    private readonly tasasHistoryService: TasasHistoryService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async guardarSnapshotPeriodico() {
    try {
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
    }
  }
}
