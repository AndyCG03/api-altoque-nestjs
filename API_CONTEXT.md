# API — elTOQUE Nest API

API proxy que consulta y almacena históricamente las tasas de cambio de [elTOQUE](https://tasas.eltoque.com).

---

## URL base

```
https://eltoque-nest-api.onrender.com
```

> La URL real de producción depende de dónde esté desplegada (Hostinger, Render, etc). Sustituir por la URL real.

---

## Endpoints

### 1. Obtener tasas actuales

```
GET /tasas
```

Reenvía la consulta a la API de elTOQUE. Si no se envían fechas, devuelve las últimas 24 horas.

**Query params** (opcionales):

| Parámetro | Tipo | Descripción |
|---|---|---|
| `date_from` | string | Fecha inicial (ej: `2026-05-27 00:00:01`) |
| `date_to` | string | Fecha final (ej: `2026-05-27 23:59:01`) |

**Respuesta**: depende de lo que devuelva la API de elTOQUE. Contiene `tasas` (objeto moneda → valor) y metadatos.

---

### 2. Histórico para gráfica

```
GET /tasas/historial?moneda=USD&desde=2026-06-01&hasta=2026-07-01
```

Devuelve los puntos ordenados para dibujar una línea de evolución.

**Query params** (obligatorios):

| Parámetro | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `moneda` | string | Código de moneda en mayúsculas | `USD`, `EUR`, `MLC` |
| `desde` | string | Fecha inicial ISO (`YYYY-MM-DD`) | `2026-06-01` |
| `hasta` | string | Fecha final ISO (`YYYY-MM-DD`) | `2026-07-01` |

**Respuesta** (`200 OK`):

```json
[
  { "fecha": "2026-06-01T12:00:00.000Z", "valor": 240 },
  { "fecha": "2026-06-01T12:30:00.000Z", "valor": 241 },
  { "fecha": "2026-06-01T13:00:00.000Z", "valor": 240 }
]
```

- `fecha`: string ISO 8601
- `valor`: número (tasa de cambio)
- Array vacío `[]` si no hay datos

---

### 3. Variación en un rango

```
GET /tasas/variacion?moneda=USD&desde=2026-06-01&hasta=2026-07-01
```

Calcula valor inicial, final, variación absoluta y porcentual.

**Query params** (obligatorios): mismos que `/historial`.

**Respuesta** (`200 OK`):

```json
{
  "moneda": "USD",
  "valor_inicial": 240,
  "valor_final": 245,
  "variacion_absoluta": 5,
  "variacion_porcentual": 2.08
}
```

**Respuesta** (`400 Bad Request`) si no hay datos en el rango:

```json
{
  "message": "No hay datos históricos para la moneda y el rango indicado",
  "error": "Bad Request",
  "statusCode": 400
}
```

**Errores**:
- `400` — parámetros faltantes o fechas inválidas
- `400` — sin datos en el rango
- `502` — la API de elTOQUE no responde

---

## Seguridad

### API Key (obligatorio)

Toda petición debe incluir el header `x-api-key` con el mismo token de elTOQUE configurado en el servidor (`ELTOQUE_API_TOKEN`).

```
x-api-key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Si la key falta o es incorrecta, la API responde `401 Unauthorized`:

```json
{
  "message": "API key inválida o ausente",
  "error": "Unauthorized",
  "statusCode": 401
}
```

El token se obtiene en [https://tasas-token.eltoque.com/](https://tasas-token.eltoque.com/) y debe ser el mismo tanto en el servidor como en la app móvil.

### Rate limiting

Además del API key, hay rate limiting global:

| Variable | Default | Descripción |
|---|---|---|
| `RATE_LIMIT_MAX` | `30` | Máximo de peticiones por ventana de 60 segundos por IP |

Al exceder el límite: `429 Too Many Requests`

### Recomendaciones para la app móvil

- Enviar `x-api-key` en todas las peticiones
- Cachear localmente los resultados del histórico para evitar llamadas repetidas
- Respetar un intervalo mínimo de 2s entre peticiones

---

## Flujo de datos

1. **Cada 30 minutos** un cron interno (`TasasCronService`) consulta la API de elTOQUE y guarda un snapshot con todas las monedas y su valor en SQLite (`tasas_historica`).
2. Los endpoints `/historial` y `/variacion` leen de esa base de datos local.
3. El endpoint `GET /tasas` es un proxy directo a la API de elTOQUE (no usa la BD).

---

## Monedas disponibles

Las monedas dependen de lo que devuelva elTOQUE en cada snapshot. Comunes:

| Código | Moneda |
|---|---|
| `USD` | Dólar estadounidense |
| `EUR` | Euro |
| `MLC` | Moneda Libremente Convertible |
| `USDT` | Tether (USDT) |
| `BTC` | Bitcoin |

La app guarda cualquier moneda que aparezca en la respuesta, no hay una lista fija.

---

## Cómo consumir desde Flutter (Dart)

Ejemplo con `http` package:

```dart
final baseUrl = 'https://eltoque-nest-api.onrender.com';

// Obtener histórico
Future<List<Map<String, dynamic>>> getHistorial(
    String moneda, DateTime desde, DateTime hasta) async {
  final desdeStr = '${desde.year}-${desde.month.toString().padLeft(2, '0')}-${desde.day.toString().padLeft(2, '0')}';
  final hastaStr = '${hasta.year}-${hasta.month.toString().padLeft(2, '0')}-${hasta.day.toString().padLeft(2, '0')}';
  final uri = Uri.parse('$baseUrl/tasas/historial').replace(queryParameters: {
    'moneda': moneda,
    'desde': desdeStr,
    'hasta': hastaStr,
  });
  final response = await http.get(uri);
  return List<Map<String, dynamic>>.from(jsonDecode(response.body));
}

// Obtener variación
Future<Map<String, dynamic>> getVariacion(
    String moneda, DateTime desde, DateTime hasta) async {
  final uri = Uri.parse('$baseUrl/tasas/variacion').replace(queryParameters: {
    'moneda': moneda,
    'desde': desdeStr,
    'hasta': hastaStr,
  });
  final response = await http.get(uri);
  return jsonDecode(response.body);
}
```

Para la gráfica usar `fl_chart`:

```dart
List<FlSpot> puntos = data.asMap().entries.map((e) =>
  FlSpot(e.key.toDouble(), e.value['valor'].toDouble())
).toList();
```
