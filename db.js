// db.js (ES module) - SQLite helpers via sql.js
let SQL;
let db;
let dbName = 'simjtac.db';

export async function initDB() {
  if (!window.initSqlJs) {
    throw new Error('sql-wasm.js no esta cargado');
  }
  if (!SQL) {
    SQL = await window.initSqlJs({ locateFile: file => file });
  }
  if (!db) {
    db = new SQL.Database();
    ensureSchema();
  }
  return true;
}

export function newDB(name = 'simjtac.db') {
  db = new SQL.Database();
  dbName = name;
  ensureSchema();
  return db;
}

export async function openDBFromFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  db = new SQL.Database(bytes);
  dbName = file.name || 'simjtac.db';
  ensureSchema();
  return db;
}

export function exportDB(name = dbName) {
  const binary = db.export();
  const blob = new Blob([binary], { type: 'application/octet-stream' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = name;
  anchor.click();
}

export function exec(sql) {
  try {
    return db.exec(sql);
  } catch (error) {
    throw new Error(error.message);
  }
}

export function run(sql, params = {}) {
  try {
    const statement = db.prepare(sql);
    statement.run(params);
    statement.free();
  } catch (error) {
    throw new Error(error.message);
  }
}

export function select(sql, params = {}) {
  let statement;
  try {
    statement = db.prepare(sql);
    if (params && Object.keys(params).length) {
      statement.bind(params);
    }
    const rows = [];
    while (statement.step()) {
      rows.push(statement.getAsObject());
    }
    return rows;
  } catch (error) {
    throw new Error(error.message);
  } finally {
    statement?.free();
  }
}

const SCHEMA_VERSION = 1;

export function ensureSchema() {
  db.run(`
    BEGIN;
    CREATE TABLE IF NOT EXISTS meta (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS domos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS puestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domo_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      UNIQUE(domo_id, nombre),
      FOREIGN KEY (domo_id) REFERENCES domos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS elementos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      puesto_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      UNIQUE(puesto_id, nombre),
      FOREIGN KEY (puesto_id) REFERENCES puestos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS componentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      elemento_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      parent_id INTEGER,
      UNIQUE(elemento_id, nombre, IFNULL(parent_id, -1)),
      FOREIGN KEY (elemento_id) REFERENCES elementos(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES componentes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS incidentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      domo_id INTEGER NOT NULL,
      puesto_id INTEGER NOT NULL,
      elemento_id INTEGER NOT NULL,
      componente_id INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      descripcion TEXT NOT NULL,
      resolucion TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed_at TEXT,
      FOREIGN KEY (domo_id) REFERENCES domos(id),
      FOREIGN KEY (puesto_id) REFERENCES puestos(id),
      FOREIGN KEY (elemento_id) REFERENCES elementos(id),
      FOREIGN KEY (componente_id) REFERENCES componentes(id)
    );

    INSERT OR REPLACE INTO meta(clave, valor) VALUES ('schema_version', '${SCHEMA_VERSION}');
    COMMIT;
  `);

  seedBaseStructure();
}

export function getSchemaVersion() {
  try {
    const row = select(`SELECT valor FROM meta WHERE clave = 'schema_version' LIMIT 1;`);
    return row[0]?.valor ?? null;
  } catch {
    return null;
  }
}

function getLastInsertId() {
  const row = select('SELECT last_insert_rowid() as id;');
  return Number(row[0]?.id ?? 0);
}

function seedBaseStructure() {
  const existing = select('SELECT COUNT(*) as total FROM domos;')[0];
  if (Number(existing?.total ?? 0) > 0) {
    return;
  }

  const baseStructure = createBaseStructure();
  db.run('BEGIN;');
  try {
    baseStructure.forEach(domo => {
      const domoId = getOrCreateDomo(domo.nombre);
      domo.puestos.forEach(puesto => {
        const puestoId = getOrCreatePuesto(domoId, puesto.nombre);
        puesto.elementos.forEach(elemento => {
          const elementoId = getOrCreateElemento(puestoId, elemento.nombre);
          elemento.componentes.forEach(componente => {
            if (typeof componente === 'string') {
              getOrCreateComponente(elementoId, componente);
            } else if (componente && typeof componente === 'object') {
              const parentId = getOrCreateComponente(elementoId, componente.nombre);
              (componente.subcomponentes || []).forEach(sub => {
                getOrCreateComponente(elementoId, sub, parentId);
              });
            }
          });
        });
      });
    });
    db.run('COMMIT;');
  } catch (error) {
    db.run('ROLLBACK;');
    console.error('[SQLite] Error al sembrar estructura base', error);
  }
}

function createBaseStructure() {
  const puestoInstructor = {
    nombre: 'Instructor',
    elementos: [
      {
        nombre: 'Servidor VBS',
        componentes: [
          { nombre: 'Cable', subcomponentes: ['Video', 'USB'] },
          'Monitor VBS',
          'Extensor USB',
          'Teclado',
          'Raton',
          'Monitor Visual'
        ]
      },
      {
        nombre: 'Servidor IOS',
        componentes: [
          { nombre: 'Cable', subcomponentes: ['Video', 'USB'] },
          'Monitor IOS',
          'Extensor USB',
          'Joystick'
        ]
      }
    ]
  };

  const puestoJTAC = {
    nombre: 'JTAC',
    elementos: [
      {
        nombre: 'Servidor Host',
        componentes: ['Tablet Rover']
      },
      {
        nombre: 'Servidor Radio',
        componentes: ['Mini PC', 'Radio Maquetada', 'Cascos']
      },
      {
        nombre: 'Servidor Proyeccion',
        componentes: [
          { nombre: 'Cable', subcomponentes: ['USB'] },
          'Extensor USB',
          'DAGR',
          'Puntero',
          'Mando BT'
        ]
      },
      {
        nombre: 'Servidor LTD',
        componentes: [
          { nombre: 'Cable', subcomponentes: ['Video', 'USB'] },
          'Extensor USB',
          'LTD'
        ]
      },
      {
        nombre: 'Servidor Moskito',
        componentes: [
          { nombre: 'Cable', subcomponentes: ['Video', 'USB'] },
          'Extensor USB',
          'Moskito'
        ]
      },
      {
        nombre: 'Servidor Jim Compact',
        componentes: [
          { nombre: 'Cable', subcomponentes: ['Video', 'USB'] },
          'Extensor USB',
          'Jim Compact'
        ]
      }
    ]
  };

  const puestoPiloto = {
    nombre: 'Piloto',
    elementos: [
      {
        nombre: 'Servidor Radio',
        componentes: ['Mini PC', 'Radio Maquetada', 'Cascos']
      },
      {
        nombre: 'Servidor VBS',
        componentes: [
          'Palanca de Gases',
          'Pedales',
          'Joystick HOTAS',
          { nombre: 'Cable', subcomponentes: ['USB'] },
          'Extensor USB',
          'Monitor VBS + Instrumentacion'
        ]
      },
      {
        nombre: 'Servidor IOS',
        componentes: [
          { nombre: 'Cable', subcomponentes: ['Video', 'USB'] },
          'Extensor USB',
          'Monitor IOS',
          'Teclado + Trackpad'
        ]
      },
      {
        nombre: 'Servidor Rover',
        componentes: [
          'Monitor VBS',
          { nombre: 'Cable', subcomponentes: ['Video', 'USB'] },
          'Extensor USB'
        ]
      }
    ]
  };

  const domos = ['Domo 1', 'Domo 2'].map(nombre => ({
    nombre,
    puestos: [puestoInstructor, puestoJTAC, puestoPiloto]
  }));

  return domos;
}

function getOrCreateDomo(nombre) {
  const existing = select('SELECT id FROM domos WHERE nombre = :nombre LIMIT 1;', { ':nombre': nombre });
  if (existing.length) {
    return Number(existing[0].id);
  }
  run('INSERT INTO domos(nombre) VALUES (:nombre);', { ':nombre': nombre });
  return getLastInsertId();
}

function getOrCreatePuesto(domoId, nombre) {
  const existing = select(
    'SELECT id FROM puestos WHERE domo_id = :domo_id AND nombre = :nombre LIMIT 1;',
    { ':domo_id': domoId, ':nombre': nombre }
  );
  if (existing.length) {
    return Number(existing[0].id);
  }
  run(
    'INSERT INTO puestos(domo_id, nombre) VALUES (:domo_id, :nombre);',
    { ':domo_id': domoId, ':nombre': nombre }
  );
  return getLastInsertId();
}

function getOrCreateElemento(puestoId, nombre) {
  const existing = select(
    'SELECT id FROM elementos WHERE puesto_id = :puesto_id AND nombre = :nombre LIMIT 1;',
    { ':puesto_id': puestoId, ':nombre': nombre }
  );
  if (existing.length) {
    return Number(existing[0].id);
  }
  run(
    'INSERT INTO elementos(puesto_id, nombre) VALUES (:puesto_id, :nombre);',
    { ':puesto_id': puestoId, ':nombre': nombre }
  );
  return getLastInsertId();
}

function getOrCreateComponente(elementoId, nombre, parentId = null) {
  const existing = select(
    `SELECT id FROM componentes 
     WHERE elemento_id = :elemento_id 
       AND nombre = :nombre
       AND IFNULL(parent_id, -1) = IFNULL(:parent_id, -1)
     LIMIT 1;`,
    {
      ':elemento_id': elementoId,
      ':nombre': nombre,
      ':parent_id': parentId
    }
  );
  if (existing.length) {
    return Number(existing[0].id);
  }
  run(
    'INSERT INTO componentes(elemento_id, nombre, parent_id) VALUES (:elemento_id, :nombre, :parent_id);',
    {
      ':elemento_id': elementoId,
      ':nombre': nombre,
      ':parent_id': parentId
    }
  );
  return getLastInsertId();
}

// Hierarchy helpers ---------------------------------------------------------

export function getDomos() {
  return select('SELECT id, nombre FROM domos ORDER BY nombre;');
}

export function addDomo(nombre) {
  const clean = nombre.trim();
  if (!clean) throw new Error('Nombre de domo vacio');
  const id = getOrCreateDomo(clean);
  return { id, nombre: clean };
}

export function getPuestosByDomo(domoId) {
  return select(
    'SELECT id, nombre FROM puestos WHERE domo_id = :domo_id ORDER BY nombre;',
    { ':domo_id': domoId }
  );
}

export function addPuesto(domoId, nombre) {
  const clean = nombre.trim();
  if (!clean) throw new Error('Nombre de puesto vacio');
  const id = getOrCreatePuesto(domoId, clean);
  return { id, nombre: clean, domo_id: domoId };
}

export function getElementosByPuesto(puestoId) {
  return select(
    'SELECT id, nombre FROM elementos WHERE puesto_id = :puesto_id ORDER BY nombre;',
    { ':puesto_id': puestoId }
  );
}

export function addElemento(puestoId, nombre) {
  const clean = nombre.trim();
  if (!clean) throw new Error('Nombre de elemento vacio');
  const id = getOrCreateElemento(puestoId, clean);
  return { id, nombre: clean, puesto_id: puestoId };
}

export function getComponentesByElemento(elementoId) {
  const padres = select(
    'SELECT id, nombre FROM componentes WHERE elemento_id = :elemento_id AND parent_id IS NULL ORDER BY nombre;',
    { ':elemento_id': elementoId }
  );
  return padres.map(parent => {
    const hijos = select(
      'SELECT id, nombre FROM componentes WHERE parent_id = :parent_id ORDER BY nombre;',
      { ':parent_id': parent.id }
    );
    return {
      id: Number(parent.id),
      nombre: parent.nombre,
      hijos: hijos.map(h => ({ id: Number(h.id), nombre: h.nombre }))
    };
  });
}

export function addComponente(elementoId, nombre, parentId = null) {
  const clean = nombre.trim();
  if (!clean) throw new Error('Nombre de componente vacio');
  const id = getOrCreateComponente(elementoId, clean, parentId);
  return { id, nombre: clean, elemento_id: elementoId, parent_id: parentId };
}

export function getComponenteById(id) {
  const rows = select(
    'SELECT id, nombre, parent_id, elemento_id FROM componentes WHERE id = :id LIMIT 1;',
    { ':id': id }
  );
  if (!rows.length) return null;
  const comp = rows[0];
  if (comp.parent_id) {
    const parent = select(
      'SELECT id, nombre FROM componentes WHERE id = :id LIMIT 1;',
      { ':id': comp.parent_id }
    )[0];
    return {
      id: Number(comp.id),
      nombre: comp.nombre,
      parent: parent ? { id: Number(parent.id), nombre: parent.nombre } : null,
      elemento_id: Number(comp.elemento_id)
    };
  }
  return {
    id: Number(comp.id),
    nombre: comp.nombre,
    parent: null,
    elemento_id: Number(comp.elemento_id)
  };
}

// Incidents -----------------------------------------------------------------

export function createIncident({
  fecha,
  domoId,
  puestoId,
  elementoId,
  componenteId = null,
  descripcion,
  status = 'open',
  resolucion = null
}) {
  const timestamp = new Date().toISOString();
  run(
    `INSERT INTO incidentes(
      fecha, domo_id, puesto_id, elemento_id, componente_id,
      status, descripcion, resolucion, created_at, updated_at
    ) VALUES (
      :fecha, :domo_id, :puesto_id, :elemento_id, :componente_id,
      :status, :descripcion, :resolucion, :created_at, :updated_at
    );`,
    {
      ':fecha': fecha,
      ':domo_id': domoId,
      ':puesto_id': puestoId,
      ':elemento_id': elementoId,
      ':componente_id': componenteId,
      ':status': status,
      ':descripcion': descripcion,
      ':resolucion': resolucion,
      ':created_at': timestamp,
      ':updated_at': timestamp
    }
  );
  const id = getLastInsertId();
  return getIncidentById(id);
}

export function getIncidentById(id) {
  const rows = select(
    `SELECT i.*,
            d.nombre AS domo_nombre,
            p.nombre AS puesto_nombre,
            e.nombre AS elemento_nombre,
            comp.nombre AS componente_nombre,
            parent.nombre AS componente_padre
     FROM incidentes i
     JOIN domos d ON d.id = i.domo_id
     JOIN puestos p ON p.id = i.puesto_id
     JOIN elementos e ON e.id = i.elemento_id
     LEFT JOIN componentes comp ON comp.id = i.componente_id
     LEFT JOIN componentes parent ON comp.parent_id = parent.id
     WHERE i.id = :id
     LIMIT 1;`,
    { ':id': id }
  );
  if (!rows.length) return null;
  return mapIncidentRow(rows[0]);
}

export function listIncidents({ status = null } = {}) {
  const where = status ? 'WHERE i.status = :status' : '';
  const rows = select(
    `SELECT i.*,
            d.nombre AS domo_nombre,
            p.nombre AS puesto_nombre,
            e.nombre AS elemento_nombre,
            comp.nombre AS componente_nombre,
            parent.nombre AS componente_padre
     FROM incidentes i
     JOIN domos d ON d.id = i.domo_id
     JOIN puestos p ON p.id = i.puesto_id
     JOIN elementos e ON e.id = i.elemento_id
     LEFT JOIN componentes comp ON comp.id = i.componente_id
     LEFT JOIN componentes parent ON comp.parent_id = parent.id
     ${where}
     ORDER BY i.created_at DESC;`,
    status ? { ':status': status } : {}
  );
  return rows.map(mapIncidentRow);
}

function mapIncidentRow(row) {
  const componentPath = row.componente_padre
    ? `${row.componente_padre} / ${row.componente_nombre}`
    : row.componente_nombre || null;

  return {
    id: Number(row.id),
    fecha: row.fecha,
    status: row.status,
    descripcion: row.descripcion,
    resolucion: row.resolucion,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    domo: { id: Number(row.domo_id), nombre: row.domo_nombre },
    puesto: { id: Number(row.puesto_id), nombre: row.puesto_nombre },
    elemento: { id: Number(row.elemento_id), nombre: row.elemento_nombre },
    componente: componentPath
  };
}

export function resolveIncident(id, resolucion) {
  const timestamp = new Date().toISOString();
  run(
    `UPDATE incidentes
     SET status = 'closed',
         resolucion = :resolucion,
         closed_at = :closed_at,
         updated_at = :updated_at
     WHERE id = :id;`,
    {
      ':id': id,
      ':resolucion': resolucion,
      ':closed_at': timestamp,
      ':updated_at': timestamp
    }
  );
  return getIncidentById(id);
}

export function reopenIncident(id) {
  const timestamp = new Date().toISOString();
  run(
    `UPDATE incidentes
     SET status = 'open',
         closed_at = NULL,
         resolucion = NULL,
         updated_at = :updated_at
     WHERE id = :id;`,
    {
      ':id': id,
      ':updated_at': timestamp
    }
  );
  return getIncidentById(id);
}

export function deleteIncident(id) {
  run('DELETE FROM incidentes WHERE id = :id;', { ':id': id });
}

export function getIncidentStatistics() {
  const total = select('SELECT COUNT(*) as total FROM incidentes;')[0]?.total ?? 0;

  const byStatus = select(
    'SELECT status, COUNT(*) as total FROM incidentes GROUP BY status;'
  ).map(row => ({
    status: row.status,
    total: Number(row.total)
  }));

  const byElemento = select(
    `SELECT e.nombre as elemento, COUNT(*) as total
     FROM incidentes i
     JOIN elementos e ON e.id = i.elemento_id
     GROUP BY e.id
     ORDER BY total DESC;`
  ).map(row => ({
    elemento: row.elemento,
    total: Number(row.total)
  }));

  const topComponentes = select(
    `SELECT 
        COALESCE(parent.nombre || ' / ' || comp.nombre, comp.nombre, 'Sin componente') AS componente,
        COUNT(*) as total
     FROM incidentes i
     LEFT JOIN componentes comp ON comp.id = i.componente_id
     LEFT JOIN componentes parent ON comp.parent_id = parent.id
     GROUP BY componente
     ORDER BY total DESC;`
  ).map(row => ({
    componente: row.componente || 'Sin componente',
    total: Number(row.total)
  }));

  const abiertos = byStatus.find(item => item.status === 'open')?.total ?? 0;
  const cerrados = byStatus.find(item => item.status === 'closed')?.total ?? 0;

  return {
    total: Number(total),
    abiertos,
    cerrados,
    porEstado: byStatus,
    porElemento: byElemento,
    porComponente: topComponentes
  };
}

export function exportIncidentsPayload() {
  const incidents = listIncidents();
  const stats = getIncidentStatistics();
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      incidents,
      statistics: stats
    },
    null,
    2
  );
}
