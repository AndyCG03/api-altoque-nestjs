# alTOQUE — Tasas de cambio en Cuba

**Desarrollado por el Ing. Andy Clemente**

Sistema completo de consulta de tasas de cambio en Cuba compuesto por una API
NestJS y una app Flutter con widget nativo Android.

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────┐
│                   Flutter App                        │
│  Tasas │ Calculadora │ Gráfica │ Opciones │ Widget   │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP (Dio) · x-api-key
                   ▼
┌──────────────────────────────────────────────────────┐
│              NestJS API (eltoque-nest-api)            │
│                                                       │
│  GET /tasas           → último snapshot desde SQLite  │
│  GET /tasas/refresh   → fuerza consulta a elTOQUE     │
│  GET /tasas/historial → puntos para gráfica           │
│  GET /tasas/variacion → variación en un rango         │
│  GET /tasas/debug/db-info → diagnóstico BD            │
│                                                       │
│  Cron cada 10–15 min → elTOQUE → SQLite              │
└──────────────────────┬───────────────────────────────┘
                       │ HTTPS · Bearer token
                       ▼
┌──────────────────────────────────────────────────────┐
│           tasas.eltoque.com (API pública)             │
└──────────────────────────────────────────────────────┘
```

---

## API NestJS

API que consulta periódicamente las tasas de [elTOQUE](https://tasas.eltoque.com),
las almacena en SQLite (vía `sql.js`, sin compilación nativa) y las sirve sin
depender de la disponibilidad de elTOQUE en tiempo real.

### Stack

| Componente | Tecnología |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | NestJS 10 |
| Base de datos | SQLite (sql.js — WASM, 0 compilación nativa) |
| HTTP | Axios + @nestjs/axios |
| Documentación | Swagger (OpenAPI 3) |
| Seguridad | API Key hasheada + Rate limiting |
| Despliegue | Hostinger / Render |

### Endpoints

| Endpoint | Método | Descripción |
|---|---|---|
| `/tasas` | GET | Último snapshot guardado desde SQLite |
| `/tasas/refresh` | GET | Fuerza consulta a elTOQUE, guarda y devuelve datos frescos |
| `/tasas/historial` | GET | Puntos `{ fecha, valor }` para gráfica |
| `/tasas/variacion` | GET | Variación absoluta y porcentual en un rango |
| `/tasas/debug/db-info` | GET | Diagnóstico de la BD (total registros, rango de fechas) |

### Seguridad

- **API Key**: Header `x-api-key` obligatorio. El servidor solo almacena el
  hash SHA-256 de la clave, nunca la clave en texto plano.
- **Rate limiting**: 30 peticiones por IP en ventana de 60 segundos.

### Cron

Un cron interno ejecuta `GET /v1/trmi` a elTOQUE **cada 10–15 minutos**
(intervalo aleatorio para evitar patrones). Cada ejecución guarda un snapshot
con todas las monedas disponibles en SQLite. Los endpoints nunca consultan a
elTOQUE en tiempo real excepto `/tasas/refresh`.

### Instalación y ejecución

```bash
npm install
cp .env.example .env
# Completar ELTOQUE_API_TOKEN, API_KEY_HASH, etc.
npm run start:dev
```

Swagger disponible en `http://localhost:3000/api`.

---

## Flutter App

App móvil para consultar tasas de cambio (USD, EUR, MLC) con calculadora de
divisas, gráfica histórica y widget nativo Android.

### Funcionalidades

| Pantalla | Descripción |
|---|---|
| **Tasas** | USD, EUR y MLC en tarjetas con shimmer, pull-to-refresh, badge "Caché" |
| **Calculadora** | Conversor CUP ↔ USD/EUR/MLC (vía CUP como intermediario) |
| **Gráfica** | Línea histórica a 7/30/90 días con tooltip y tarjeta de variación |
| **Opciones** | Toggle modo oscuro, limpiar caché, info de la app |
| **Widget Android** | Widget nativo con tasas actualizadas sin abrir la app |

### Stack

| Componente | Tecnología |
|---|---|
| Framework | Flutter 3.16+ |
| Estado | BLoC (flutter_bloc) |
| Caché | Hive |
| HTTP | Dio |
| Widget Android | AppWidgetProvider + HttpURLConnection (nativo, sin pub.dev) |
| Comunicación | MethodChannel (Flutter ↔ Kotlin) |

### Estructura

```
lib/
├── main.dart
├── app.dart
├── core/
│   ├── cubit/          # HistoryCubit, RatesCubit
│   ├── models/         # RateModel + Hive adapter
│   ├── services/       # ApiService, LocalStorageService, WidgetService
│   └── theme/          # AppTheme (Material 3), ThemeCubit
└── features/
    ├── calculator/     # CalculadoraScreen
    ├── graph/          # GraphScreen (CustomPainter)
    ├── rates/          # RatesScreen
    └── settings/       # SettingsScreen
```

### Instalación

```bash
flutter pub get
cp .env.example .env
# Completar API_BASE_URL y API_KEY
flutter run
```

---

## Licencia

Proyecto privado — Todos los derechos reservados.
