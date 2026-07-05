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
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'es-CU,es;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            Referer: 'https://tasas.eltoque.com/',
            Authorization: `Bearer ${token}`,
          },
          timeout: 15_000,
          decompress: true,
        }),
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const data = axiosError.response.data as string | object;
        const esCloudflare =
          typeof data === 'string' && data.includes('Just a moment');

        if (esCloudflare) {
          throw new BadGatewayException(
            'Cloudflare bloqueó la petición. Se reintentará en el próximo ciclo del cron.',
          );
        }

        throw new BadGatewayException({
          statusCode: axiosError.response.status,
          message: data,
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
