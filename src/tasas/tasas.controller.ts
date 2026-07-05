import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TasasHistoryService } from './tasas-history.service';

@ApiTags('tasas')
@Controller('tasas')
export class TasasController {
  constructor(private readonly tasasHistoryService: TasasHistoryService) {}

  @ApiOperation({
    summary: 'Obtener las últimas tasas guardadas',
    description:
      'Devuelve el snapshot más reciente guardado en la base de datos. Ya no consulta a elTOQUE en tiempo real; los datos se actualizan cada 5 minutos por un cron job interno.',
  })
  @ApiOkResponse({
    description: 'Último snapshot de tasas guardado.',
  })
  @ApiBadRequestResponse({
    description: 'Todavía no hay ningún snapshot guardado.',
  })
  @Get()
  async getTasas() {
    const snapshot = this.tasasHistoryService.getUltimoSnapshot();

    if (!snapshot) {
      throw new BadRequestException(
        'Aún no hay datos guardados. Espera al próximo snapshot del cron (cada 5 minutos).',
      );
    }

    return snapshot;
  }

  @ApiOperation({
    summary: 'Obtener histórico de una moneda',
    description:
      'Devuelve una serie de puntos { fecha, valor } para graficar la variación de una moneda en un rango determinado.',
  })
  @ApiQuery({
    name: 'moneda',
    required: true,
    example: 'USD',
  })
  @ApiQuery({
    name: 'desde',
    required: true,
    example: '2026-06-01',
  })
  @ApiQuery({
    name: 'hasta',
    required: true,
    example: '2026-07-01',
  })
  @ApiOkResponse({
    description: 'Lista ordenada de puntos para graficar.',
  })
  @Get('historial')
  async getHistorial(
    @Query('moneda') moneda?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    if (!moneda || !desde || !hasta) {
      throw new BadRequestException('Debes enviar moneda, desde y hasta');
    }

    const desdeDate = new Date(desde);
    const hastaDate = new Date(hasta);

    if (Number.isNaN(desdeDate.getTime()) || Number.isNaN(hastaDate.getTime())) {
      throw new BadRequestException('Las fechas desde y hasta no son válidas');
    }

    hastaDate.setUTCHours(23, 59, 59, 999);

    return this.tasasHistoryService.getHistorial(
      moneda.toUpperCase(),
      desdeDate,
      hastaDate,
    );
  }

  @ApiOperation({
    summary: 'Calcular variación de una moneda',
    description:
      'Calcula el valor inicial, final, variación absoluta y porcentaje en un rango de fechas.',
  })
  @ApiQuery({
    name: 'moneda',
    required: true,
    example: 'USD',
  })
  @ApiQuery({
    name: 'desde',
    required: true,
    example: '2026-06-01',
  })
  @ApiQuery({
    name: 'hasta',
    required: true,
    example: '2026-07-01',
  })
  @ApiBadRequestResponse({
    description: 'Parámetros inválidos o faltantes.',
  })
  @Get('variacion')
  async getVariacion(
    @Query('moneda') moneda?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    if (!moneda || !desde || !hasta) {
      throw new BadRequestException('Debes enviar moneda, desde y hasta');
    }

    const desdeDate = new Date(desde);
    const hastaDate = new Date(hasta);

    if (Number.isNaN(desdeDate.getTime()) || Number.isNaN(hastaDate.getTime())) {
      throw new BadRequestException('Las fechas desde y hasta no son válidas');
    }

    hastaDate.setUTCHours(23, 59, 59, 999);

    const variacion = await this.tasasHistoryService.getVariacion(
      moneda.toUpperCase(),
      desdeDate,
      hastaDate,
    );

    if (!variacion) {
      throw new BadRequestException(
        'No hay datos históricos para la moneda y el rango indicado',
      );
    }

    return variacion;
  }

  @ApiOperation({
    summary: 'Diagnóstico de la base de datos',
    description:
      'Muestra cuántos registros hay guardados y el rango de fechas cubierto. Útil para verificar que el histórico no se está perdiendo entre reinicios.',
  })
  @Get('debug/db-info')
  getDbInfo() {
    return this.tasasHistoryService.getDbInfo();
  }
}