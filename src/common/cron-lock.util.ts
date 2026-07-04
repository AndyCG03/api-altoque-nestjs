import * as fs from 'fs';
import * as path from 'path';

// Si un lock es más viejo que esto, asumimos que el proceso que lo creó
// murió sin liberarlo (crash, redeploy abrupto, etc.) y lo ignoramos.
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutos

function getLockPath(): string {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data.db');
  return path.join(path.dirname(dbPath), '.cron.lock');
}

/**
 * Intenta tomar el lock. Devuelve true si lo consiguió (puedes ejecutar el cron),
 * false si otra instancia ya lo tiene activo.
 */
export function acquireLock(): boolean {
  const lockPath = getLockPath();

  try {
    // 'wx' falla si el archivo YA existe. Esa verificación+creación es atómica
    // a nivel de sistema de archivos, incluso entre dos procesos distintos.
    fs.writeFileSync(lockPath, String(Date.now()), { flag: 'wx' });
    return true;
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      // Error raro (permisos, disco lleno, etc.) -> no bloqueamos la ejecución
      return true;
    }

    // Ya existe un lock: revisamos si está vencido (proceso anterior murió sin liberarlo)
    try {
      const contenido = fs.readFileSync(lockPath, 'utf-8');
      const timestamp = Number(contenido);
      const esViejo =
        Number.isFinite(timestamp) && Date.now() - timestamp > LOCK_TTL_MS;

      if (esViejo) {
        fs.writeFileSync(lockPath, String(Date.now()), { flag: 'w' });
        return true;
      }
    } catch {
      // si no se puede leer el lock, no arriesgamos: asumimos que sigue activo
    }

    return false;
  }
}

export function releaseLock(): void {
  const lockPath = getLockPath();
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // si ya no existe, no pasa nada
  }
}