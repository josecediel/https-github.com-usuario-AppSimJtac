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
    exportIncidentsPayload
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

    // Incidents -------------------------------------------------------------

    createIncident(payload) {
        return createIncident(payload);
    }

    listIncidents({ status = null } = {}) {
        return listIncidentsDb({ status });
    }

    closeIncident(id, resolucion) {
        return resolveIncident(id, resolucion);
    }

    reopenIncident(id) {
        return reopenIncidentRecord(id);
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
}
