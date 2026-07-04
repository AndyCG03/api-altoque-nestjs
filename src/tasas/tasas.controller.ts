import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TasasHistoryService } from './tasas-history.service';
import { TasasService } from './tasas.service';

@ApiTags('tasas')
@Controller('tasas')
export class TasasController {
  constructor(
    private readonly tasasService: TasasService,
    private readonly tasasHistoryService: TasasHistoryService,
  ) {}

  @ApiOperation({
    summary: 'Obtener tasas del elTOQUE',
    description:
      'Reenvía la consulta a la API de elTOQUE. Si no se envían fechas, devuelve las tasas de las últimas 24 horas.',
  })
  @ApiQuery({
    name: 'date_from',
    required: false,
    description: 'Fecha inicial en formato compatible con elTOQUE.',
    example: '2026-05-27 00:00:01',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    description: 'Fecha final en formato compatible con elTOQUE.',
    example: '2026-05-27 23:59:01',
  })
  @Get()
  async getTasas(
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
  ) {
    return this.tasasService.getTasas({ date_from, date_to });
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
}
