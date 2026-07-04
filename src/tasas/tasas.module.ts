import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TasasController } from './tasas.controller';
import { TasasService } from './tasas.service';
import { TasasHistoryService } from './tasas-history.service';
import { DatabaseService } from '../database.service';
import { TasasCronService } from './tasas-cron.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 8000,
    }),
  ],
  controllers: [TasasController],
  providers: [TasasService, TasasHistoryService, TasasCronService, DatabaseService],
})
export class TasasModule {}
