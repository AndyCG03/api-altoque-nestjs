import {
  BadGatewayException,
  InternalServerErrorException,
  Injectable,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

interface TrmiQuery {
  date_from?: string;
  date_to?: string;
}

export interface TasasSnapshot {
  tasas: Record<string, number>;
  fecha: Date;
  raw: unknown;
}

@Injectable()
export class TasasService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getTasas(query: TrmiQuery) {
    const baseUrl =
      this.configService.get<string>('ELTOQUE_API_URL') ??
      'https://tasas.eltoque.com';
    const token = this.configService.get<string>('ELTOQUE_API_TOKEN');

    if (!token) {
      throw new InternalServerErrorException(
        'Falta configurar ELTOQUE_API_TOKEN en las variables de entorno',
      );
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/v1/trmi`, {
          params: query,
          headers: {
            accept: '*/*',
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      // Reenviamos el mismo código/mensaje de error que devuelve elTOQUE
      if (axiosError.response) {
        throw new BadGatewayException({
          statusCode: axiosError.response.status,
          message: axiosError.response.data,
        });
      }

      throw new BadGatewayException(
        'No se pudo contactar con la API de elTOQUE',
      );
    }
  }

  async getLatestSnapshot(query: TrmiQuery = {}): Promise<TasasSnapshot> {
    const data = await this.getTasas(query);
    const tasas = this.extractRates(data);
    const fecha = this.extractDate(data);

    return {
      tasas,
      fecha,
      raw: data,
    };
  }

  private extractRates(data: any): Record<string, number> {
    const tasas = data?.tasas ?? {};

    if (typeof tasas !== 'object' || tasas === null) {
      return {};
    }

    return Object.entries(tasas).reduce<Record<string, number>>(
      (acc, [moneda, valor]) => {
        const numero = Number(valor);
        if (Number.isFinite(numero)) {
          acc[moneda] = numero;
        }
        return acc;
      },
      {},
    );
  }

  private extractDate(data: any): Date {
    if (data?.date) {
      const hour = data.hour ?? 0;
      const minutes = data.minutes ?? 0;
      const seconds = data.seconds ?? 0;
      const iso = `${data.date}T${String(hour).padStart(2, '0')}:${String(
        minutes,
      ).padStart(2, '0')}:${String(seconds).padStart(2, '0')}Z`;
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }
}
