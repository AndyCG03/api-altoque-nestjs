# Roadmap: histórico de tasas + gráfica de variación

Este documento describe los pasos para evolucionar el proxy actual
(`eltoque-nest-api`) hacia una app que **guarda un histórico de tasas**
en una base de datos SQLite (un solo archivo) y expone endpoints listos
para graficar la variación de una moneda en el tiempo.

## 1. Objetivo

- Dejar de depender únicamente de "la tasa de ahora mismo".
- Guardar cada consulta (o una consulta periódica) en disco.
- Exponer un endpoint tipo `GET /tasas/historial?moneda=USD&desde=...&hasta=...`
  que devuelva una serie de puntos `{ fecha, valor }` lista para graficar.

## 2. Elegir cómo hablarle a SQLite

SQLite ya es "un archivo simple" (ej. `data.sqlite`), así que solo hace
falta elegir el driver/ORM. Para NestJS, dos caminos razonables:

| Opción | Cuándo conviene |
|---|---|
| **TypeORM + `sqlite3`** | Si quieres migraciones, entidades con decoradores, y quedarte dentro del ecosistema NestJS clásico. |
| **Prisma + `sqlite`** | Si prefieres un schema declarativo (`schema.prisma`), autocompletado fuerte y un cliente tipado. Recomendado si el proyecto va a crecer. |

Para algo "sencillo" como pides, **Prisma con SQLite** suele ser el
camino con menos fricción: un archivo `schema.prisma`, un comando de
migración, y ya tienes el archivo `.sqlite` funcionando.

Instalación (ejemplo con Prisma):

```bash
npm install prisma --save-dev
npm install @prisma/client
npx prisma init --datasource-provider sqlite
```

Esto crea `prisma/schema.prisma` y un `.env` con
`DATABASE_URL="file:./dev.db"`.

## 3. Modelo de datos

Una sola tabla alcanza para lo que describes:

```prisma
// prisma/schema.prisma
model TasaHistorica {
  id        Int      @id @default(autoincrement())
  moneda    String   // "USD", "MLC", "ECU", "BTC", etc.
  valor     Float
  fecha     DateTime // momento en que se guardó ese dato
}
```

Luego:

```bash
npx prisma migrate dev --name init
```

Esto crea el archivo SQLite (`prisma/dev.db`) y la tabla.

## 4. Job que guarda datos periódicamente

Necesitas un proceso que, cada cierto tiempo, llame a tu propio
endpoint `/tasas` (o directamente al servicio) y guarde el resultado.
En NestJS esto se hace con `@nestjs/schedule`.

```bash
npm install @nestjs/schedule
```

Ideas clave:

- Registrar `ScheduleModule.forRoot()` en `AppModule`.
- Crear un `TasasCronService` con `@Cron('*/30 * * * *')` (cada 30 min,
  ajusta según necesites) que llame a `TasasService.getTasas()` y
  guarde cada moneda como una fila en `TasaHistorica`.
- Respetar el límite de **1 petición por segundo** de elTOQUE (con un
  solo cron cada X minutos no hay problema, pero si en el futuro haces
  varias llamadas seguidas, agrega un `sleep` entre ellas).
- Manejar errores del cron sin tumbar la app (try/catch + log).

## 5. Nuevos endpoints

- `GET /tasas/historial?moneda=USD&desde=2026-06-01&hasta=2026-07-01`
  → devuelve `[{ fecha, valor }, ...]` ordenado por fecha, listo para
  graficar.
- `GET /tasas/variacion?moneda=USD&desde=...&hasta=...`
  → devuelve algo como:
  ```json
  {
    "moneda": "USD",
    "valor_inicial": 560,
    "valor_final": 568,
    "variacion_absoluta": 8,
    "variacion_porcentual": 1.43
  }
  ```
  (variación % = `(final - inicial) / inicial * 100`)

## 6. Representar la variación como gráfica

Dos escenarios según dónde quieras ver la gráfica:

### a) Tienes (o vas a tener) un frontend
Tu API solo necesita devolver los puntos `{ fecha, valor }` (endpoint
`/tasas/historial` de arriba). En el frontend usas una librería de
gráficas:
- **Recharts** o **Chart.js** si es React/Vue/vanilla.
- Un `LineChart` simple: eje X = fecha, eje Y = valor, una serie por
  moneda.

### b) Quieres ver la gráfica sin construir un frontend aparte
Puedes generar una imagen de gráfica directamente desde el backend:
- `chartjs-node-canvas` o `quickchart.io` (servicio externo que recibe
  config de Chart.js y devuelve un PNG).
- Un endpoint `GET /tasas/grafica?moneda=USD` que arme la config del
  chart con los datos de SQLite y devuelva la imagen (`image/png`).

Para un MVP, la opción (a) es más flexible; la (b) es más rápida de
"ver" sin escribir frontend.

## 7. Cosas a cuidar

- **Migraciones**: cada cambio al modelo de datos va con
  `npx prisma migrate dev`.
- **Zona horaria**: guarda las fechas en UTC y conviértelas al
  mostrarlas, para que las gráficas no se desfasen.
- **Duplicados**: decide si guardas una fila por moneda por corrida del
  cron, o si evitas duplicar si el valor no cambió.
- **Backups**: al ser un archivo único (`dev.db`), un simple `cp` del
  archivo ya es un backup.
- **Testing**: con SQLite puedes usar una base de datos en memoria
  (`file::memory:`) para tests, sin tocar el archivo real.

## 8. Orden sugerido de implementación

1. Instalar y configurar Prisma + SQLite.
2. Crear el modelo `TasaHistorica` y migrar.
3. Crear `TasasCronService` que guarde datos periódicamente.
4. Exponer `/tasas/historial` (lectura simple de la tabla).
5. Exponer `/tasas/variacion` (cálculo sobre esos datos).
6. Decidir dónde vive la gráfica (frontend propio vs. imagen generada
   en backend) e implementarla.
7. (Opcional) Cachear `/tasas` en memoria por 1 minuto para no golpear
   la API de elTOQUE en cada request.
