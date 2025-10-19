const STORE_KEY = 'simjtac_incidents_store_v4';
const SCHEMA_VERSION = 4;

const IMPACT_LEVELS = [
    { id: 'alta', label: 'Alta' },
    { id: 'media', label: 'Media' },
    { id: 'baja', label: 'Baja' }
];

const NATURE_OPTIONS = [
    { id: 'hardware', label: 'Hardware' },
    { id: 'software', label: 'Software' },
    { id: 'configuracion', label: 'Configuracion' },
    { id: 'obsolescencia', label: 'Obsolescencia' },
    { id: 'uso_indebido', label: 'Uso indebido' },
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
            finFlujo: Boolean(parent.finFlujo),
            nota: parent.nota ?? null,
            hijos: store.componentes
                .filter(child => child.parentId === parent.id)
                .slice()
                .sort(sortByName)
                .map(child => ({
                    id: child.id,
                    nombre: child.nombre,
                    tipo: child.tipo ?? null,
                    jerarquia: child.jerarquia ?? null,
                    cableTipo: child.cableTipo ?? null,
                    finFlujo: Boolean(child.finFlujo),
                    nota: child.nota ?? null
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
        finFlujo: Boolean(record.finFlujo),
        nota: record.nota ?? null,
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
        naturaleza: null,
        recurrente: false,
        tiempoResolucion: null
    };

    store.incidentes.push(record);
    recalcRecurrenceForKey(getRecurrenceKey(record));
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
        naturaleza: options.naturaleza ?? options.filters?.naturaleza ?? null,
        recurrente: options.recurrente ?? options.filters?.recurrente ?? null,
        fechaDesde: options.fechaDesde ?? options.filters?.fechaDesde ?? null,
        fechaHasta: options.fechaHasta ?? options.filters?.fechaHasta ?? null,
        fechaCierreDesde: options.fechaCierreDesde ?? options.filters?.fechaCierreDesde ?? null,
        fechaCierreHasta: options.fechaCierreHasta ?? options.filters?.fechaCierreHasta ?? null,
        search: options.search ?? options.filters?.search ?? null
    };

    const normalizedStatus = filters.status ? normalizeStatus(filters.status) : null;
    const normalizedNature =
        filters.naturaleza && filters.naturaleza !== 'sin_definir'
            ? normalizeNature(filters.naturaleza)
            : null;
    const natureFilter =
        filters.naturaleza === 'sin_definir' ? 'sin_definir' : normalizedNature;
    const searchTerm = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : '';
    const recurrentFilter =
        filters.recurrente === true ||
        filters.recurrente === 'true' ||
        filters.recurrente === 'yes'
            ? true
            : filters.recurrente === false ||
                    filters.recurrente === 'false' ||
                    filters.recurrente === 'no'
                ? false
                : null;
    const fechaDesde = filters.fechaDesde ? parseDateValue(filters.fechaDesde) : null;
    const fechaHasta = filters.fechaHasta ? parseDateValue(filters.fechaHasta) : null;
    const cierreDesde = filters.fechaCierreDesde ? parseDateValue(filters.fechaCierreDesde) : null;
    const cierreHasta = filters.fechaCierreHasta ? parseDateValue(filters.fechaCierreHasta) : null;

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
            if (natureFilter) {
                if (natureFilter === 'sin_definir') {
                    if (record.naturaleza != null) {
                        return false;
                    }
                } else if (record.naturaleza !== natureFilter) {
                    return false;
                }
            }
            if (recurrentFilter !== null) {
                const isRecurrent = Boolean(record.recurrente);
                if (recurrentFilter !== isRecurrent) {
                    return false;
                }
            }
            if (fechaDesde || fechaHasta) {
                const apertura = parseDateValue(record.fecha);
                if (!apertura) {
                    return false;
                }
                if (fechaDesde && apertura.getTime() < fechaDesde.getTime()) {
                    return false;
                }
                if (fechaHasta && apertura.getTime() > fechaHasta.getTime()) {
                    return false;
                }
            }
            if (cierreDesde || cierreHasta) {
                if (!record.fechaCierre) {
                    return false;
                }
                const cierre = parseDateValue(record.fechaCierre);
                if (!cierre) {
                    return false;
                }
                if (cierreDesde && cierre.getTime() < cierreDesde.getTime()) {
                    return false;
                }
                if (cierreHasta && cierre.getTime() > cierreHasta.getTime()) {
                    return false;
                }
            }
            if (searchTerm) {
                const componenteRecord = record.componenteId ? getComponentRecord(record.componenteId) : null;
                const componenteParent = componenteRecord && componenteRecord.parentId ? getComponentRecord(componenteRecord.parentId) : null;
                const haystack = [
                    String(record.id),
                    record.descripcion,
                    record.resolucion,
                    getDomoRecord(record.domoId)?.nombre,
                    getPuestoRecord(record.puestoId)?.nombre,
                    getElementoRecord(record.elementoId)?.nombre,
                    componenteParent?.nombre,
                    componenteRecord?.nombre
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

    const previousKey = getRecurrenceKey(record);

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
    const resolutionDays = diffInDays(record.fecha, closure.date);
    record.tiempoResolucion = resolutionDays != null ? resolutionDays : null;
    const newKey = getRecurrenceKey(record);
    recalcRecurrenceForKey(previousKey);
    recalcRecurrenceForKey(newKey);
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
    const previousKey = getRecurrenceKey(record);
    record.status = 'open';
    record.resolucion = null;
    record.naturaleza = null;
    record.closedAt = null;
    record.fechaCierre = null;
    record.componenteId = null;
    record.recurrente = false;
    record.tiempoResolucion = null;
    record.updatedAt = new Date().toISOString();
    const newKey = getRecurrenceKey(record);
    recalcRecurrenceForKey(previousKey);
    recalcRecurrenceForKey(newKey);
    saveStore();
    return mapIncident(record);
}

export function deleteIncident(id) {
    const index = findIncidentIndex(id);
    if (index === -1) {
        return;
    }
    const record = store.incidentes[index];
    const key = record ? getRecurrenceKey(record) : null;
    store.incidentes.splice(index, 1);
    recalcRecurrenceForKey(key);
    saveStore();
}

export function getIncidentStatistics(filters = null) {
    const incidents = listIncidents(filters ?? {});
    const total = incidents.length;
    const statusMap = new Map();
    const elementoMap = new Map();
    const componenteMap = new Map();
    const impactMap = new Map();
    const natureMap = new Map();
    const weekMap = new Map();
    const dailyOpen = new Map();
    const dailyClosed = new Map();
    const openDurations = [];
    const elementClosureMap = new Map();
    const natureClosureMap = new Map();
    let mttrTotalSum = 0;
    let mttrTotalCount = 0;
    const now = new Date();

    incidents.forEach(incident => {
        statusMap.set(incident.status, (statusMap.get(incident.status) || 0) + 1);

        const elementoNombre = incident.elemento?.nombre ?? 'No definido';
        elementoMap.set(elementoNombre, (elementoMap.get(elementoNombre) || 0) + 1);

        const componenteNombre = incident.componente ?? 'Sin componente';
        componenteMap.set(componenteNombre, (componenteMap.get(componenteNombre) || 0) + 1);

        const impactKey = incident.impacto ?? 'sin_definir';
        impactMap.set(impactKey, (impactMap.get(impactKey) || 0) + 1);

        const natureKey = incident.naturaleza ?? 'sin_definir';
        natureMap.set(natureKey, (natureMap.get(natureKey) || 0) + 1);

        const weekKey = toISOWeek(incident.fecha);
        if (weekKey) {
            weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
        }

        const apertura = (incident.fecha ?? '').slice(0, 10);
        if (apertura) {
            dailyOpen.set(apertura, (dailyOpen.get(apertura) || 0) + 1);
        }

        if (incident.status === 'closed' && incident.fechaCierre) {
            const cierre = incident.fechaCierre.slice(0, 10);
            if (cierre) {
                dailyClosed.set(cierre, (dailyClosed.get(cierre) || 0) + 1);
            }
            const dias =
                incident.tiempoResolucion != null
                    ? incident.tiempoResolucion
                    : diffInDays(incident.fecha, incident.fechaCierre);
            if (dias != null) {
                const elementoId = incident.elemento?.id ?? incident.elementoId ?? elementoNombre;
                const elementEntry = elementClosureMap.get(elementoId) || {
                    elementoId,
                    elemento: elementoNombre,
                    totalDias: 0,
                    total: 0
                };
                elementEntry.totalDias += dias;
                elementEntry.total += 1;
                elementClosureMap.set(elementoId, elementEntry);

                const natureEntry = natureClosureMap.get(natureKey) || { total: 0, count: 0 };
                natureEntry.total += dias;
                natureEntry.count += 1;
                natureClosureMap.set(natureKey, natureEntry);

                mttrTotalSum += dias;
                mttrTotalCount += 1;
            }
        } else {
            const dias = diffInDays(incident.fecha, now);
            if (dias != null) {
                openDurations.push({
                    id: incident.id,
                    dias,
                    impacto: incident.impacto ?? null,
                    status: incident.status,
                    domo: incident.domo?.nombre ?? 'No definido',
                    puesto: incident.puesto?.nombre ?? 'No definido',
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

    const aging = {
        le7: openDurations.filter(item => item.dias <= 7).length,
        between8And30: openDurations.filter(item => item.dias >= 8 && item.dias <= 30).length,
        gt30: openDurations.filter(item => item.dias > 30).length
    };

    const abiertasVsCerradas = [
        {
            label: 'Abiertas',
            total: (statusMap.get('open') || 0) + (statusMap.get('in_progress') || 0)
        },
        {
            label: 'Cerradas',
            total: statusMap.get('closed') || 0
        }
    ];

    const fechasCombinadas = Array.from(
        new Set([...dailyOpen.keys(), ...dailyClosed.keys()])
    ).sort((a, b) => a.localeCompare(b));

    const porFecha = fechasCombinadas.slice(-30).map(fecha => ({
        fecha,
        abiertas: dailyOpen.get(fecha) || 0,
        cerradas: dailyClosed.get(fecha) || 0
    }));

    const mttrGeneral =
        mttrTotalCount > 0 ? Math.round((mttrTotalSum / mttrTotalCount) * 10) / 10 : null;

    const mttrPorNaturaleza = Array.from(natureClosureMap.entries())
        .map(([nature, data]) => ({
            naturaleza: nature,
            label: nature === 'sin_definir' ? 'Sin definir' : getNatureLabel(nature),
            promedio: Math.round((data.total / data.count) * 10) / 10,
            total: data.count
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
        porFecha,
        abiertasVsCerradas,
        aging,
        tiempos: {
            abiertas: abiertasOrdenadas,
            elementos: tiemposPorElemento
        },
        mttr: {
            general: mttrGeneral,
            porNaturaleza: mttrPorNaturaleza
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

export function exportIncidentsPayload(filters = null) {
    const params = filters && typeof filters === 'object' ? { ...filters } : null;
    const incidents = listIncidents(filters ?? {});
    const payload = {
        generatedAt: new Date().toISOString(),
        total: incidents.length,
        filters: params,
        incidents,
        statistics: getIncidentStatistics(filters ?? {})
    };
    return JSON.stringify(payload, null, 2);
}

export function exportIncidentsCSV(filters = null) {
    const incidents = listIncidents(filters ?? {});
    const rows = [
        [
            'id',
            'fecha_apertura',
            'fecha_cierre',
            'estado',
            'estado_label',
            'impacto',
            'impacto_label',
            'naturaleza',
            'naturaleza_label',
            'domo',
            'puesto',
            'elemento',
            'componente',
            'ruta',
            'descripcion',
            'resolucion',
            'recurrente',
            'tiempo_resolucion_dias'
        ].join(';')
    ];

    incidents.forEach(incident => {
        const domoNombre = incident.domo?.nombre ?? '';
        const puestoNombre = incident.puesto?.nombre ?? '';
        const elementoNombre = incident.elemento?.nombre ?? '';
        const componenteNombre = incident.componente ?? '';

        rows.push(
            [
                incident.id,
                incident.fecha,
                incident.fechaCierre ?? '',
                sanitizeCSV(incident.status ?? ''),
                sanitizeCSV(incident.statusLabel ?? ''),
                sanitizeCSV(incident.impacto ?? ''),
                sanitizeCSV(incident.impactoLabel ?? ''),
                sanitizeCSV(incident.naturaleza ?? ''),
                sanitizeCSV(incident.naturalezaLabel ?? ''),
                sanitizeCSV(domoNombre),
                sanitizeCSV(puestoNombre),
                sanitizeCSV(elementoNombre),
                sanitizeCSV(componenteNombre),
                sanitizeCSV(incident.ruta ?? ''),
                sanitizeCSV(incident.descripcion),
                sanitizeCSV(incident.resolucion ?? ''),
                incident.recurrente ? 'SI' : 'NO',
                incident.tiempoResolucion ?? ''
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
        const domoId = getOrCreateDomo(domo.nombre, extractMetadata(domo));
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
    if (node.finFlujo !== undefined) {
        meta.finFlujo = node.finFlujo;
    }
    if (node.nota !== undefined) {
        meta.nota = node.nota;
    }
    return Object.keys(meta).length ? meta : null;
}

const FIN_FLOW_NOTE = 'Fin de flujo';

function createBaseStructure() {
    return ['Domo 1', 'Domo 2'].map(nombre => ({
        nombre,
        tipo: 'sala',
        puestos: [createInstructorPuesto(), createJTACPuesto(), createPilotoPuesto()]
    }));
}

function createInstructorPuesto() {
    return puesto('Puesto Instructor', [
        element('Servidor VBS', 'servidor', [
            comp('Cable HDMI', 'cable', {
                cableTipo: 'hdmi',
                hijos: [terminal('Monitor VBS', 'monitor')]
            }),
            comp('Cable Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Extensor USB', 'extensor', {
                        hijos: [
                            comp('Cable USB', 'cable', {
                                cableTipo: 'usb',
                                hijos: [terminal('Joystick USB', 'periferico')]
                            })
                        ]
                    })
                ]
            })
        ]),
        element('Servidor IOS', 'servidor', [
            comp('Cable HDMI', 'cable', {
                cableTipo: 'hdmi',
                hijos: [terminal('Monitor IOS', 'monitor')]
            }),
            comp('Cable Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Extensor USB', 'extensor', {
                        hijos: [
                            terminal('Teclado USB', 'periferico'),
                            terminal('Raton USB', 'periferico')
                        ]
                    })
                ]
            })
        ])
    ]);
}

function createJTACPuesto() {
    return puesto('Puesto JTAC', [
        element('Servidor Sensor', 'servidor', [
            comp('Cable Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Router Wi-Fi', 'router', {
                        hijos: [terminal('Tablet Sensor', 'tablet')]
                    })
                ]
            })
        ]),
        element('Servidor Radio', 'servidor', [
            comp('Cable Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Switch', 'switch', {
                        hijos: [
                            comp('Mini PC', 'computador', {
                                hijos: [
                                    comp('Cable USB', 'cable', {
                                        cableTipo: 'usb',
                                        hijos: [
                                            comp('Radio maquetada', 'radio', {
                                                hijos: [terminal('Audifonos', 'audio')]
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]),
        element('Servidor JTAC Simulator', 'servidor', [
            comp('Cable Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Extensor USB', 'extensor', {
                        hijos: [
                            comp('Cable USB Puntero', 'cable', {
                                cableTipo: 'usb',
                                hijos: [terminal('Puntero', 'periferico')]
                            }),
                            comp('Cable USB DAGR', 'cable', {
                                cableTipo: 'usb',
                                hijos: [terminal('DAGR', 'sensor')]
                            }),
                            comp('Conexion Bluetooth', 'conexion', {
                                hijos: [terminal('Mando BT', 'control')]
                            })
                        ]
                    })
                ]
            })
        ]),
        element('Servidor LTD', 'servidor', [
            comp('Cable HDMI Fibra', 'cable', {
                cableTipo: 'hdmi_fibra',
                hijos: [terminal('LTD - Video', 'sensor')]
            }),
            comp('Cable Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Extensor USB', 'extensor', {
                        hijos: [
                            comp('Cable USB', 'cable', {
                                cableTipo: 'usb',
                                hijos: [terminal('LTD - Control', 'sensor')]
                            })
                        ]
                    })
                ]
            })
        ]),
        element('Servidor Moskito', 'servidor', [
            comp('Cable HDMI Fibra', 'cable', {
                cableTipo: 'hdmi_fibra',
                hijos: [terminal('Moskito - Video', 'sensor')]
            }),
            comp('Cable Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Extensor USB', 'extensor', {
                        hijos: [
                            comp('Cable USB', 'cable', {
                                cableTipo: 'usb',
                                hijos: [terminal('Moskito - Control', 'sensor')]
                            })
                        ]
                    })
                ]
            })
        ]),
        element('Servidor Jim Compact', 'servidor', [
            comp('Cable HDMI Fibra', 'cable', {
                cableTipo: 'hdmi_fibra',
                hijos: [terminal('Jim compact - Video', 'sensor')]
            }),
            comp('Cable Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Extensor USB', 'extensor', {
                        hijos: [
                            comp('Cable USB', 'cable', {
                                cableTipo: 'usb',
                                hijos: [terminal('Jim compact - Control', 'sensor')]
                            })
                        ]
                    })
                ]
            })
        ]),
        element('Sistema de proyeccion', 'sistema', buildProjectionComponents())
    ]);
}

function createPilotoPuesto() {
    return puesto('Puesto Piloto', [
        element('Servidor Radio', 'servidor', [
            comp('Cable Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Switch', 'switch', {
                        hijos: [
                            comp('Mini PC', 'computador', {
                                hijos: [
                                    comp('Cable USB', 'cable', {
                                        cableTipo: 'usb',
                                        hijos: [
                                            comp('Radio maquetada', 'radio', {
                                                hijos: [terminal('Audifonos', 'audio')]
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]),
        element('Servidor VBS', 'servidor', [
            comp('Cable Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Extensor USB', 'extensor', {
                        hijos: [
                            comp('Cable USB Palanca', 'cable', {
                                cableTipo: 'usb',
                                hijos: [terminal('Palanca de gases', 'control')]
                            }),
                            comp('Cable USB Pedales', 'cable', {
                                cableTipo: 'usb',
                                hijos: [terminal('Pedales', 'control')]
                            }),
                            comp('Cable USB Joystick', 'cable', {
                                cableTipo: 'usb',
                                hijos: [terminal('Joystick HOTAS', 'control')]
                            }),
                            comp('Cable USB Instrumentacion', 'cable', {
                                cableTipo: 'usb',
                                hijos: [terminal('Monitor Instrumentacion Tactil (USB)', 'monitor')]
                            })
                        ]
                    })
                ]
            }),
            comp('Cable HDMI Fibra', 'cable', {
                cableTipo: 'hdmi_fibra',
                hijos: [terminal('Monitor VBS', 'monitor')]
            }),
            comp('Cable HDMI', 'cable', {
                cableTipo: 'hdmi',
                hijos: [terminal('Monitor Instrumentacion Tactil (HDMI)', 'monitor')]
            })
        ]),
        element('Servidor IOS', 'servidor', [
            comp('Cable de Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Extensor USB', 'extensor', {
                        hijos: [
                            comp('USB inalambrico', 'periferico', {
                                hijos: [
                                    terminal('Teclado con trackpad', 'periferico'),
                                    terminal('Teclado numerico', 'periferico')
                                ]
                            })
                        ]
                    })
                ]
            }),
            comp('Cable HDMI Fibra', 'cable', {
                cableTipo: 'hdmi_fibra',
                hijos: [terminal('Monitor IOS Tactil', 'monitor')]
            })
        ]),
        element('Servidor Sensor', 'servidor', [
            comp('Cable Red', 'cable', {
                cableTipo: 'red',
                hijos: [
                    comp('Extensor USB', 'extensor', {
                        hijos: [
                            comp('Cable USB', 'cable', {
                                cableTipo: 'usb',
                                hijos: [terminal('Monitor Sensor Tactil (USB)', 'monitor')]
                            })
                        ]
                    })
                ]
            }),
            comp('Cable HDMI Fibra', 'cable', {
                cableTipo: 'hdmi_fibra',
                hijos: [terminal('Monitor Sensor Tactil (HDMI)', 'monitor')]
            })
        ])
    ]);
}

function puesto(nombre, elementos, extra = {}) {
    return {
        nombre,
        tipo: 'puesto',
        jerarquia: 1,
        ...extra,
        elementos
    };
}

function element(nombre, tipo, componentes = [], extra = {}) {
    return {
        nombre,
        tipo,
        jerarquia: 2,
        ...extra,
        componentes
    };
}

function comp(nombre, tipo, options = {}) {
    const {
        hijos = [],
        jerarquia = null,
        cableTipo = null,
        finFlujo = false,
        nota = null
    } = options;
    const node = { nombre, tipo };
    if (jerarquia != null) {
        node.jerarquia = jerarquia;
    }
    if (cableTipo != null) {
        node.cableTipo = cableTipo;
    }
    if (finFlujo) {
        node.finFlujo = true;
    }
    if (nota) {
        node.nota = nota;
    }
    if (hijos.length) {
        node.hijos = hijos;
    }
    return node;
}

function terminal(nombre, tipo, options = {}) {
    const { nota = FIN_FLOW_NOTE, ...rest } = options;
    return comp(nombre, tipo, { ...rest, finFlujo: true, nota });
}

function buildProjectionComponents() {
    const servidores = Array.from({ length: 8 }).map((_, index) => {
        const numero = index + 1;
        return comp(`Servidor Proyeccion ${numero}`, 'servidor', {
            hijos: [
                comp('Cable DisplayPort fibra', 'cable', {
                    cableTipo: 'displayport_fibra',
                    hijos: [terminal(`Proyector ${numero}`, 'proyector')]
                })
            ]
        });
    });

    servidores.push(
        comp('Servidor Sincronismo', 'servidor', {
            hijos: [
                comp('Cable HDMI', 'cable', {
                    cableTipo: 'hdmi',
                    hijos: [
                        comp('Convertidor HDMI-Audio', 'convertidor', {
                            hijos: [
                                comp('Amplificador', 'audio', {
                                    hijos: [terminal('Altavoces sala', 'audio')]
                                })
                            ]
                        })
                    ]
                })
            ]
        })
    );

    return servidores;
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
                        : null,
                finFlujo: Boolean(item.finFlujo ?? item.fin_flujo ?? false),
                nota:
                    item.nota != null || item.note != null
                        ? String(item.nota ?? item.note).trim() || null
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
                naturaleza: normalizeNature(item.naturaleza),
                recurrente:
                    item.recurrente === true ||
                    item.recurrente === 'true' ||
                    item.recurrente === 1 ||
                    item.recurrente === '1',
                tiempoResolucion: (() => {
                    const raw = item.tiempoResolucion ?? item.tiempo_resolucion;
                    if (raw == null || raw === '') {
                        return null;
                    }
                    const numeric = Number(raw);
                    return Number.isNaN(numeric) ? null : numeric;
                })()
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

function getOrCreateDomo(nombre, metadata = null) {
    const clean = cleanName(nombre);
    let record = store.domos.find(item => sameName(item.nombre, clean));
    if (record) {
        applyMetadata(record, metadata);
        return record.id;
    }
    const id = generateId('domos');
    record = { id, nombre: clean };
    applyMetadata(record, metadata);
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

    const ruta = [
        domo?.nombre ?? null,
        puesto?.nombre ?? null,
        elemento?.nombre ?? null,
        componentePath
    ]
        .filter(Boolean)
        .join(' / ');

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
        ruta,
        activo: activo
            ? {
                  tipo: activo.tipo ?? null,
                  jerarquia: activo.jerarquia ?? null,
                  cableTipo: activo.cableTipo ?? null,
                  finFlujo: Boolean(activo.finFlujo),
                  nota: activo.nota ?? null
              }
            : null,
        tiempoResolucion: record.tiempoResolucion ?? null,
        recurrente: Boolean(record.recurrente),
        relacionadas: getRelatedIncidents(record)
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
    if (!Object.prototype.hasOwnProperty.call(record, 'finFlujo')) {
        record.finFlujo = false;
    }
    if (!Object.prototype.hasOwnProperty.call(record, 'nota')) {
        record.nota = null;
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
    if (metadata.finFlujo !== undefined) {
        record.finFlujo = Boolean(metadata.finFlujo);
    }
    if (metadata.nota !== undefined) {
        record.nota = metadata.nota ?? null;
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

function daysBetweenDates(a, b) {
    const first = parseDateValue(a);
    const second = parseDateValue(b);
    if (!first || !second) {
        return null;
    }
    const diff = Math.abs(second.getTime() - first.getTime());
    return Math.floor(diff / 86400000);
}

function getRecurrenceKey(record) {
    if (!record) {
        return null;
    }
    const puestoId = Number(record.puestoId ?? record.puesto?.id);
    const elementoId = Number(record.elementoId ?? record.elemento?.id);
    if (Number.isNaN(puestoId) || Number.isNaN(elementoId)) {
        return null;
    }
    const componenteId =
        record.componenteId != null ? Number(record.componenteId) : null;
    const componentKey =
        componenteId != null && !Number.isNaN(componenteId)
            ? `C${componenteId}`
            : `E${elementoId}`;
    return `${puestoId}|${componentKey}`;
}

function recalcRecurrenceForKey(key) {
    if (!key) {
        return;
    }
    const incidents = store.incidentes.filter(item => getRecurrenceKey(item) === key);
    if (!incidents.length) {
        return;
    }
    incidents.forEach(item => {
        const window30 = incidents.filter(other => {
            const diff = daysBetweenDates(item.fecha, other.fecha);
            return diff != null && diff <= 30;
        });
        const window7 = incidents.filter(other => {
            const diff = daysBetweenDates(item.fecha, other.fecha);
            return diff != null && diff <= 7;
        });
        item.recurrente = window30.length >= 3 || window7.length >= 2;
    });
}

function getRelatedIncidents(record) {
    const key = getRecurrenceKey(record);
    if (!key) {
        return [];
    }
    return store.incidentes
        .filter(item => item.id !== record.id && getRecurrenceKey(item) === key)
        .filter(item => {
            const diff = daysBetweenDates(record.fecha, item.fecha);
            return diff != null && diff <= 30;
        })
        .sort((a, b) => {
            const dateA = parseDateValue(a.fecha) ?? new Date(0);
            const dateB = parseDateValue(b.fecha) ?? new Date(0);
            return dateB.getTime() - dateA.getTime();
        })
        .map(item => item.id);
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
