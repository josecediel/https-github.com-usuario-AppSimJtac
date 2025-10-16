/**
 * MOTOR DE INCIDENCIAS BASADO EN SQLITE
 * -------------------------------------
 * Provee acceso de alto nivel al arbol jerarquico (domo -> puesto -> elemento -> componente)
 * y gestiona el ciclo de vida de las incidencias (crear, cerrar, reabrir, eliminar).
 */

import {
    getDomos,
    addDomo,
    getPuestosByDomo,
    addPuesto,
    getElementosByPuesto,
    addElemento,
    getComponentesByElemento,
    addComponente,
    getComponenteById,
    createIncident,
    listIncidents as listIncidentsDb,
    resolveIncident,
    reopenIncident as reopenIncidentRecord,
    deleteIncident,
    getIncidentStatistics,
    exportIncidentsPayload,
    exportIncidentsCSV,
    getImpactLevels,
    getNatureOptions as getNatureOptionsDb,
    updateIncidentDetails,
    setIncidentStatus as setIncidentStatusDb,
    getIncidentStatuses as getIncidentStatusesDb
} from '../../db.js';

export class IncidentSystem {
    init() {
        // Inicializacion no requerida: la base se prepara en initDB()
    }

    // Hierarchy -------------------------------------------------------------

    listDomos() {
        return getDomos();
    }

    createDomo(nombre) {
        return addDomo(nombre);
    }

    listPuestos(domoId) {
        return getPuestosByDomo(domoId);
    }

    createPuesto(domoId, nombre) {
        return addPuesto(domoId, nombre);
    }

    listElementos(puestoId) {
        return getElementosByPuesto(puestoId);
    }

    createElemento(puestoId, nombre) {
        return addElemento(puestoId, nombre);
    }

    listComponentes(elementoId) {
        return getComponentesByElemento(elementoId);
    }

    createComponente(elementoId, nombre, parentId = null) {
        return addComponente(elementoId, nombre, parentId);
    }

    getComponente(componentId) {
        return getComponenteById(componentId);
    }

    getImpactOptions() {
        return getImpactLevels();
    }

    getNatureOptions() {
        return getNatureOptionsDb();
    }

    getStatusOptions() {
        return getIncidentStatusesDb();
    }

    getIncident(id) {
        const numeric = Number(id);
        if (Number.isNaN(numeric)) {
            return null;
        }
        return listIncidentsDb().find(item => item.id === numeric) ?? null;
    }

    // Incidents -------------------------------------------------------------

    createIncident(payload) {
        return createIncident(payload);
    }

    listIncidents({ status = null, domoId = null, puestoId = null, elementoId = null, impacto = null, search = null } = {}) {
        return listIncidentsDb({ status, domoId, puestoId, elementoId, impacto, search });
    }

    closeIncident(id, payload) {
        return resolveIncident(id, payload);
    }

    reopenIncident(id) {
        return reopenIncidentRecord(id);
    }

    updateIncident(id, payload) {
        return updateIncidentDetails(id, payload);
    }

    setIncidentStatus(id, status) {
        return setIncidentStatusDb(id, status);
    }

    removeIncident(id) {
        deleteIncident(id);
    }

    getStatistics() {
        return getIncidentStatistics();
    }

    exportToJSON() {
        return exportIncidentsPayload();
    }

    exportToCSV() {
        return exportIncidentsCSV();
    }
}
