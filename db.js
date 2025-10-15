const STORE_KEY = 'simjtac_incidents_store_v2';
const SCHEMA_VERSION = 2;

let store = createEmptyStore();
let persistenceAvailable = true;

export async function initDB() {
    loadStore();
    ensureSchema();
    return true;
}

export function getSchemaVersion() {
    return store.meta.schemaVersion ?? null;
}

export function getDomos() {
    return store.domos
        .slice()
        .sort(sortByName)
        .map(d => ({ id: d.id, nombre: d.nombre }));
}

export function addDomo(nombre) {
    const clean = cleanName(nombre);
    if (!clean) {
        throw new Error('Nombre de domo vacio');
    }
    const id = getOrCreateDomo(clean);
    saveStore();
    return findDomo(id);
}

export function getPuestosByDomo(domoId) {
    const id = Number(domoId);
    return store.puestos
        .filter(p => p.domoId === id)
        .slice()
        .sort(sortByName)
        .map(p => ({ id: p.id, nombre: p.nombre }));
}

export function addPuesto(domoId, nombre) {
    const domo = getDomoRecord(domoId);
    if (!domo) {
        throw new Error('Domo no encontrado');
    }
    const id = getOrCreatePuesto(domo.id, nombre);
    saveStore();
    return findPuesto(id);
}

export function getElementosByPuesto(puestoId) {
    const id = Number(puestoId);
    return store.elementos
        .filter(e => e.puestoId === id)
        .slice()
        .sort(sortByName)
        .map(e => ({ id: e.id, nombre: e.nombre }));
}

export function addElemento(puestoId, nombre) {
    const puesto = getPuestoRecord(puestoId);
    if (!puesto) {
        throw new Error('Puesto no encontrado');
    }
    const id = getOrCreateElemento(puesto.id, nombre);
    saveStore();
    return findElemento(id);
}

export function getComponentesByElemento(elementoId) {
    const id = Number(elementoId);
    return store.componentes
        .filter(c => c.elementoId === id && c.parentId == null)
        .slice()
        .sort(sortByName)
        .map(parent => ({
            id: parent.id,
            nombre: parent.nombre,
            hijos: store.componentes
                .filter(child => child.parentId === parent.id)
                .slice()
                .sort(sortByName)
                .map(child => ({ id: child.id, nombre: child.nombre }))
        }));
}

export function addComponente(elementoId, nombre, parentId = null) {
    const elemento = getElementoRecord(elementoId);
    if (!elemento) {
        throw new Error('Elemento no encontrado');
    }

    const normalizedParent = parentId != null ? Number(parentId) : null;
    if (normalizedParent) {
        const parent = getComponentRecord(normalizedParent);
        if (!parent || parent.elementoId !== elemento.id) {
            throw new Error('Componente padre no valido');
        }
    }

    const id = getOrCreateComponente(elemento.id, nombre, normalizedParent);
    saveStore();
    const record = getComponentRecord(id);
    return {
        id: record.id,
        nombre: record.nombre,
        elemento_id: record.elementoId,
        parent_id: record.parentId
    };
}

export function getComponenteById(id) {
    const record = getComponentRecord(id);
    if (!record) {
        return null;
    }
    const parent = record.parentId ? getComponentRecord(record.parentId) : null;
    return {
        id: record.id,
        nombre: record.nombre,
        parent: parent ? { id: parent.id, nombre: parent.nombre } : null,
        elemento_id: record.elementoId
    };
}

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
    const incidentDate = fecha || new Date().toISOString().split('T')[0];
    const description = cleanText(descripcion);
    const resolution = resolucion != null ? cleanText(resolucion) : null;
    const timestamp = new Date().toISOString();

    const record = {
        id: generateId('incidentes'),
        fecha: incidentDate,
        domoId: Number(domoId),
        puestoId: Number(puestoId),
        elementoId: Number(elementoId),
        componenteId: componenteId != null ? Number(componenteId) : null,
        status,
        descripcion: description,
        resolucion: resolution,
        createdAt: timestamp,
        updatedAt: timestamp,
        closedAt: status === 'closed' ? timestamp : null
    };

    store.incidentes.push(record);
    saveStore();
    return mapIncident(record);
}

export function listIncidents({ status = null } = {}) {
    const records = store.incidentes
        .slice()
        .filter(record => (status ? record.status === status : true))
        .sort((a, b) => {
            const keyA = a.createdAt || '';
            const keyB = b.createdAt || '';
            if (keyA === keyB) {
                return b.id - a.id;
            }
            return keyB.localeCompare(keyA);
        });

    return records.map(mapIncident);
}

export function resolveIncident(id, resolucion) {
    const record = getIncidentRecord(id);
    if (!record) {
        return null;
    }
    record.status = 'closed';
    record.resolucion = cleanText(resolucion);
    record.closedAt = new Date().toISOString();
    record.updatedAt = record.closedAt;
    saveStore();
    return mapIncident(record);
}

export function reopenIncident(id) {
    const record = getIncidentRecord(id);
    if (!record) {
        return null;
    }
    record.status = 'open';
    record.resolucion = null;
    record.closedAt = null;
    record.updatedAt = new Date().toISOString();
    saveStore();
    return mapIncident(record);
}

export function deleteIncident(id) {
    const index = findIncidentIndex(id);
    if (index === -1) {
        return;
    }
    store.incidentes.splice(index, 1);
    saveStore();
}

export function getIncidentStatistics() {
    const total = store.incidentes.length;
    const statusMap = new Map();
    const elementoMap = new Map();
    const componenteMap = new Map();

    store.incidentes.forEach(record => {
        statusMap.set(record.status, (statusMap.get(record.status) || 0) + 1);

        const elemento = getElementoRecord(record.elementoId);
        const elementoNombre = elemento ? elemento.nombre : 'No definido';
        elementoMap.set(elementoNombre, (elementoMap.get(elementoNombre) || 0) + 1);

        const componente = record.componenteId ? getComponentRecord(record.componenteId) : null;
        const parent = componente && componente.parentId ? getComponentRecord(componente.parentId) : null;
        const componenteNombre = componente
            ? parent
                ? `${parent.nombre} / ${componente.nombre}`
                : componente.nombre
            : 'Sin componente';
        componenteMap.set(componenteNombre, (componenteMap.get(componenteNombre) || 0) + 1);
    });

    const porEstado = Array.from(statusMap.entries())
        .map(([status, count]) => ({ status, total: count }))
        .sort((a, b) => b.total - a.total);

    const porElemento = Array.from(elementoMap.entries())
        .map(([elemento, count]) => ({ elemento, total: count }))
        .sort((a, b) => b.total - a.total);

    const porComponente = Array.from(componenteMap.entries())
        .map(([componente, count]) => ({ componente, total: count }))
        .sort((a, b) => b.total - a.total);

    return {
        total,
        abiertos: statusMap.get('open') || 0,
        cerrados: statusMap.get('closed') || 0,
        porEstado,
        porElemento,
        porComponente
    };
}

export function exportIncidentsPayload() {
    const payload = {
        generatedAt: new Date().toISOString(),
        incidents: listIncidents(),
        statistics: getIncidentStatistics()
    };
    return JSON.stringify(payload, null, 2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptyStore() {
    return {
        meta: { schemaVersion: 0 },
        domos: [],
        puestos: [],
        elementos: [],
        componentes: [],
        incidentes: [],
        counters: {
            domos: 1,
            puestos: 1,
            elementos: 1,
            componentes: 1,
            incidentes: 1
        }
    };
}

function ensureSchema() {
    if (store.meta.schemaVersion !== SCHEMA_VERSION) {
        store = createEmptyStore();
        store.meta.schemaVersion = SCHEMA_VERSION;
        seedBaseStructure();
        return;
    }

    store.meta.schemaVersion = SCHEMA_VERSION;
    if (!store.domos.length) {
        seedBaseStructure();
    }
}

function seedBaseStructure() {
    if (store.domos.length) {
        return;
    }

    const base = createBaseStructure();
    base.forEach(domo => {
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

    recalcCounters();
    saveStore();
}

function createBaseStructure() {
    return ['Domo 1', 'Domo 2'].map(nombre => ({
        nombre,
        puestos: createDefaultPuestos()
    }));
}

function createDefaultPuestos() {
    return [
        createInstructorPuesto(),
        createJTACPuesto(),
        createPilotoPuesto()
    ];
}

function createInstructorPuesto() {
    return {
        nombre: 'Instructor',
        elementos: [
            {
                nombre: 'Servidor VBS',
                componentes: [
                    { nombre: 'Cable', subcomponentes: ['Video', 'USB'] },
                    'Extensor USB',
                    'Monitor VBS',
                    'Monitor Visual',
                    'Teclado',
                    'Raton'
                ]
            },
            {
                nombre: 'Servidor IOS',
                componentes: [
                    { nombre: 'Cable', subcomponentes: ['Video', 'USB'] },
                    'Extensor USB',
                    'Monitor IOS',
                    'Joystick'
                ]
            }
        ]
    };
}

function createJTACPuesto() {
    return {
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
}

function createPilotoPuesto() {
    return {
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
}

function loadStore() {
    persistenceAvailable = canUseLocalStorage();
    if (!persistenceAvailable) {
        store = createEmptyStore();
        return;
    }

    try {
        const raw = window.localStorage.getItem(STORE_KEY);
        if (raw) {
            store = normalizeStore(JSON.parse(raw));
        } else {
            store = createEmptyStore();
        }
    } catch (error) {
        console.warn('[Store] No se pudo cargar el almacenamiento local.', error);
        persistenceAvailable = false;
        store = createEmptyStore();
    }

    recalcCounters();
}

function saveStore() {
    if (!persistenceAvailable) {
        return;
    }
    try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (error) {
        persistenceAvailable = false;
        console.warn('[Store] No se pudo guardar el almacenamiento local.', error);
    }
}

function normalizeStore(parsed) {
    const fresh = createEmptyStore();
    if (!parsed || typeof parsed !== 'object') {
        return fresh;
    }

    fresh.meta.schemaVersion = Number(parsed.meta?.schemaVersion ?? 0) || 0;

    if (Array.isArray(parsed.domos)) {
        fresh.domos = parsed.domos
            .map(item => ({
                id: Number(item.id),
                nombre: cleanName(item.nombre)
            }))
            .filter(item => !Number.isNaN(item.id) && item.nombre);
    }

    if (Array.isArray(parsed.puestos)) {
        fresh.puestos = parsed.puestos
            .map(item => ({
                id: Number(item.id),
                domoId: Number(item.domoId ?? item.domo_id),
                nombre: cleanName(item.nombre)
            }))
            .filter(item => !Number.isNaN(item.id) && !Number.isNaN(item.domoId) && item.nombre);
    }

    if (Array.isArray(parsed.elementos)) {
        fresh.elementos = parsed.elementos
            .map(item => ({
                id: Number(item.id),
                puestoId: Number(item.puestoId ?? item.puesto_id),
                nombre: cleanName(item.nombre)
            }))
            .filter(item => !Number.isNaN(item.id) && !Number.isNaN(item.puestoId) && item.nombre);
    }

    if (Array.isArray(parsed.componentes)) {
        fresh.componentes = parsed.componentes
            .map(item => ({
                id: Number(item.id),
                elementoId: Number(item.elementoId ?? item.elemento_id),
                parentId:
                    item.parentId != null || item.parent_id != null
                        ? Number(item.parentId ?? item.parent_id)
                        : null,
                nombre: cleanName(item.nombre)
            }))
            .filter(
                item =>
                    !Number.isNaN(item.id) &&
                    !Number.isNaN(item.elementoId) &&
                    item.nombre &&
                    (item.parentId == null || !Number.isNaN(item.parentId))
            );
    }

    if (Array.isArray(parsed.incidentes)) {
        fresh.incidentes = parsed.incidentes
            .map(item => ({
                id: Number(item.id),
                fecha: item.fecha || '',
                domoId: Number(item.domoId ?? item.domo_id),
                puestoId: Number(item.puestoId ?? item.puesto_id),
                elementoId: Number(item.elementoId ?? item.elemento_id),
                componenteId:
                    item.componenteId != null || item.componente_id != null
                        ? Number(item.componenteId ?? item.componente_id)
                        : null,
                status: item.status || 'open',
                descripcion: cleanText(item.descripcion),
                resolucion: item.resolucion != null ? cleanText(item.resolucion) : null,
                createdAt: item.createdAt || item.created_at || new Date().toISOString(),
                updatedAt: item.updatedAt || item.updated_at || new Date().toISOString(),
                closedAt: item.closedAt || item.closed_at || null
            }))
            .filter(
                item =>
                    !Number.isNaN(item.id) &&
                    !Number.isNaN(item.domoId) &&
                    !Number.isNaN(item.puestoId) &&
                    !Number.isNaN(item.elementoId)
            );
    }

    if (parsed.counters && typeof parsed.counters === 'object') {
        fresh.counters = {
            domos: Number(parsed.counters.domos) || fresh.counters.domos,
            puestos: Number(parsed.counters.puestos) || fresh.counters.puestos,
            elementos: Number(parsed.counters.elementos) || fresh.counters.elementos,
            componentes: Number(parsed.counters.componentes) || fresh.counters.componentes,
            incidentes: Number(parsed.counters.incidentes) || fresh.counters.incidentes
        };
    }

    return fresh;
}

function recalcCounters() {
    store.counters.domos = nextId(store.domos);
    store.counters.puestos = nextId(store.puestos);
    store.counters.elementos = nextId(store.elementos);
    store.counters.componentes = nextId(store.componentes);
    store.counters.incidentes = nextId(store.incidentes);
}

function nextId(collection) {
    let max = 0;
    collection.forEach(item => {
        const value = Number(item.id);
        if (!Number.isNaN(value)) {
            item.id = value;
            if (value > max) {
                max = value;
            }
        }
    });
    return max + 1;
}

function canUseLocalStorage() {
    try {
        if (typeof window === 'undefined' || !('localStorage' in window)) {
            return false;
        }
        const testKey = '__simjtac_test__';
        window.localStorage.setItem(testKey, '1');
        window.localStorage.removeItem(testKey);
        return true;
    } catch {
        return false;
    }
}

function getOrCreateDomo(nombre) {
    const clean = cleanName(nombre);
    let record = store.domos.find(item => sameName(item.nombre, clean));
    if (record) {
        return record.id;
    }
    const id = generateId('domos');
    record = { id, nombre: clean };
    store.domos.push(record);
    return id;
}

function getOrCreatePuesto(domoId, nombre) {
    const clean = cleanName(nombre);
    let record = store.puestos.find(
        item => item.domoId === domoId && sameName(item.nombre, clean)
    );
    if (record) {
        return record.id;
    }
    const id = generateId('puestos');
    record = { id, domoId, nombre: clean };
    store.puestos.push(record);
    return id;
}

function getOrCreateElemento(puestoId, nombre) {
    const clean = cleanName(nombre);
    let record = store.elementos.find(
        item => item.puestoId === puestoId && sameName(item.nombre, clean)
    );
    if (record) {
        return record.id;
    }
    const id = generateId('elementos');
    record = { id, puestoId, nombre: clean };
    store.elementos.push(record);
    return id;
}

function getOrCreateComponente(elementoId, nombre, parentId = null) {
    const clean = cleanName(nombre);
    const normalizedParent = parentId != null ? Number(parentId) : null;
    let record = store.componentes.find(
        item =>
            item.elementoId === elementoId &&
            (item.parentId ?? null) === (normalizedParent ?? null) &&
            sameName(item.nombre, clean)
    );
    if (record) {
        return record.id;
    }
    const id = generateId('componentes');
    record = { id, elementoId, parentId: normalizedParent, nombre: clean };
    store.componentes.push(record);
    return id;
}

function getIncidentRecord(id) {
    const numeric = Number(id);
    if (Number.isNaN(numeric)) {
        return null;
    }
    return store.incidentes.find(item => item.id === numeric) || null;
}

function findIncidentIndex(id) {
    const numeric = Number(id);
    if (Number.isNaN(numeric)) {
        return -1;
    }
    return store.incidentes.findIndex(item => item.id === numeric);
}

function getDomoRecord(id) {
    const numeric = Number(id);
    if (Number.isNaN(numeric)) {
        return null;
    }
    return store.domos.find(item => item.id === numeric) || null;
}

function getPuestoRecord(id) {
    const numeric = Number(id);
    if (Number.isNaN(numeric)) {
        return null;
    }
    return store.puestos.find(item => item.id === numeric) || null;
}

function getElementoRecord(id) {
    const numeric = Number(id);
    if (Number.isNaN(numeric)) {
        return null;
    }
    return store.elementos.find(item => item.id === numeric) || null;
}

function getComponentRecord(id) {
    const numeric = Number(id);
    if (Number.isNaN(numeric)) {
        return null;
    }
    return store.componentes.find(item => item.id === numeric) || null;
}

function findDomo(id) {
    const record = getDomoRecord(id);
    return record ? { id: record.id, nombre: record.nombre } : null;
}

function findPuesto(id) {
    const record = getPuestoRecord(id);
    return record ? { id: record.id, nombre: record.nombre, domo_id: record.domoId } : null;
}

function findElemento(id) {
    const record = getElementoRecord(id);
    return record ? { id: record.id, nombre: record.nombre, puesto_id: record.puestoId } : null;
}

function mapIncident(record) {
    const domo = getDomoRecord(record.domoId);
    const puesto = getPuestoRecord(record.puestoId);
    const elemento = getElementoRecord(record.elementoId);
    const componente = record.componenteId ? getComponentRecord(record.componenteId) : null;
    const parent = componente && componente.parentId ? getComponentRecord(componente.parentId) : null;

    const componentePath = componente
        ? parent
            ? `${parent.nombre} / ${componente.nombre}`
            : componente.nombre
        : null;

    return {
        id: record.id,
        fecha: record.fecha,
        status: record.status,
        descripcion: record.descripcion,
        resolucion: record.resolucion,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        closedAt: record.closedAt,
        domo: domo ? { id: domo.id, nombre: domo.nombre } : { id: record.domoId, nombre: 'No definido' },
        puesto: puesto
            ? { id: puesto.id, nombre: puesto.nombre }
            : { id: record.puestoId, nombre: 'No definido' },
        elemento: elemento
            ? { id: elemento.id, nombre: elemento.nombre }
            : { id: record.elementoId, nombre: 'No definido' },
        componente: componentePath
    };
}

function cleanName(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function cleanText(value) {
    if (value == null) {
        return '';
    }
    return String(value).trim();
}

function sameName(a, b) {
    return cleanName(a).toLowerCase() === cleanName(b).toLowerCase();
}

function sortByName(a, b) {
    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
}

function generateId(key) {
    if (!store.counters[key] || store.counters[key] < 1) {
        store.counters[key] = 1;
    }
    const value = store.counters[key];
    store.counters[key] = value + 1;
    return value;
}
