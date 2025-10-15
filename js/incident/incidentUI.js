/**
 * INTERFAZ DE INCIDENCIAS
 * -----------------------
 * Presenta un flujo paso a paso para registrar incidencias basado en la jerarquia:
 * Domo -> Puesto -> Elemento -> Componente/Subcomponente -> Detalle del problema.
 * Tambien ofrece un listado con acciones para cerrar, reabrir, eliminar y exportar incidencias.
 */

const TOTAL_STEPS = 5;

export class IncidentUI {
    constructor(incidentSystem) {
        this.system = incidentSystem;
        this.presenter = null;
        this.currentStep = 1;
        this.formData = {};
        this.afterRenderHook = null;
    }

    registerPresenter(presenter) {
        this.presenter = presenter;
    }

    renderIncidentsList() {
        const incidents = this.system.listIncidents();
        const stats = this.system.getStatistics();

        return `
            <div class="incident-module">
                <div class="incident-actions">
                    <button id="newIncidentButton" class="incident-btn primary">Crear incidencia</button>
                    <button id="exportIncidentsButton" class="incident-btn secondary">Exportar incidencias</button>
                </div>

                <div class="incident-stats">
                    <div class="stat-card">
                        <span class="stat-label">Total</span>
                        <span class="stat-value">${stats.total}</span>
                    </div>
                    <div class="stat-card open">
                        <span class="stat-label">Abiertas</span>
                        <span class="stat-value">${stats.abiertos}</span>
                    </div>
                    <div class="stat-card closed">
                        <span class="stat-label">Cerradas</span>
                        <span class="stat-value">${stats.cerrados}</span>
                    </div>
                </div>

                <div class="incident-table-wrapper">
                    <table class="incident-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Fecha</th>
                                <th>Domo</th>
                                <th>Puesto</th>
                                <th>Elemento</th>
                                <th>Componente</th>
                                <th>Estado</th>
                                <th>Descripcion</th>
                                <th>Resolucion</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${incidents.length ? incidents.map(incident => this.renderIncidentRow(incident)).join('') : `
                                <tr>
                                    <td colspan="10" class="incident-empty">No hay incidencias registradas.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>

                <div class="incident-extra">
                    <h3>Elementos con mas incidencias</h3>
                    <ul>
                        ${stats.porElemento.slice(0, 5).map(item => `
                            <li>${item.elemento} - ${item.total}</li>
                        `).join('') || '<li>Sin datos</li>'}
                    </ul>
                    <h3>Componentes mas afectados</h3>
                    <ul>
                        ${stats.porComponente.slice(0, 5).map(item => `
                            <li>${item.componente} - ${item.total}</li>
                        `).join('') || '<li>Sin datos</li>'}
                    </ul>
                </div>
            </div>
        `;
    }

    renderIncidentRow(incident) {
        const statusLabel = incident.status === 'open' ? 'Abierta' : 'Cerrada';
        const statusClass = incident.status === 'open' ? 'tag-open' : 'tag-closed';
        return `
            <tr data-id="${incident.id}">
                <td>${incident.id}</td>
                <td>${formatDateTime(incident.fecha)}</td>
                <td>${incident.domo.nombre}</td>
                <td>${incident.puesto.nombre}</td>
                <td>${incident.elemento.nombre}</td>
                <td>${incident.componente || 'Sin componente'}</td>
                <td><span class="status-tag ${statusClass}">${statusLabel}</span></td>
                <td>${escapeHtml(incident.descripcion)}</td>
                <td>${incident.resolucion ? escapeHtml(incident.resolucion) : '-'}</td>
                <td class="incident-actions-cell">
                    ${incident.status === 'open'
                        ? `<button class="incident-link close" data-action="close" data-id="${incident.id}">Cerrar</button>`
                        : `<button class="incident-link reopen" data-action="reopen" data-id="${incident.id}">Reabrir</button>`
                    }
                    <button class="incident-link danger" data-action="delete" data-id="${incident.id}">Eliminar</button>
                </td>
            </tr>
        `;
    }

    renderNewIncidentForm() {
        const steps = [
            { number: 1, label: 'Selecciona el domo' },
            { number: 2, label: 'Selecciona el puesto' },
            { number: 3, label: 'Selecciona el elemento organico' },
            { number: 4, label: 'Selecciona el componente afectado' },
            { number: 5, label: 'Describe el problema' }
        ];

        return `
            <div class="incident-form-container">
                <div class="incident-progress">
                    ${steps.map(step => `
                        <div class="incident-step ${step.number === this.currentStep ? 'current' : step.number < this.currentStep ? 'done' : ''}">
                            <span class="step-number">${step.number}</span>
                            <span class="step-label">${step.label}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="incident-step-content">
                    ${this.renderStepContent()}
                </div>
            </div>
        `;
    }

    renderStepContent() {
        switch (this.currentStep) {
            case 1:
                return this.renderStepDomos();
            case 2:
                return this.renderStepPuestos();
            case 3:
                return this.renderStepElementos();
            case 4:
                return this.renderStepComponentes();
            case 5:
                return this.renderStepDetalle();
            default:
                return '<p>Paso no disponible.</p>';
        }
    }

    renderStepDomos() {
        const domos = this.system.listDomos();
        const selected = this.formData.domoId ?? null;
        const options = domos.map(domo => `
            <option value="${domo.id}" ${Number(domo.id) === Number(selected) ? 'selected' : ''}>
                ${domo.nombre}
            </option>
        `).join('');

        return `
            <div class="step-panel">
                <label for="domoSelect" class="step-label">Selecciona la sala o domo</label>
                <div class="step-row">
                    <select id="domoSelect" class="step-select">
                        <option value="">-- Selecciona un domo --</option>
                        ${options}
                    </select>
                    <button id="addDomoButton" class="incident-btn secondary">Nuevo domo</button>
                </div>
                <div class="step-actions">
                    <button id="cancelWizard" class="incident-btn ghost">Cancelar</button>
                    <button id="step1Next" class="incident-btn primary" ${selected ? '' : 'disabled'}>Siguiente</button>
                </div>
            </div>
        `;
    }

    renderStepPuestos() {
        if (!this.ensureStepState('domoId')) {
            return this.renderMissingSelectionMessage('domo');
        }

        const puestos = this.system.listPuestos(this.formData.domoId);
        const selected = this.formData.puestoId ?? null;

        return `
            <div class="step-panel">
                <label for="puestoSelect" class="step-label">Selecciona el puesto</label>
                <div class="step-row">
                    <select id="puestoSelect" class="step-select">
                        <option value="">-- Selecciona un puesto --</option>
                        ${puestos.map(puesto => `
                            <option value="${puesto.id}" ${Number(puesto.id) === Number(selected) ? 'selected' : ''}>
                                ${puesto.nombre}
                            </option>
                        `).join('')}
                    </select>
                    <button id="addPuestoButton" class="incident-btn secondary">Nuevo puesto</button>
                </div>
                <div class="step-actions">
                    <button id="stepPrev" class="incident-btn ghost">Anterior</button>
                    <button id="step2Next" class="incident-btn primary" ${selected ? '' : 'disabled'}>Siguiente</button>
                </div>
            </div>
        `;
    }

    renderStepElementos() {
        if (!this.ensureStepState('puestoId')) {
            return this.renderMissingSelectionMessage('puesto');
        }

        const elementos = this.system.listElementos(this.formData.puestoId);
        const selected = this.formData.elementoId ?? null;

        return `
            <div class="step-panel">
                <label for="elementoSelect" class="step-label">Selecciona el elemento organico</label>
                <div class="step-row">
                    <select id="elementoSelect" class="step-select">
                        <option value="">-- Selecciona un elemento --</option>
                        ${elementos.map(elemento => `
                            <option value="${elemento.id}" ${Number(elemento.id) === Number(selected) ? 'selected' : ''}>
                                ${elemento.nombre}
                            </option>
                        `).join('')}
                    </select>
                    <button id="addElementoButton" class="incident-btn secondary">Nuevo elemento</button>
                </div>
                <div class="step-actions">
                    <button id="stepPrev" class="incident-btn ghost">Anterior</button>
                    <button id="step3Next" class="incident-btn primary" ${selected ? '' : 'disabled'}>Siguiente</button>
                </div>
            </div>
        `;
    }

    renderStepComponentes() {
        if (!this.ensureStepState('elementoId')) {
            return this.renderMissingSelectionMessage('elemento');
        }

        const componentes = this.system.listComponentes(this.formData.elementoId);
        const selectedParent = this.formData.componenteParentId ?? null;
        const selectedChild = this.formData.componenteId ?? null;

        const parentOptions = componentes.map(comp => `
            <option value="${comp.id}" data-has-children="${comp.hijos.length > 0}"
                ${Number(comp.id) === Number(selectedParent) ? 'selected' : ''}>
                ${comp.nombre}
            </option>
        `).join('');

        const hasSelectionWithChildren = componentes.find(comp => Number(comp.id) === Number(selectedParent) && comp.hijos.length > 0);
        const childOptions = hasSelectionWithChildren
            ? hasSelectionWithChildren.hijos.map(hijo => `
                <option value="${hijo.id}" ${Number(hijo.id) === Number(selectedChild) ? 'selected' : ''}>
                    ${hijo.nombre}
                </option>
            `).join('')
            : '';

        const ready = this.isComponentSelectionComplete(componentes);

        return `
            <div class="step-panel">
                <label for="componentParentSelect" class="step-label">Selecciona el componente afectado</label>
                <div class="step-row">
                    <select id="componentParentSelect" class="step-select">
                        <option value="">-- Selecciona un componente --</option>
                        ${parentOptions}
                    </select>
                    <button id="addComponentParentButton" class="incident-btn secondary">Nuevo componente</button>
                </div>
                <div class="step-row" id="componentChildRow" ${hasSelectionWithChildren ? '' : 'style="display:none;"'}>
                    <select id="componentChildSelect" class="step-select">
                        <option value="">-- Selecciona el tipo --</option>
                        ${childOptions}
                    </select>
                    <button id="addComponentChildButton" class="incident-btn secondary">Nuevo tipo</button>
                </div>
                <div class="step-actions">
                    <button id="stepPrev" class="incident-btn ghost">Anterior</button>
                    <button id="step4Next" class="incident-btn primary" ${ready ? '' : 'disabled'}>Siguiente</button>
                </div>
            </div>
        `;
    }

    renderStepDetalle() {
        const resumen = this.buildResumenSeleccion();
        const fecha = this.formData.fecha || getTodayISO();
        const descripcion = this.formData.descripcion || '';
        const resolucion = this.formData.resolucion || '';

        return `
            <div class="step-panel">
                <div class="summary-block">
                    <h4>Resumen de la ubicacion</h4>
                    <ul>
                        <li><strong>Domo:</strong> ${resumen.domo}</li>
                        <li><strong>Puesto:</strong> ${resumen.puesto}</li>
                        <li><strong>Elemento:</strong> ${resumen.elemento}</li>
                        <li><strong>Componente:</strong> ${resumen.componente}</li>
                    </ul>
                </div>
                <div class="form-block">
                    <div class="form-row">
                        <label>Fecha del error</label>
                        <input type="text" class="step-input" value="${fecha}" readonly>
                    </div>
                    <div class="form-row">
                        <label for="descripcionTextarea">Descripcion del problema *</label>
                        <textarea id="descripcionTextarea" class="step-textarea" rows="4" required>${descripcion}</textarea>
                    </div>
                    <div class="form-row">
                        <label for="resolucionTextarea">Resolucion (opcional, rellenar al cerrar)</label>
                        <textarea id="resolucionTextarea" class="step-textarea" rows="3">${resolucion}</textarea>
                    </div>
                </div>
                <div class="step-actions">
                    <button id="stepPrev" class="incident-btn ghost">Anterior</button>
                    <button id="saveIncidentButton" class="incident-btn primary">Guardar incidencia</button>
                </div>
            </div>
        `;
    }

    renderMissingSelectionMessage(nombrePaso) {
        return `
            <div class="step-panel">
                <p>No se ha seleccionado ${nombrePaso}. Regresa al paso anterior.</p>
                <div class="step-actions">
                    <button id="stepPrev" class="incident-btn primary">Volver</button>
                </div>
            </div>
        `;
    }

    ensureStepState(key) {
        return Boolean(this.formData[key]);
    }

    isComponentSelectionComplete(componentes) {
        if (!this.formData.componenteParentId) {
            return false;
        }
        const parent = componentes.find(comp => Number(comp.id) === Number(this.formData.componenteParentId));
        if (!parent) return false;
        if (parent.hijos.length === 0) {
            return Boolean(this.formData.componenteId && Number(this.formData.componenteId) === Number(parent.id));
        }
        return Boolean(this.formData.componenteId);
    }

    buildResumenSeleccion() {
        const domo = this.system.listDomos().find(d => Number(d.id) === Number(this.formData.domoId));
        const puestos = domo ? this.system.listPuestos(domo.id) : [];
        const puesto = puestos.find(p => Number(p.id) === Number(this.formData.puestoId));
        const elementos = puesto ? this.system.listElementos(puesto.id) : [];
        const elemento = elementos.find(e => Number(e.id) === Number(this.formData.elementoId));
        let componenteTexto = 'Sin componente';
        if (this.formData.componenteId) {
            const comp = this.system.getComponente(this.formData.componenteId);
            if (comp) {
                componenteTexto = comp.parent
                    ? `${comp.parent.nombre} / ${comp.nombre}`
                    : comp.nombre;
            }
        }

        return {
            domo: domo?.nombre || 'No definido',
            puesto: puesto?.nombre || 'No definido',
            elemento: elemento?.nombre || 'No definido',
            componente: componenteTexto
        };
    }

    // Actions ----------------------------------------------------------------

    startNewIncident() {
        this.resetForm();
        this.formData.fecha = getTodayISO();
        this.currentStep = 1;
        this.showCurrentStep();
    }

    nextStep() {
        if (this.currentStep < TOTAL_STEPS) {
            this.currentStep += 1;
            this.showCurrentStep();
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep -= 1;
            this.showCurrentStep();
        } else {
            this.showIncidentsList();
        }
    }

    cancelWizard() {
        this.resetForm();
        this.showIncidentsList();
    }

    saveIncident() {
        const descripcionEl = document.getElementById('descripcionTextarea');
        const resolucionEl = document.getElementById('resolucionTextarea');

        if (!descripcionEl) {
            alert('No se encontro el campo de descripcion.');
            return;
        }

        const descripcion = descripcionEl.value.trim();
        if (!descripcion) {
            alert('Describe el problema antes de guardar.');
            return;
        }

        const payload = {
            fecha: this.formData.fecha || getTodayISO(),
            domoId: Number(this.formData.domoId),
            puestoId: Number(this.formData.puestoId),
            elementoId: Number(this.formData.elementoId),
            componenteId: this.formData.componenteId ? Number(this.formData.componenteId) : null,
            descripcion,
            resolucion: resolucionEl ? resolucionEl.value.trim() || null : null
        };

        this.system.createIncident(payload);
        alert('Incidencia registrada correctamente.');
        this.resetForm();
        this.showIncidentsList();
    }

    closeIncident(id) {
        const resolucion = prompt('Explica el proceso de arreglo:');
        if (!resolucion || !resolucion.trim()) {
            alert('La resolucion es obligatoria para cerrar la incidencia.');
            return;
        }
        this.system.closeIncident(id, resolucion.trim());
        this.showIncidentsList();
    }

    reopenIncident(id) {
        if (!confirm('Deseas reabrir esta incidencia?')) {
            return;
        }
        this.system.reopenIncident(id);
        this.showIncidentsList();
    }

    deleteIncident(id) {
        if (!confirm('Eliminar la incidencia seleccionada?')) {
            return;
        }
        this.system.removeIncident(id);
        this.showIncidentsList();
    }

    exportData() {
        const data = this.system.exportToJSON();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `incidencias_${getTodayISO()}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    // Presentation helpers ---------------------------------------------------

    showIncidentsList() {
        const content = this.renderIncidentsList();
        this.presentContent('Incidencias', content, () => this.bindListEvents());
    }

    showCurrentStep() {
        const content = this.renderNewIncidentForm();
        this.presentContent('Nueva incidencia', content, () => this.bindStepEvents());
    }

    presentContent(title, content, afterRender) {
        if (typeof this.presenter !== 'function') {
            throw new Error('No se ha registrado un presentador de contenido para IncidentUI');
        }
        this.afterRenderHook = typeof afterRender === 'function' ? afterRender : null;
        this.presenter({
            title,
            type: 'text',
            content
        });
        if (this.afterRenderHook) {
            setTimeout(() => this.afterRenderHook?.(), 0);
        }
    }

    bindListEvents() {
        const newButton = document.getElementById('newIncidentButton');
        const exportButton = document.getElementById('exportIncidentsButton');
        const table = document.querySelector('.incident-table tbody');

        newButton?.addEventListener('click', () => this.startNewIncident());
        exportButton?.addEventListener('click', () => this.exportData());

        table?.addEventListener('click', event => {
            const target = event.target.closest('[data-action]');
            if (!target) return;
            const id = Number(target.dataset.id);
            const action = target.dataset.action;

            if (!id || !action) return;

            if (action === 'close') {
                this.closeIncident(id);
            } else if (action === 'reopen') {
                this.reopenIncident(id);
            } else if (action === 'delete') {
                this.deleteIncident(id);
            }
        });
    }

    bindStepEvents() {
        switch (this.currentStep) {
            case 1:
                this.bindStep1Events();
                break;
            case 2:
                this.bindStep2Events();
                break;
            case 3:
                this.bindStep3Events();
                break;
            case 4:
                this.bindStep4Events();
                break;
            case 5:
                this.bindStep5Events();
                break;
            default:
                break;
        }
    }

    bindStep1Events() {
        const select = document.getElementById('domoSelect');
        const addButton = document.getElementById('addDomoButton');
        const nextButton = document.getElementById('step1Next');
        const cancelButton = document.getElementById('cancelWizard');

        select?.addEventListener('change', () => {
            const value = select.value;
            this.formData.domoId = value ? Number(value) : null;
            nextButton.disabled = !this.formData.domoId;
        });

        addButton?.addEventListener('click', () => {
            const nombre = prompt('Nombre del nuevo domo:');
            if (!nombre || !nombre.trim()) {
                return;
            }
            const domo = this.system.createDomo(nombre.trim());
            this.formData.domoId = domo.id;
            this.showCurrentStep();
        });

        nextButton?.addEventListener('click', () => {
            if (!this.formData.domoId) {
                alert('Selecciona un domo para continuar.');
                return;
            }
            this.currentStep = 2;
            this.showCurrentStep();
        });

        cancelButton?.addEventListener('click', () => this.cancelWizard());
    }

    bindStep2Events() {
        const select = document.getElementById('puestoSelect');
        const addButton = document.getElementById('addPuestoButton');
        const nextButton = document.getElementById('step2Next');
        const prevButton = document.getElementById('stepPrev');

        select?.addEventListener('change', () => {
            const value = select.value;
            this.formData.puestoId = value ? Number(value) : null;
            nextButton.disabled = !this.formData.puestoId;
        });

        addButton?.addEventListener('click', () => {
            const nombre = prompt('Nombre del nuevo puesto:');
            if (!nombre || !nombre.trim()) {
                return;
            }
            const puesto = this.system.createPuesto(this.formData.domoId, nombre.trim());
            this.formData.puestoId = puesto.id;
            this.showCurrentStep();
        });

        nextButton?.addEventListener('click', () => {
            if (!this.formData.puestoId) {
                alert('Selecciona un puesto para continuar.');
                return;
            }
            this.currentStep = 3;
            this.showCurrentStep();
        });

        prevButton?.addEventListener('click', () => this.previousStep());
    }

    bindStep3Events() {
        const select = document.getElementById('elementoSelect');
        const addButton = document.getElementById('addElementoButton');
        const nextButton = document.getElementById('step3Next');
        const prevButton = document.getElementById('stepPrev');

        select?.addEventListener('change', () => {
            const value = select.value;
            this.formData.elementoId = value ? Number(value) : null;
            nextButton.disabled = !this.formData.elementoId;
            if (!this.formData.elementoId) {
                this.formData.componenteParentId = null;
                this.formData.componenteId = null;
            }
        });

        addButton?.addEventListener('click', () => {
            const nombre = prompt('Nombre del nuevo elemento:');
            if (!nombre || !nombre.trim()) {
                return;
            }
            const elemento = this.system.createElemento(this.formData.puestoId, nombre.trim());
            this.formData.elementoId = elemento.id;
            this.formData.componenteParentId = null;
            this.formData.componenteId = null;
            this.showCurrentStep();
        });

        nextButton?.addEventListener('click', () => {
            if (!this.formData.elementoId) {
                alert('Selecciona un elemento para continuar.');
                return;
            }
            this.currentStep = 4;
            this.showCurrentStep();
        });

        prevButton?.addEventListener('click', () => this.previousStep());
    }

    bindStep4Events() {
        const parentSelect = document.getElementById('componentParentSelect');
        const childRow = document.getElementById('componentChildRow');
        const childSelect = document.getElementById('componentChildSelect');
        const addParentButton = document.getElementById('addComponentParentButton');
        const addChildButton = document.getElementById('addComponentChildButton');
        const nextButton = document.getElementById('step4Next');
        const prevButton = document.getElementById('stepPrev');

        const componentes = this.system.listComponentes(this.formData.elementoId);

        parentSelect?.addEventListener('change', () => {
            const selectedId = parentSelect.value ? Number(parentSelect.value) : null;
            this.formData.componenteParentId = selectedId;

            if (!selectedId) {
                this.formData.componenteId = null;
                childRow.style.display = 'none';
                nextButton.disabled = true;
                return;
            }

            const parent = componentes.find(item => Number(item.id) === selectedId);
            if (!parent) {
                childRow.style.display = 'none';
                this.formData.componenteId = null;
                nextButton.disabled = true;
                return;
            }

            if (parent.hijos.length === 0) {
                this.formData.componenteId = selectedId;
                childRow.style.display = 'none';
                nextButton.disabled = false;
            } else {
                childRow.style.display = '';
                childSelect.innerHTML = `
                    <option value="">-- Selecciona el tipo --</option>
                    ${parent.hijos.map(hijo => `
                        <option value="${hijo.id}" ${Number(hijo.id) === Number(this.formData.componenteId) ? 'selected' : ''}>
                            ${hijo.nombre}
                        </option>
                    `).join('')}
                `;
                if (!parent.hijos.find(h => Number(h.id) === Number(this.formData.componenteId))) {
                    this.formData.componenteId = null;
                }
                nextButton.disabled = !this.formData.componenteId;
            }
        });

        childSelect?.addEventListener('change', () => {
            const selectedChild = childSelect.value ? Number(childSelect.value) : null;
            this.formData.componenteId = selectedChild;
            nextButton.disabled = !selectedChild;
        });

        addParentButton?.addEventListener('click', () => {
            const nombre = prompt('Nombre del nuevo componente:');
            if (!nombre || !nombre.trim()) {
                return;
            }
            const componente = this.system.createComponente(this.formData.elementoId, nombre.trim(), null);
            this.formData.componenteParentId = componente.id;
            this.formData.componenteId = componente.id;
            this.showCurrentStep();
        });

        addChildButton?.addEventListener('click', () => {
            if (!this.formData.componenteParentId) {
                alert('Selecciona primero el componente al que deseas añadir un tipo.');
                return;
            }
            const nombre = prompt('Nombre del nuevo tipo:');
            if (!nombre || !nombre.trim()) {
                return;
            }
            const componente = this.system.createComponente(
                this.formData.elementoId,
                nombre.trim(),
                this.formData.componenteParentId
            );
            this.formData.componenteId = componente.id;
            this.showCurrentStep();
        });

        nextButton?.addEventListener('click', () => {
            if (!this.formData.componenteId) {
                alert('Selecciona el componente afectado.');
                return;
            }
            this.currentStep = 5;
            this.showCurrentStep();
        });

        prevButton?.addEventListener('click', () => this.previousStep());

        // Inicializa estado
        parentSelect?.dispatchEvent(new Event('change'));
    }

    bindStep5Events() {
        const prevButton = document.getElementById('stepPrev');
        const saveButton = document.getElementById('saveIncidentButton');
        const descripcionEl = document.getElementById('descripcionTextarea');
        const resolucionEl = document.getElementById('resolucionTextarea');

        descripcionEl?.addEventListener('input', () => {
            this.formData.descripcion = descripcionEl.value;
        });

        resolucionEl?.addEventListener('input', () => {
            this.formData.resolucion = resolucionEl.value;
        });

        prevButton?.addEventListener('click', () => this.previousStep());
        saveButton?.addEventListener('click', () => this.saveIncident());
    }

    resetForm() {
        this.currentStep = 1;
        this.formData = {};
    }
}

// ---------------------------------------------------------------------------

function formatDateTime(value) {
    if (!value) return '-';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleString('es-ES');
    } catch {
        return value;
    }
}

function escapeHtml(text) {
    if (text == null) return '';
    return text
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getTodayISO() {
    return new Date().toISOString().split('T')[0];
}

