# API — elTOQUE Nest API

API que consulta periódicamente las tasas de cambio de [elTOQUE](https://tasas.eltoque.com), las almacena en SQLite y las sirve sin depender de la disponibilidad de elTOQUE en tiempo real.

---

## URL base

```
https://eltoque-nest-api.onrender.com
```

> Sustituir por la URL real de producción.

---

## Autenticación

Toda petición debe incluir el header `x-api-key` con la clave de acceso.

```
x-api-key: eltq-movil-2026
```

El servidor solo almacena el hash SHA-256 de la clave, nunca la clave en texto plano.

Si la key falta o es incorrecta → `401 Unauthorized`:

```json
{
  "message": "API key inválida o ausente",
  "error": "Unauthorized",
  "statusCode": 401
}
```

---

## Endpoints

### 1. Últimas tasas disponibles

```
GET /tasas
```

Devuelve el snapshot más reciente guardado en la base de datos. Los datos se actualizan cada 15–30 minutos mediante un cron interno.

**Respuesta** (`200 OK`):

```json
{
  "fecha": "2026-07-04T18:30:00.000Z",
  "tasas": {
    "USD": 245,
    "EUR": 268,
    "MLC": 40,
    "USDT": 244.5,
    "BTC": 61200
  }
}
```

| Campo | Descripción |
|---|---|
| `fecha` | **Timestamp ISO 8601** del snapshot. Es la hora a la que elTOQUE reportó esos valores. La app puede restar `Date.now() - fecha` para saber cuán antiguos son los datos. |
| `tasas` | Objeto con el par `moneda: valor` de todas las monedas disponibles en ese snapshot. |

**Respuesta** (`400 Bad Request`) si el cron todavía no ha guardado ningún dato:

```json
{
  "message": "Aún no hay datos guardados. Espera al próximo snapshot del cron.",
  "error": "Bad Request",
  "statusCode": 400
}
```

---

### 2. Histórico para gráfica

```
GET /tasas/historial?moneda=USD&desde=2026-06-01&hasta=2026-07-01
```

Devuelve los puntos ordenados por fecha para dibujar una línea de evolución.

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

Array vacío `[]` si no hay datos en el rango.

---

### 3. Variación en un rango

```
GET /tasas/variacion?moneda=USD&desde=2026-06-01&hasta=2026-07-01
```

Calcula valor inicial, final, variación absoluta y porcentual en el rango indicado.

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

**Respuesta** (`400 Bad Request`) si no hay datos:

```json
{
  "message": "No hay datos históricos para la moneda y el rango indicado",
  "error": "Bad Request",
  "statusCode": 400
}
```

---

## Cómo saber la hora de la última actualización

El campo `fecha` de `GET /tasas` es el timestamp del snapshot más reciente. La app móvil debe calcular la diferencia con la hora actual para mostrar al usuario algo como:

> "Última actualización: hace 12 minutos"

```dart
final ahora = DateTime.now().toUtc();
final ultimaActualizacion = DateTime.parse(snapshot['fecha']);
final diferencia = ahora.difference(ultimaActualizacion);
// diferencia.inMinutes da los minutos transcurridos
```

> **Nota importante sobre el histórico**: todos los puntos de `GET /tasas/historial` también incluyen su propio `fecha`, que es el timestamp de cada snapshot individual. No todos los puntos corresponden a ejecuciones del cron — cada snapshot genera N filas (una por moneda) con la misma `fecha`.

---

## Flujo de datos

1. Un cron interno ejecuta `GET https://tasas.eltoque.com/v1/trmi` **cada 15–30 minutos** (intervalo aleatorio para evitar patrones fijos).
2. Cada ejecución guarda un snapshot en SQLite con todas las monedas disponibles y su valor.
3. Todos los endpoints (`GET /tasas`, `/historial`, `/variacion`) leen exclusivamente de la base de datos local. **Nunca consultan a elTOQUE en tiempo real.**

---

## Rate limiting

| Variable | Default | Descripción |
|---|---|---|
| `RATE_LIMIT_MAX` | `30` | Máximo de peticiones por IP en ventana de 60 segundos |

Al exceder: `429 Too Many Requests`.

---

## Monedas disponibles

No hay lista fija. El cron guarda todas las monedas que aparezcan en la respuesta de elTOQUE. Comunes: `USD`, `EUR`, `MLC`, `USDT`, `BTC`.

---

## Cómo consumir desde Flutter (Dart)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

const baseUrl = 'https://eltoque-nest-api.onrender.com';
const apiKey = 'eltq-movil-2026';

Map<String, String> get _headers => {'x-api-key': apiKey};

// Últimas tasas
Future<Map<String, dynamic>> getUltimasTasas() async {
  final response = await http.get(Uri.parse('$baseUrl/tasas'), headers: _headers);
  return jsonDecode(response.body);
}

// Histórico para gráfica
Future<List<Map<String, dynamic>>> getHistorial(
    String moneda, DateTime desde, DateTime hasta) async {
  final desdeStr = '${desde.year}-${desde.month.toString().padLeft(2, '0')}-${desde.day.toString().padLeft(2, '0')}';
  final hastaStr = '${hasta.year}-${hasta.month.toString().padLeft(2, '0')}-${hasta.day.toString().padLeft(2, '0')}';
  final uri = Uri.parse('$baseUrl/tasas/historial').replace(queryParameters: {
    'moneda': moneda,
    'desde': desdeStr,
    'hasta': hastaStr,
  });
  final response = await http.get(uri, headers: _headers);
  return List<Map<String, dynamic>>.from(jsonDecode(response.body));
}

// Variación
Future<Map<String, dynamic>> getVariacion(
    String moneda, DateTime desde, DateTime hasta) async {
  final uri = Uri.parse('$baseUrl/tasas/variacion').replace(queryParameters: {
    'moneda': moneda,
    'desde': desdeStr,
    'hasta': hastaStr,
  });
  final response = await http.get(uri, headers: _headers);
  return jsonDecode(response.body);
}
```

Para la gráfica con `fl_chart`:

```dart
List<FlSpot> puntos = data.asMap().entries.map((e) =>
  FlSpot(e.key.toDouble(), e.value['valor'].toDouble())
).toList();
```

Para mostrar la antigüedad de los datos:

```dart
final snapshot = await getUltimasTasas();
final ultimaFecha = DateTime.parse(snapshot['fecha']);
final minutos = DateTime.now().toUtc().difference(ultimaFecha).inMinutes;
print('Última actualización: hace $minutos min');
```
