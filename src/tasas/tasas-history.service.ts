import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface TasaHistoricaPunto {
  fecha: Date;
  valor: number;
}

@Injectable()
export class TasasHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async guardarSnapshot(
    snapshotDate: Date,
    tasas: Record<string, number>,
  ) {
    const entries = Object.entries(tasas)
      .filter(([, valor]) => Number.isFinite(valor))
      .map(([moneda, valor]) => ({
        moneda,
        valor,
        fecha: snapshotDate,
      }));

    if (entries.length === 0) {
      return { created: 0 };
    }

    await this.prisma.tasaHistorica.createMany({
      data: entries,
    });

    return { created: entries.length };
  }

  async getHistorial(moneda: string, desde: Date, hasta: Date) {
    return this.prisma.tasaHistorica.findMany({
      where: {
        moneda,
        fecha: {
          gte: desde,
          lte: hasta,
        },
      },
      orderBy: {
        fecha: 'asc',
      },
      select: {
        fecha: true,
        valor: true,
      },
    });
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
    return this.prisma.tasaHistorica.findFirst({
      where: { moneda, fecha },
      select: { id: true },
    });
  }
}
