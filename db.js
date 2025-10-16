const STORE_KEY = 'simjtac_incidents_store_v3';
const SCHEMA_VERSION = 3;

const IMPACT_LEVELS = [
    { id: 'alta', label: 'Alta' },
    { id: 'media', label: 'Media' },
    { id: 'baja', label: 'Baja' }
];

const NATURE_OPTIONS = [
    { id: 'hardware', label: 'Hardware' },
    { id: 'software', label: 'Software' },
    { id: 'configuracion', label: 'Configuracion' },
    { id: 'conectividad', label: 'Conectividad' }
];

const INCIDENT_STATUSES = [
    { id: 'open', label: 'Abierta' },
    { id: 'in_progress', label: 'En curso' },
    { id: 'closed', label: 'Cerrada' }
];

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

export function addPuesto(domoId, nombre, metadata = null) {
    const domo = getDomoRecord(domoId);
    if (!domo) {
        throw new Error('Domo no encontrado');
    }
    const id = getOrCreatePuesto(domo.id, nombre, metadata);
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

export function addElemento(puestoId, nombre, metadata = null) {
    const puesto = getPuestoRecord(puestoId);
    if (!puesto) {
        throw new Error('Puesto no encontrado');
    }
    const id = getOrCreateElemento(puesto.id, nombre, metadata);
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
            tipo: parent.tipo ?? null,
            jerarquia: parent.jerarquia ?? null,
            cableTipo: parent.cableTipo ?? null,
            hijos: store.componentes
                .filter(child => child.parentId === parent.id)
                .slice()
                .sort(sortByName)
                .map(child => ({
                    id: child.id,
                    nombre: child.nombre,
                    tipo: child.tipo ?? null,
                    jerarquia: child.jerarquia ?? null,
                    cableTipo: child.cableTipo ?? null
                }))
        }));
}

export function addComponente(elementoId, nombre, parentId = null, metadata = null) {
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

    const id = getOrCreateComponente(elemento.id, nombre, normalizedParent, metadata);
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
    impacto,
    descripcion,
    status = 'open',
    resolucion = null
}) {
    const incidentDate = fecha || new Date().toISOString().split('T')[0];
    const description = cleanText(descripcion);
    const resolution = resolucion != null ? cleanText(resolucion) : null;
    const timestamp = new Date().toISOString();
    const impact = normalizeImpact(impacto);
    const normalizedStatus = normalizeStatus(status);

    if (!impact) {
        throw new Error('Impacto invalido');
    }
    if (!normalizedStatus || normalizedStatus === 'closed') {
        throw new Error('Estado inicial de la incidencia no valido');
    }

    const record = {
        id: generateId('incidentes'),
        fecha: incidentDate,
        domoId: Number(domoId),
        puestoId: Number(puestoId),
        elementoId: Number(elementoId),
        componenteId: componenteId != null ? Number(componenteId) : null,
        status: normalizedStatus,
        descripcion: description,
        resolucion: resolution,
        createdAt: timestamp,
        updatedAt: timestamp,
        closedAt: normalizedStatus === 'closed' ? timestamp : null,
        fechaCierre: normalizedStatus === 'closed' ? incidentDate : null,
        impacto: impact,
        naturaleza: null
    };

    store.incidentes.push(record);
    saveStore();
    return mapIncident(record);
}

export function listIncidents(options = {}) {
    const filters = {
        status: options.status ?? options.filters?.status ?? null,
        domoId: options.domoId ?? options.filters?.domoId ?? null,
        puestoId: options.puestoId ?? options.filters?.puestoId ?? null,
        elementoId: options.elementoId ?? options.filters?.elementoId ?? null,
        impacto: options.impacto ?? options.filters?.impacto ?? null,
        search: options.search ?? options.filters?.search ?? null
    };

    const normalizedStatus = filters.status ? normalizeStatus(filters.status) : null;
    const searchTerm = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : '';

    const records = store.incidentes
        .slice()
        .filter(record => {
            if (normalizedStatus && record.status !== normalizedStatus) {
                return false;
            }
            if (filters.domoId && Number(record.domoId) !== Number(filters.domoId)) {
                return false;
            }
            if (filters.puestoId && Number(record.puestoId) !== Number(filters.puestoId)) {
                return false;
            }
            if (filters.elementoId && Number(record.elementoId) !== Number(filters.elementoId)) {
                return false;
            }
            if (filters.impacto) {
                const impactFilter = normalizeImpact(filters.impacto);
                if (impactFilter && record.impacto !== impactFilter) {
                    return false;
                }
            }
            if (searchTerm) {
                const haystack = [
                    record.descripcion,
                    record.resolucion,
                    getDomoRecord(record.domoId)?.nombre,
                    getPuestoRecord(record.puestoId)?.nombre,
                    getElementoRecord(record.elementoId)?.nombre
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(searchTerm)) {
                    return false;
                }
            }
            return true;
        })
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

export function resolveIncident(
    id,
    { resolucion, naturaleza, fechaCierre = null, componenteId = undefined } = {}
) {
    const record = getIncidentRecord(id);
    if (!record) {
        return null;
    }
    const resolution = cleanText(resolucion);
    if (!resolution) {
        throw new Error('La resolucion es obligatoria al cerrar una incidencia.');
    }

    const normalizedNature = normalizeNature(naturaleza);
    if (!normalizedNature) {
        throw new Error('Naturaleza no valida');
    }

    if (componenteId !== undefined) {
        record.componenteId = componenteId ? Number(componenteId) : null;
    }

    const closure = buildClosureTimestamp(fechaCierre);

    record.status = 'closed';
    record.naturaleza = normalizedNature;
    record.resolucion = resolution;
    record.closedAt = closure.timestamp;
    record.fechaCierre = closure.date;
    record.updatedAt = record.closedAt;
    saveStore();
    return mapIncident(record);
}

export function updateIncidentDetails(id, { descripcion, impacto } = {}) {
    const record = getIncidentRecord(id);
    if (!record) {
        return null;
    }

    let changed = false;

    if (descripcion !== undefined) {
        const cleanDescripcion = cleanText(descripcion);
        if (!cleanDescripcion) {
            throw new Error('La descripcion no puede estar vacia');
        }
        record.descripcion = cleanDescripcion;
        changed = true;
    }

    if (impacto !== undefined) {
        const normalizedImpact = normalizeImpact(impacto);
        if (!normalizedImpact) {
            throw new Error('Impacto no valido');
        }
        record.impacto = normalizedImpact;
        changed = true;
    }

    if (changed) {
        record.updatedAt = new Date().toISOString();
        saveStore();
    }

    return mapIncident(record);
}

export function setIncidentStatus(id, status) {
    const record = getIncidentRecord(id);
    if (!record) {
        return null;
    }
    const normalized = normalizeStatus(status);
    if (!normalized || normalized === 'closed') {
        throw new Error('Estado no valido');
    }
    if (record.status === 'closed') {
        throw new Error('No se puede cambiar el estado de una incidencia cerrada. Usa reopenIncident.');
    }
    if (record.status === normalized) {
        return mapIncident(record);
    }
    record.status = normalized;
    record.updatedAt = new Date().toISOString();
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
    record.naturaleza = null;
    record.closedAt = null;
    record.fechaCierre = null;
    record.componenteId = null;
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
    const impactMap = new Map();
    const natureMap = new Map();
    const weekMap = new Map();
    const openDurations = [];
    const elementClosureMap = new Map();
    const now = new Date();

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

        const impactKey = record.impacto || 'sin_definir';
        impactMap.set(impactKey, (impactMap.get(impactKey) || 0) + 1);

        const natureKey = record.naturaleza || 'sin_definir';
        natureMap.set(natureKey, (natureMap.get(natureKey) || 0) + 1);

        const weekKey = toISOWeek(record.fecha);
        if (weekKey) {
            weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
        }

        const cierreReferencia =
            record.status === 'closed' && record.fechaCierre ? record.fechaCierre : null;

        if (record.status === 'closed' && cierreReferencia) {
            const dias = diffInDays(record.fecha, cierreReferencia);
            if (dias != null) {
                const key = elemento ? elemento.id : record.elementoId;
                const current = elementClosureMap.get(key) || {
                    elementoId: key,
                    elemento: elementoNombre,
                    totalDias: 0,
                    total: 0
                };
                current.totalDias += dias;
                current.total += 1;
                elementClosureMap.set(key, current);
            }
        } else {
            const dias = diffInDays(record.fecha, now);
            if (dias != null) {
                const domo = getDomoRecord(record.domoId);
                const puesto = getPuestoRecord(record.puestoId);
                openDurations.push({
                    id: record.id,
                    dias,
                    impacto: record.impacto || null,
                    status: record.status,
                    domo: domo ? domo.nombre : 'No definido',
                    puesto: puesto ? puesto.nombre : 'No definido',
                    elemento: elementoNombre
                });
            }
        }
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

    const porImpacto = Array.from(impactMap.entries())
        .map(([impacto, count]) => ({
            impacto,
            label: impacto === 'sin_definir' ? 'Sin definir' : getImpactLabel(impacto),
            total: count
        }))
        .sort((a, b) => b.total - a.total);

    const porNaturaleza = Array.from(natureMap.entries())
        .map(([naturaleza, count]) => ({
            naturaleza,
            label: naturaleza === 'sin_definir' ? 'Sin definir' : getNatureLabel(naturaleza),
            total: count
        }))
        .sort((a, b) => b.total - a.total);

    const porSemana = Array.from(weekMap.entries())
        .map(([semana, totalSemana]) => ({ semana, total: totalSemana }))
        .sort((a, b) => a.semana.localeCompare(b.semana))
        .slice(-8);

    const abiertasOrdenadas = openDurations.sort((a, b) => b.dias - a.dias);

    const tiemposPorElemento = Array.from(elementClosureMap.values())
        .map(entry => ({
            elementoId: entry.elementoId,
            elemento: entry.elemento,
            promedio: Math.round((entry.totalDias / entry.total) * 10) / 10,
            total: entry.total
        }))
        .sort((a, b) => b.promedio - a.promedio);

    return {
        total,
        abiertos: statusMap.get('open') || 0,
        enCurso: statusMap.get('in_progress') || 0,
        cerrados: statusMap.get('closed') || 0,
        porEstado,
        porElemento,
        porComponente,
        porImpacto,
        porNaturaleza,
        porSemana,
        tiempos: {
            abiertas: abiertasOrdenadas,
            elementos: tiemposPorElemento
        }
    };
}

export function getImpactLevels() {
    return IMPACT_LEVELS.map(item => ({ ...item }));
}

export function getNatureOptions() {
    return NATURE_OPTIONS.map(item => ({ ...item }));
}

export function getIncidentStatuses() {
    return INCIDENT_STATUSES.map(item => ({ ...item }));
}

export function exportIncidentsPayload() {
    const payload = {
        generatedAt: new Date().toISOString(),
        incidents: listIncidents(),
        statistics: getIncidentStatistics()
    };
    return JSON.stringify(payload, null, 2);
}

export function exportIncidentsCSV() {
    const rows = [
        [
            'id',
            'fecha_apertura',
            'fecha_cierre',
            'estado',
            'impacto',
            'naturaleza',
            'domo',
            'puesto',
            'elemento',
            'componente',
            'descripcion',
            'resolucion'
        ].join(';')
    ];

    listIncidents().forEach(incident => {
        const domoNombre = incident.domo?.nombre ?? '';
        const puestoNombre = incident.puesto?.nombre ?? '';
        const elementoNombre = incident.elemento?.nombre ?? '';
        const componenteNombre = incident.componente ?? '';

        rows.push(
            [
                incident.id,
                incident.fecha,
                incident.fechaCierre ?? '',
                sanitizeCSV(incident.statusLabel ?? ''),
                sanitizeCSV(incident.impactoLabel ?? ''),
                sanitizeCSV(incident.naturalezaLabel ?? ''),
                sanitizeCSV(domoNombre),
                sanitizeCSV(puestoNombre),
                sanitizeCSV(elementoNombre),
                sanitizeCSV(componenteNombre),
                sanitizeCSV(incident.descripcion),
                sanitizeCSV(incident.resolucion ?? '')
            ].join(';')
        );
    });

    return rows.join('\n');
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
            const puestoId = getOrCreatePuesto(domoId, puesto.nombre, extractMetadata(puesto));
            puesto.elementos.forEach(elemento => {
                const elementoId = getOrCreateElemento(
                    puestoId,
                    elemento.nombre,
                    extractMetadata(elemento)
                );
                (elemento.componentes || []).forEach(componente => {
                    const metadata = extractMetadata(componente);
                    const parentId = getOrCreateComponente(
                        elementoId,
                        componente.nombre,
                        null,
                        metadata
                    );
                    if (Array.isArray(componente.hijos)) {
                        componente.hijos.forEach(hijo => {
                            getOrCreateComponente(
                                elementoId,
                                hijo.nombre,
                                parentId,
                                extractMetadata(hijo)
                            );
                        });
                    }
                });
            });
        });
    });

    recalcCounters();
    saveStore();
}

function extractMetadata(node) {
    if (!node || typeof node !== 'object') {
        return null;
    }
    const meta = {};
    if (node.tipo !== undefined) {
        meta.tipo = node.tipo;
    }
    if (node.jerarquia !== undefined) {
        meta.jerarquia = node.jerarquia;
    }
    if (node.cableTipo !== undefined) {
        meta.cableTipo = node.cableTipo;
    }
    return Object.keys(meta).length ? meta : null;
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
        createPilotoPuesto(),
        createProjectionPuesto()
    ];
}

function createInstructorPuesto() {
    return {
        nombre: 'Instructor',
        tipo: 'puesto',
        jerarquia: 1,
        elementos: [
            {
                nombre: 'Servidor VBS',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Cable principal',
                        tipo: 'cable',
                        jerarquia: 2,
                        hijos: [
                            {
                                nombre: 'Video',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'video'
                            },
                            {
                                nombre: 'USB',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'usb'
                            }
                        ]
                    },
                    {
                        nombre: 'Extensor USB',
                        tipo: 'extensor',
                        jerarquia: 3,
                        cableTipo: 'usb'
                    },
                    {
                        nombre: 'Monitor VBS',
                        tipo: 'monitor',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Monitor Visual',
                        tipo: 'monitor',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Teclado',
                        tipo: 'periferico',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Raton',
                        tipo: 'periferico',
                        jerarquia: 2
                    }
                ]
            },
            {
                nombre: 'Servidor IOS',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Cable principal',
                        tipo: 'cable',
                        jerarquia: 2,
                        hijos: [
                            {
                                nombre: 'Video',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'video'
                            },
                            {
                                nombre: 'USB',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'usb'
                            }
                        ]
                    },
                    {
                        nombre: 'Extensor USB',
                        tipo: 'extensor',
                        jerarquia: 3,
                        cableTipo: 'usb'
                    },
                    {
                        nombre: 'Monitor IOS',
                        tipo: 'monitor',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Joystick',
                        tipo: 'control',
                        jerarquia: 2
                    }
                ]
            }
        ]
    };
}

function createJTACPuesto() {
    return {
        nombre: 'JTAC',
        tipo: 'puesto',
        jerarquia: 1,
        elementos: [
            {
                nombre: 'Servidor Host',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Tablet Rover',
                        tipo: 'tablet',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Router',
                        tipo: 'red',
                        jerarquia: 2
                    }
                ]
            },
            {
                nombre: 'Servidor Radio',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Mini PC',
                        tipo: 'computador',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Radio Maquetada',
                        tipo: 'radio',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Cascos',
                        tipo: 'audio',
                        jerarquia: 3
                    }
                ]
            },
            {
                nombre: 'Servidor Proyeccion',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Cable principal',
                        tipo: 'cable',
                        jerarquia: 2,
                        hijos: [
                            {
                                nombre: 'USB',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'usb'
                            }
                        ]
                    },
                    {
                        nombre: 'Extensor USB',
                        tipo: 'extensor',
                        jerarquia: 3,
                        cableTipo: 'usb'
                    },
                    {
                        nombre: 'DAGR',
                        tipo: 'sensor',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Puntero',
                        tipo: 'periferico',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Mando BT',
                        tipo: 'control',
                        jerarquia: 2
                    }
                ]
            },
            {
                nombre: 'Servidor LTD',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Cable principal',
                        tipo: 'cable',
                        jerarquia: 2,
                        hijos: [
                            {
                                nombre: 'Video',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'video'
                            },
                            {
                                nombre: 'USB',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'usb'
                            }
                        ]
                    },
                    {
                        nombre: 'Extensor USB',
                        tipo: 'extensor',
                        jerarquia: 3,
                        cableTipo: 'usb'
                    },
                    {
                        nombre: 'LTD',
                        tipo: 'sensor',
                        jerarquia: 2
                    }
                ]
            },
            {
                nombre: 'Servidor Moskito',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Cable principal',
                        tipo: 'cable',
                        jerarquia: 2,
                        hijos: [
                            {
                                nombre: 'Video',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'video'
                            },
                            {
                                nombre: 'USB',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'usb'
                            }
                        ]
                    },
                    {
                        nombre: 'Extensor USB',
                        tipo: 'extensor',
                        jerarquia: 3,
                        cableTipo: 'usb'
                    },
                    {
                        nombre: 'Moskito',
                        tipo: 'sensor',
                        jerarquia: 2
                    }
                ]
            },
            {
                nombre: 'Servidor Jim Compact',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Cable principal',
                        tipo: 'cable',
                        jerarquia: 2,
                        hijos: [
                            {
                                nombre: 'Video',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'video'
                            },
                            {
                                nombre: 'USB',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'usb'
                            }
                        ]
                    },
                    {
                        nombre: 'Extensor USB',
                        tipo: 'extensor',
                        jerarquia: 3,
                        cableTipo: 'usb'
                    },
                    {
                        nombre: 'Jim Compact',
                        tipo: 'sensor',
                        jerarquia: 2
                    }
                ]
            }
        ]
    };
}

function createPilotoPuesto() {
    return {
        nombre: 'Piloto',
        tipo: 'puesto',
        jerarquia: 1,
        elementos: [
            {
                nombre: 'Servidor Radio',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Mini PC',
                        tipo: 'computador',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Radio Maquetada',
                        tipo: 'radio',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Cascos',
                        tipo: 'audio',
                        jerarquia: 3
                    }
                ]
            },
            {
                nombre: 'Servidor VBS',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Palanca de Gases',
                        tipo: 'control',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Pedales',
                        tipo: 'control',
                        jerarquia: 3
                    },
                    {
                        nombre: 'Joystick HOTAS',
                        tipo: 'control',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Cable principal',
                        tipo: 'cable',
                        jerarquia: 2,
                        hijos: [
                            {
                                nombre: 'USB',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'usb'
                            }
                        ]
                    },
                    {
                        nombre: 'Extensor USB',
                        tipo: 'extensor',
                        jerarquia: 3,
                        cableTipo: 'usb'
                    },
                    {
                        nombre: 'Monitor VBS + Instrumentacion',
                        tipo: 'monitor',
                        jerarquia: 2
                    }
                ]
            },
            {
                nombre: 'Servidor IOS',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Cable principal',
                        tipo: 'cable',
                        jerarquia: 2,
                        hijos: [
                            {
                                nombre: 'Video',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'video'
                            },
                            {
                                nombre: 'USB',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'usb'
                            }
                        ]
                    },
                    {
                        nombre: 'Extensor USB',
                        tipo: 'extensor',
                        jerarquia: 2,
                        cableTipo: 'usb'
                    },
                    {
                        nombre: 'Monitor IOS',
                        tipo: 'monitor',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Teclado + Track pad',
                        tipo: 'periferico',
                        jerarquia: 2
                    }
                ]
            },
            {
                nombre: 'Servidor Rover',
                tipo: 'servidor',
                jerarquia: 2,
                componentes: [
                    {
                        nombre: 'Monitor VBS',
                        tipo: 'monitor',
                        jerarquia: 2
                    },
                    {
                        nombre: 'Cable principal',
                        tipo: 'cable',
                        jerarquia: 2,
                        hijos: [
                            {
                                nombre: 'Video',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'video'
                            },
                            {
                                nombre: 'USB',
                                tipo: 'cable',
                                jerarquia: 3,
                                cableTipo: 'usb'
                            }
                        ]
                    },
                    {
                        nombre: 'Extensor USB',
                        tipo: 'extensor',
                        jerarquia: 3,
                        cableTipo: 'usb'
                    }
                ]
            }
        ]
    };
}

function createProjectionPuesto() {
    const servidores = Array.from({ length: 8 }).map((_, index) => {
        const numero = index + 1;
        return {
            nombre: `Servidor Proyeccion ${numero}`,
            tipo: 'servidor',
            jerarquia: 2,
            componentes: [
                {
                    nombre: `Proyector ${numero}`,
                    tipo: 'proyector',
                    jerarquia: 2
                }
            ]
        };
    });

    return {
        nombre: 'Sistema de proyeccion',
        tipo: 'puesto',
        jerarquia: 1,
        elementos: servidores
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
                nombre: cleanName(item.nombre),
                tipo:
                    item.tipo != null
                        ? String(item.tipo).trim() || null
                        : null,
                jerarquia:
                    item.jerarquia != null
                        ? Number(item.jerarquia)
                        : null
            }))
            .filter(item => !Number.isNaN(item.id) && !Number.isNaN(item.domoId) && item.nombre);
    }

    if (Array.isArray(parsed.elementos)) {
        fresh.elementos = parsed.elementos
            .map(item => ({
                id: Number(item.id),
                puestoId: Number(item.puestoId ?? item.puesto_id),
                nombre: cleanName(item.nombre),
                tipo:
                    item.tipo != null
                        ? String(item.tipo).trim() || null
                        : null,
                jerarquia:
                    item.jerarquia != null
                        ? Number(item.jerarquia)
                        : null
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
                nombre: cleanName(item.nombre),
                tipo:
                    item.tipo != null
                        ? String(item.tipo).trim() || null
                        : null,
                jerarquia:
                    item.jerarquia != null
                        ? Number(item.jerarquia)
                        : null,
                cableTipo:
                    item.cableTipo != null || item.cable_tipo != null
                        ? String(item.cableTipo ?? item.cable_tipo).trim() || null
                        : null
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
                status: normalizeStatus(item.status || item.estado || 'open') || 'open',
                descripcion: cleanText(item.descripcion),
                resolucion: item.resolucion != null ? cleanText(item.resolucion) : null,
                createdAt: item.createdAt || item.created_at || new Date().toISOString(),
                updatedAt: item.updatedAt || item.updated_at || new Date().toISOString(),
                closedAt: item.closedAt || item.closed_at || null,
                fechaCierre:
                    item.fechaCierre ||
                    item.fecha_cierre ||
                    (item.closedAt || item.closed_at
                        ? String(item.closedAt ?? item.closed_at).slice(0, 10)
                        : null),
                impacto: normalizeImpact(item.impacto) || 'media',
                naturaleza: normalizeNature(item.naturaleza)
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

function getOrCreatePuesto(domoId, nombre, metadata = null) {
    const clean = cleanName(nombre);
    let record = store.puestos.find(
        item => item.domoId === domoId && sameName(item.nombre, clean)
    );
    if (record) {
        applyMetadata(record, metadata);
        return record.id;
    }
    const id = generateId('puestos');
    record = { id, domoId, nombre: clean };
    applyMetadata(record, metadata);
    store.puestos.push(record);
    return id;
}

function getOrCreateElemento(puestoId, nombre, metadata = null) {
    const clean = cleanName(nombre);
    let record = store.elementos.find(
        item => item.puestoId === puestoId && sameName(item.nombre, clean)
    );
    if (record) {
        applyMetadata(record, metadata);
        return record.id;
    }
    const id = generateId('elementos');
    record = { id, puestoId, nombre: clean };
    applyMetadata(record, metadata);
    store.elementos.push(record);
    return id;
}

function getOrCreateComponente(elementoId, nombre, parentId = null, metadata = null) {
    const clean = cleanName(nombre);
    const normalizedParent = parentId != null ? Number(parentId) : null;
    let record = store.componentes.find(
        item =>
            item.elementoId === elementoId &&
            (item.parentId ?? null) === (normalizedParent ?? null) &&
            sameName(item.nombre, clean)
    );
    if (record) {
        applyMetadata(record, metadata);
        return record.id;
    }
    const id = generateId('componentes');
    record = { id, elementoId, parentId: normalizedParent, nombre: clean };
    applyMetadata(record, metadata);
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

    const activo = componente ?? elemento ?? null;
    const diasAbierta = (() => {
        if (!record.fecha) {
            return 0;
        }
        if (record.status === 'closed' && record.fechaCierre) {
            return diffInDays(record.fecha, record.fechaCierre) ?? 0;
        }
        return diffInDays(record.fecha, new Date()) ?? 0;
    })();

    return {
        id: record.id,
        fecha: record.fecha,
        fechaCierre: record.fechaCierre ?? null,
        status: record.status,
        statusLabel: getStatusLabel(record.status),
        descripcion: record.descripcion,
        resolucion: record.resolucion,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        closedAt: record.closedAt,
        impacto: record.impacto ?? null,
        impactoLabel: record.impacto ? getImpactLabel(record.impacto) : 'Sin definir',
        naturaleza: record.naturaleza ?? null,
        naturalezaLabel: record.naturaleza ? getNatureLabel(record.naturaleza) : 'Sin definir',
        diasAbierta,
        domo: domo ? { id: domo.id, nombre: domo.nombre } : { id: record.domoId, nombre: 'No definido' },
        puesto: puesto
            ? { id: puesto.id, nombre: puesto.nombre }
            : { id: record.puestoId, nombre: 'No definido' },
        elemento: elemento
            ? { id: elemento.id, nombre: elemento.nombre }
            : { id: record.elementoId, nombre: 'No definido' },
        componenteId: record.componenteId ?? null,
        componente: componentePath,
        activo: activo
            ? {
                  tipo: activo.tipo ?? null,
                  jerarquia: activo.jerarquia ?? null,
                  cableTipo: activo.cableTipo ?? null
              }
            : null
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

function applyMetadata(record, metadata) {
    if (!record) {
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(record, 'tipo')) {
        record.tipo = null;
    }
    if (!Object.prototype.hasOwnProperty.call(record, 'jerarquia')) {
        record.jerarquia = null;
    }
    if (!Object.prototype.hasOwnProperty.call(record, 'cableTipo')) {
        record.cableTipo = null;
    }

    if (!metadata || typeof metadata !== 'object') {
        return;
    }

    if (metadata.tipo !== undefined) {
        record.tipo = metadata.tipo ?? null;
    }
    if (metadata.jerarquia !== undefined) {
        const numeric = Number(metadata.jerarquia);
        record.jerarquia = Number.isNaN(numeric) ? null : numeric;
    }
    if (metadata.cableTipo !== undefined) {
        record.cableTipo = metadata.cableTipo ?? null;
    }
}

function normalizeImpact(value) {
    if (value == null) {
        return null;
    }
    const raw = String(value).trim().toLowerCase();
    if (!raw) {
        return null;
    }
    const match = IMPACT_LEVELS.find(
        item => item.id === raw || item.label.toLowerCase() === raw
    );
    return match ? match.id : null;
}

function normalizeNature(value) {
    if (value == null) {
        return null;
    }
    const raw = String(value).trim().toLowerCase();
    if (!raw) {
        return null;
    }
    const match = NATURE_OPTIONS.find(
        item => item.id === raw || item.label.toLowerCase() === raw
    );
    return match ? match.id : null;
}

function buildClosureTimestamp(value) {
    const parsed = parseDateValue(value) ?? new Date();
    const timestamp = new Date(parsed.getTime());
    const iso = timestamp.toISOString();
    return {
        timestamp: iso,
        date: iso.slice(0, 10)
    };
}

function sanitizeCSV(value) {
    if (value == null) {
        return '';
    }
    const text = String(value).replace(/[\r\n]+/g, ' ').trim();
    if (!text) {
        return '';
    }
    const needsQuotes = text.includes(';') || text.includes('"') || text.includes(',');
    const escaped = text.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
}

function toISOWeek(value) {
    const date = parseDateValue(value);
    if (!date) {
        return null;
    }
    const working = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = working.getUTCDay() || 7;
    working.setUTCDate(working.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(working.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((working - yearStart) / 86400000 + 1) / 7);
    return `${working.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function diffInDays(start, end) {
    const startDate = parseDateValue(start);
    const endDate = parseDateValue(end);
    if (!startDate || !endDate) {
        return null;
    }
    const millis = endDate.getTime() - startDate.getTime();
    const days = Math.floor(millis / 86400000);
    return days < 0 ? 0 : days;
}

function parseDateValue(value) {
    if (value == null) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
        const fromNum = new Date(value);
        return Number.isNaN(fromNum.getTime()) ? null : fromNum;
    }

    let attempt = new Date(value);
    if (!Number.isNaN(attempt.getTime())) {
        return attempt;
    }

    if (typeof value === 'string') {
        const normalized = value.includes('T') ? value : `${value}T00:00:00`;
        attempt = new Date(normalized);
        if (!Number.isNaN(attempt.getTime())) {
            return attempt;
        }
    }

    return null;
}

function getImpactLabel(id) {
    const match = IMPACT_LEVELS.find(item => item.id === id);
    return match ? match.label : 'Sin definir';
}

function getNatureLabel(id) {
    const match = NATURE_OPTIONS.find(item => item.id === id);
    return match ? match.label : 'Sin definir';
}

function normalizeStatus(value) {
    if (value == null) {
        return null;
    }
    const raw = String(value).trim().toLowerCase();
    if (!raw) {
        return null;
    }
    const match = INCIDENT_STATUSES.find(
        item => item.id === raw || item.label.toLowerCase() === raw
    );
    return match ? match.id : null;
}

function getStatusLabel(id) {
    const match = INCIDENT_STATUSES.find(item => item.id === id);
    return match ? match.label : 'Desconocido';
}
