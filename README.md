# eltoque-nest-api

API NestJS que actúa como proxy hacia la API de elTOQUE y guarda histórico de tasas en SQLite con Prisma.

## Qué hace

- Reenvía la petición a `https://tasas.eltoque.com/v1/trmi`.
- Agrega el token de autorización desde `.env`.
- Guarda snapshots periódicos en SQLite.
- Expone endpoints para consultar histórico y variación.
- Publica documentación interactiva con Swagger.

## Requisitos

- Node.js y npm instalados.
- Un token válido de `https://tasas-token.eltoque.com/`.

## Instalación

```bash
npm install
```

## Configuración

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

2. Completa estas variables en `.env`:

- `ELTOQUE_API_TOKEN`
- `ELTOQUE_API_URL` si necesitas cambiar la base URL
- `PORT` si quieres usar otro puerto
- `DATABASE_URL="file:./dev.db"`

## Base de datos

El proyecto usa Prisma con SQLite. El modelo histórico vive en `prisma/schema.prisma` y guarda:

- `moneda`
- `valor`
- `fecha`
- `createdAt`

## Migración

```bash
npm run prisma:migrate -- --name init
```

## Ejecutar en desarrollo

```bash
npm run start:dev
```

La API queda disponible en `http://localhost:3000`.

## Swagger

La documentación interactiva queda en `http://localhost:3000/api`.

## Endpoints

### `GET /tasas`

Devuelve las tasas más recientes o un rango específico si se envían filtros.

### `GET /tasas/historial`

Devuelve una serie de puntos `{ fecha, valor }` para graficar.

Query params:

- `moneda` como `USD`, `MLC`, `BTC`
- `desde` en formato `YYYY-MM-DD`
- `hasta` en formato `YYYY-MM-DD`

### `GET /tasas/variacion`

Calcula valor inicial, final y variación absoluta/porcentual para una moneda en un rango.

## Cron

Un cron ejecutado cada 30 minutos consulta elTOQUE y guarda un snapshot en la base de datos. Si falla la consulta, la app no se cae; solo registra el error.

## Notas

- Respeta el límite de la API de elTOQUE: máximo 1 petición por segundo.
- Si cambias el esquema de datos, vuelve a ejecutar la migración de Prisma.
