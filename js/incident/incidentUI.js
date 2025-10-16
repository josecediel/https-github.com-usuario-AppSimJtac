/**
 * INTERFAZ DE INCIDENCIAS
 * -----------------------
 * Presenta un flujo paso a paso para registrar incidencias basado en la jerarquia:
 * Domo -> Puesto -> Elemento -> Detalle del problema e impacto.
 * Tambien ofrece un listado con acciones para cerrar, reabrir, eliminar y exportar incidencias.
 */

const TOTAL_STEPS = 4;

export class IncidentUI {
    constructor(incidentSystem) {
        this.system = incidentSystem;
        this.presenter = null;
        this.currentStep = 1;
        this.formData = {};
        this.afterRenderHook = null;
        this.impactOptions = incidentSystem.getImpactOptions ? incidentSystem.getImpactOptions() : [];
        this.natureOptions = incidentSystem.getNatureOptions ? incidentSystem.getNatureOptions() : [];
        this.statusOptions = incidentSystem.getStatusOptions ? incidentSystem.getStatusOptions() : [];
        this.impactMap = new Map(this.impactOptions.map(option => [option.id, option.label]));
        this.natureMap = new Map(this.natureOptions.map(option => [option.id, option.label]));
        this.statusMap = new Map(this.statusOptions.map(option => [option.id, option.label]));
        this.filters = {
            status: 'all',
            domoId: '',
            puestoId: '',
            impacto: '',
            search: ''
        };
        this.closeModalState = null;
        this.searchDebounce = null;
    }

    registerPresenter(presenter) {
        this.presenter = presenter;
    }

    renderIncidentsList() {
        const filterState = this.filters || {};
        const query = {
            status: filterState.status && filterState.status !== 'all' ? filterState.status : null,
            domoId: filterState.domoId ? Number(filterState.domoId) : null,
            puestoId: filterState.puestoId ? Number(filterState.puestoId) : null,
            impacto: filterState.impacto || null,
            search: filterState.search || null
        };

        const incidents = this.system.listIncidents(query);
        const stats = this.system.getStatistics();
        const domos = this.system.listDomos();
        const puestos = filterState.domoId
            ? this.system.listPuestos(Number(filterState.domoId))
            : [];

        const statusOptions = [
            `<option value="all"${filterState.status === 'all' ? ' selected' : ''}>Todos</option>`,
            ...this.statusOptions.map(option => `<option value="${option.id}"${option.id === filterState.status ? ' selected' : ''}>${option.label}</option>`)
        ].join('');

        const domoOptions = [
            `<option value=""${!filterState.domoId ? ' selected' : ''}>Todos</option>`,
            ...domos.map(domo => `<option value="${domo.id}"${Number(filterState.domoId) === Number(domo.id) ? ' selected' : ''}>${escapeHtml(domo.nombre)}</option>`)
        ].join('');

        const puestoOptions = [
            `<option value=""${!filterState.puestoId ? ' selected' : ''}>Todos</option>`,
            ...puestos.map(puesto => `<option value="${puesto.id}"${Number(filterState.puestoId) === Number(puesto.id) ? ' selected' : ''}>${escapeHtml(puesto.nombre)}</option>`)
        ].join('');

        const impactoOptions = [
            `<option value=""${!filterState.impacto ? ' selected' : ''}>Todos</option>`,
            ...this.impactOptions.map(option => `<option value="${option.id}"${option.id === filterState.impacto ? ' selected' : ''}>${option.label}</option>`)
        ].join('');

        return `
            <div class="incident-module">
                <div class="incident-filters">
                    <div class="filter-field">
                        <label for="filterStatus">Estado</label>
                        <select id="filterStatus" class="filter-select">${statusOptions}</select>
                    </div>
                    <div class="filter-field">
                        <label for="filterDomo">Domo</label>
                        <select id="filterDomo" class="filter-select">${domoOptions}</select>
                    </div>
                    <div class="filter-field">
                        <label for="filterPuesto">Puesto</label>
                        <select id="filterPuesto" class="filter-select" ${filterState.domoId ? '' : 'disabled'}>${puestoOptions}</select>
                    </div>
                    <div class="filter-field">
                        <label for="filterImpacto">Impacto</label>
                        <select id="filterImpacto" class="filter-select">${impactoOptions}</select>
                    </div>
                    <div class="filter-field filter-search">
                        <label for="filterSearch">Buscar</label>
                        <input id="filterSearch" type="search" class="filter-input" placeholder="Descripcion, domo, elemento..." value="${escapeHtml(filterState.search || '')}">
                    </div>
                    <div class="filter-actions">
                        <button id="clearFiltersButton" class="incident-btn ghost">Limpiar filtros</button>
                    </div>
                </div>

                <div class="incident-actions">
                    <button id="newIncidentButton" class="incident-btn primary">Crear incidencia</button>
                    <button id="exportIncidentsJsonButton" class="incident-btn secondary">Exportar JSON</button>
                    <button id="exportIncidentsCsvButton" class="incident-btn secondary">Exportar CSV</button>
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
                    <div class="stat-card progress">
                        <span class="stat-label">En curso</span>
                        <span class="stat-value">${stats.enCurso}</span>
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
                                <th>Impacto</th>
                                <th>Estado</th>
                                <th>Fecha cierre</th>
                                <th>Naturaleza</th>
                                <th>Dias abiertas</th>
                                <th>Descripcion</th>
                                <th>Resolucion</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${incidents.length ? incidents.map(incident => this.renderIncidentRow(incident)).join('') : `
                                <tr>
                                    <td colspan="14" class="incident-empty">No hay incidencias registradas.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>

                ${this.renderAnalytics(stats)}
            </div>
        `;
    }

    renderAnalytics(stats) {
        if (!stats) {
            return '<div class="incident-analytics"></div>';
        }

        const weekly = Array.isArray(stats.porSemana) ? stats.porSemana : [];
        const impact = Array.isArray(stats.porImpacto) ? stats.porImpacto : [];
        const nature = Array.isArray(stats.porNaturaleza) ? stats.porNaturaleza : [];
        const topElementos = Array.isArray(stats.porElemento) ? stats.porElemento.slice(0, 5) : [];
        const topComponentes = Array.isArray(stats.porComponente) ? stats.porComponente.slice(0, 5) : [];
        const abiertas = stats.tiempos?.abiertas ?? [];
        const tiemposElementos = stats.tiempos?.elementos ?? [];

        return `
            <div class="incident-analytics">
                <div class="analytics-card">
                    <h3>Incidencias por semana</h3>
                    ${this.renderBarList(weekly, 'semana', 'total')}
                </div>
                <div class="analytics-card">
                    <h3>Impacto</h3>
                    ${this.renderBarList(impact, 'label', 'total')}
                </div>
                <div class="analytics-card">
                    <h3>Naturaleza</h3>
                    ${this.renderBarList(nature, 'label', 'total')}
                </div>
                <div class="analytics-card">
                    <h3>Elementos con mas incidencias</h3>
                    ${this.renderTopList(topElementos, item => `${item.elemento} - ${item.total}`)}
                </div>
                <div class="analytics-card">
                    <h3>Componentes mas afectados</h3>
                    ${this.renderTopList(topComponentes, item => `${item.componente} - ${item.total}`)}
                </div>
                <div class="analytics-card">
                    <h3>Promedio de cierre por elemento</h3>
                    ${this.renderTopList(
                        tiemposElementos.slice(0, 5),
                        item => `${item.elemento} - ${item.promedio} dias (${item.total})`
                    )}
                </div>
                <div class="analytics-card wide">
                    <h3>Incidencias abiertas</h3>
                    ${this.renderOpenIncidents(abiertas)}
                </div>
            </div>
        `;
    }

    renderBarList(items, labelKey, valueKey) {
        if (!items || !items.length) {
            return '<p class="chart-empty">Sin datos</p>';
        }
        const max = Math.max(...items.map(item => item[valueKey] || 0), 1);
        return `
            <div class="chart-list">
                ${items
                    .map(item => {
                        const label = escapeHtml(item[labelKey] ?? '');
                        const value = item[valueKey] ?? 0;
                        const widthRaw = Math.round((value / max) * 100);
                        const width = value === 0 ? 0 : Math.max(8, Math.min(widthRaw, 100));
                        return `
                            <div class="chart-row">
                                <span class="chart-label">${label}</span>
                                <span class="chart-bar"><span style="width:${width}%;"></span></span>
                                <span class="chart-value">${value}</span>
                            </div>
                        `;
                    })
                    .join('')}
            </div>
        `;
    }

    renderTopList(items, labelFactory) {
        if (!items || !items.length) {
            return '<p class="chart-empty">Sin datos</p>';
        }
        return `
            <ul class="analytics-list">
                ${items
                    .map(entry => `<li>${escapeHtml(labelFactory(entry))}</li>`)
                    .join('')}
            </ul>
        `;
    }

    renderOpenIncidents(list) {
        if (!list || !list.length) {
            return '<p class="chart-empty">Sin incidencias abiertas</p>';
        }
        const slice = list.slice(0, 5);
        return `
            <ul class="open-incidents">
                ${slice
                    .map(item => {
                        const impactoLabel = item.impacto ? escapeHtml(this.getImpactLabel(item.impacto)) : 'Sin definir';
                        const statusLabel = this.getStatusLabel(item.status);
                        return `
                            <li>
                                <span class="open-id">#${item.id}</span>
                                <span class="open-days">${item.dias} dias</span>
                                <span class="open-impacto">${impactoLabel}</span>
                                <span class="open-status">${escapeHtml(statusLabel)}</span>
                                <span class="open-path">${escapeHtml(item.domo)} / ${escapeHtml(item.puesto)} / ${escapeHtml(item.elemento)}</span>
                            </li>
                        `;
                    })
                    .join('')}
            </ul>
        `;
    }

    getImpactLabel(id) {
        return this.impactMap.get(id) || 'Sin definir';
    }

    getNatureLabel(id) {
        return this.natureMap.get(id) || 'Sin definir';
    }

    getStatusLabel(id) {
        return this.statusMap.get(id) || 'Desconocido';
    }

    renderIncidentRow(incident) {
        const statusLabel = this.getStatusLabel(incident.status);
        let statusClass = 'tag-open';
        if (incident.status === 'in_progress') {
            statusClass = 'tag-progress';
        } else if (incident.status === 'closed') {
            statusClass = 'tag-closed';
        }

        const actions = [];

        if (incident.status === 'open') {
            actions.push({ action: 'start', label: 'Marcar en curso', className: 'progress' });
            actions.push({ action: 'delete', label: 'Eliminar', className: 'danger' });
        } else if (incident.status === 'in_progress') {
            actions.push({ action: 'set-open', label: 'Marcar abierta', className: 'neutral' });
            actions.push({ action: 'edit', label: 'Editar', className: 'edit' });
            actions.push({ action: 'close', label: 'Cerrar', className: 'close' });
            actions.push({ action: 'delete', label: 'Eliminar', className: 'danger' });
        } else if (incident.status === 'closed') {
            actions.push({ action: 'reopen', label: 'Reabrir', className: 'reopen' });
            actions.push({ action: 'delete', label: 'Eliminar', className: 'danger' });
        }

        return `
            <tr data-id="${incident.id}">
                <td>${incident.id}</td>
                <td>${formatDateTime(incident.fecha)}</td>
                <td>${escapeHtml(incident.domo.nombre)}</td>
                <td>${escapeHtml(incident.puesto.nombre)}</td>
                <td>${escapeHtml(incident.elemento.nombre)}</td>
                <td>${incident.componente ? escapeHtml(incident.componente) : 'Sin componente'}</td>
                <td>${incident.impactoLabel ? escapeHtml(incident.impactoLabel) : '-'}</td>
                <td><span class="status-tag ${statusClass}">${statusLabel}</span></td>
                <td>${incident.fechaCierre ? formatDateTime(incident.fechaCierre) : '-'}</td>
                <td>${incident.naturalezaLabel ? escapeHtml(incident.naturalezaLabel) : '-'}</td>
                <td>${incident.diasAbierta}</td>
                <td>${escapeHtml(incident.descripcion)}</td>
                <td>${incident.resolucion ? escapeHtml(incident.resolucion) : '-'}</td>
                <td class="incident-actions-cell">
                    ${actions
                        .map(
                            action => `<button class="incident-link ${action.className}" data-action="${action.action}" data-id="${incident.id}">${action.label}</button>`
                        )
                        .join('')}
                </td>
            </tr>
        `;
    }

    renderNewIncidentForm() {
        const steps = [
            { number: 1, label: 'Selecciona el domo' },
            { number: 2, label: 'Selecciona el puesto' },
            { number: 3, label: 'Selecciona el elemento organico' },
            { number: 4, label: 'Describe el problema e impacto' }
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
                </div>
                <div class="step-actions">
                    <button id="stepPrev" class="incident-btn ghost">Anterior</button>
                    <button id="step3Next" class="incident-btn primary" ${selected ? '' : 'disabled'}>Siguiente</button>
                </div>
            </div>
        `;
    }

    renderStepDetalle() {
        const resumen = this.buildResumenSeleccion();
        const fecha = this.formData.fecha || getTodayISO();
        const descripcion = this.formData.descripcion || '';
        const impactoSeleccionado = this.formData.impacto || '';
        const impactoLabel = impactoSeleccionado ? this.getImpactLabel(impactoSeleccionado) : 'No seleccionado';
        const impactoOptions = this.impactOptions
            .map(
                option => `
                    <option value="${option.id}" ${option.id === impactoSeleccionado ? 'selected' : ''}>
                        ${option.label}
                    </option>
                `
            )
            .join('');

        return `
            <div class="step-panel">
                <div class="summary-block">
                    <h4>Resumen de la ubicacion</h4>
                    <ul>
                        <li><strong>Domo:</strong> ${escapeHtml(resumen.domo)}</li>
                        <li><strong>Puesto:</strong> ${escapeHtml(resumen.puesto)}</li>
                        <li><strong>Elemento:</strong> ${escapeHtml(resumen.elemento)}</li>
                        <li><strong>Impacto:</strong> ${escapeHtml(impactoLabel)}</li>
                    </ul>
                </div>
                <div class="form-block">
                    <div class="form-row">
                        <label>Fecha del error</label>
                        <input type="date" id="fechaAperturaInput" class="step-input" value="${fecha}" required>
                    </div>
                    <div class="form-row">
                        <label for="descripcionTextarea">Descripcion del problema *</label>
                        <textarea id="descripcionTextarea" class="step-textarea" rows="4" required>${descripcion}</textarea>
                    </div>
                    <div class="form-row">
                        <label for="impactSelect">Impacto en el sistema *</label>
                        <select id="impactSelect" class="step-select" required>
                            <option value="">-- Selecciona impacto --</option>
                            ${impactoOptions}
                        </select>
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

    buildResumenSeleccion() {
        const domo = this.system.listDomos().find(d => Number(d.id) === Number(this.formData.domoId));
        const puestos = domo ? this.system.listPuestos(domo.id) : [];
        const puesto = puestos.find(p => Number(p.id) === Number(this.formData.puestoId));
        const elementos = puesto ? this.system.listElementos(puesto.id) : [];
        const elemento = elementos.find(e => Number(e.id) === Number(this.formData.elementoId));
        return {
            domo: domo?.nombre || 'No definido',
            puesto: puesto?.nombre || 'No definido',
            elemento: elemento?.nombre || 'No definido'
        };
    }

    // Actions ----------------------------------------------------------------

    startNewIncident() {
        this.resetForm();
        this.formData.fecha = getTodayISO();
        this.formData.impacto = '';
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

        if (!descripcionEl) {
            alert('No se encontro el campo de descripcion.');
            return;
        }

        const descripcion = descripcionEl.value.trim();
        if (!descripcion) {
            alert('Describe el problema antes de guardar.');
            return;
        }

        const impacto = this.formData.impacto;
        if (!impacto) {
            alert('Selecciona el impacto en el sistema.');
            return;
        }

        const payload = {
            fecha: this.formData.fecha || getTodayISO(),
            domoId: Number(this.formData.domoId),
            puestoId: Number(this.formData.puestoId),
            elementoId: Number(this.formData.elementoId),
            impacto,
            descripcion
        };

        this.system.createIncident(payload);
        alert('Incidencia registrada correctamente.');
        this.resetForm();
        this.showIncidentsList();
    }

    closeIncident(id) {
        this.openCloseIncidentModal(id);
    }

    openCloseIncidentModal(id) {
        const incident = this.system.getIncident(id);
        if (!incident) {
            alert('No se encontro la incidencia seleccionada.');
            return;
        }
        const componentes = this.system.listComponentes(incident.elemento.id);
        const modal = document.createElement('div');
        modal.className = 'incident-modal';
        document.body.appendChild(modal);

        const closeModal = () => {
            modal.remove();
            this.closeModalState = null;
        };

        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeModal();
            }
        });

        this.closeModalState = {
            modal,
            incident,
            componentes,
            step: 1,
            totalSteps: componentes.length ? 3 : 2,
            data: {
                fechaCierre: incident.fechaCierre || getTodayISO(),
                componenteId: incident.componenteId ? String(incident.componenteId) : '',
                naturaleza: incident.naturaleza || (this.natureOptions[0]?.id ?? ''),
                resolucion: incident.resolucion || ''
            },
            closeModal
        };

        this.renderCloseModal();
    }

    renderCloseModal() {
        if (!this.closeModalState) {
            return;
        }

        const { modal } = this.closeModalState;
        modal.innerHTML = '';

        const container = document.createElement('div');
        container.className = 'incident-modal__content';
        container.innerHTML = this.buildCloseModalMarkup();
        modal.appendChild(container);

        this.bindCloseModalEvents(container);
    }

    buildCloseModalMarkup() {
        const { incident, componentes, step, totalSteps, data } = this.closeModalState;
        const hasComponentes = componentes.length > 0;
        const stepDescriptors = hasComponentes
            ? [
                  { index: 1, label: 'Fecha de cierre' },
                  { index: 2, label: 'Sub elemento organico' },
                  { index: 3, label: 'Naturaleza y solucion' }
              ]
            : [
                  { index: 1, label: 'Fecha de cierre' },
                  { index: 2, label: 'Naturaleza y solucion' }
              ];

        const stepsHtml = `
            <div class="modal-steps">
                ${stepDescriptors
                    .map(item => `
                        <div class="modal-step ${step === item.index ? 'current' : step > item.index ? 'done' : ''}">
                            <span class="modal-step__number">${item.index}</span>
                            <span class="modal-step__label">${item.label}</span>
                        </div>
                    `)
                    .join('')}
            </div>
        `;

        let body = '';
        if (step === 1) {
            body = `
                <label class="modal-field">
                    <span>Fecha cierre</span>
                    <input type="date" name="fechaCierre" value="${data.fechaCierre}" required>
                </label>
            `;
        } else if (step === 2 && hasComponentes) {
            body = `
                <label class="modal-field">
                    <span>Sub elemento (opcional)</span>
                    ${this.renderCloseSubelementSelect(incident, data.componenteId, componentes)}
                </label>
            `;
        } else {
            body = `
                <label class="modal-field">
                    <span>Naturaleza *</span>
                    <select name="naturaleza" required>
                        ${this.natureOptions
                            .map(
                                option => `
                                    <option value="${option.id}" ${option.id === data.naturaleza ? 'selected' : ''}>
                                        ${option.label}
                                    </option>
                                `
                            )
                            .join('')}
                    </select>
                </label>
                <label class="modal-field">
                    <span>Descripcion de la solucion *</span>
                    <textarea name="resolucion" rows="3" required>${data.resolucion}</textarea>
                </label>
            `;
        }

        const actions = `
            <div class="incident-modal__actions">
                <button type="button" class="incident-btn ghost" data-action="cancel">Cancelar</button>
                ${step > 1 ? '<button type="button" class="incident-btn secondary" data-action="prev">Anterior</button>' : ''}
                ${step < totalSteps
                    ? '<button type="button" class="incident-btn primary" data-action="next">Siguiente</button>'
                    : '<button type="button" class="incident-btn primary" data-action="submit">Cerrar incidencia</button>'
                }
            </div>
        `;

        return `
            <h3>Cerrar incidencia #${incident.id}</h3>
            <p class="incident-modal__summary">
                ${escapeHtml(incident.domo.nombre)} / ${escapeHtml(incident.puesto.nombre)} / ${escapeHtml(incident.elemento.nombre)}
            </p>
            ${stepsHtml}
            <form id="closeIncidentForm" class="incident-modal__form">
                ${body}
            </form>
            ${actions}
        `;
    }

    bindCloseModalEvents(container) {
        if (!this.closeModalState) {
            return;
        }

        const { step, totalSteps, componentes, data, incident, closeModal } = this.closeModalState;
        const hasComponentes = componentes.length > 0;
        const form = container.querySelector('#closeIncidentForm');
        const fechaInput = form?.querySelector('input[name="fechaCierre"]');
        const componenteSelect = form?.querySelector('select[name="componenteId"]');
        const naturalezaSelect = form?.querySelector('select[name="naturaleza"]');
        const resolucionField = form?.querySelector('textarea[name="resolucion"]');
        const cancelButton = container.querySelector('[data-action="cancel"]');
        const prevButton = container.querySelector('[data-action="prev"]');
        const nextButton = container.querySelector('[data-action="next"]');
        const submitButton = container.querySelector('[data-action="submit"]');

        fechaInput?.addEventListener('change', () => {
            data.fechaCierre = fechaInput.value;
        });

        componenteSelect?.addEventListener('change', () => {
            data.componenteId = componenteSelect.value;
        });

        naturalezaSelect?.addEventListener('change', () => {
            data.naturaleza = naturalezaSelect.value;
        });

        resolucionField?.addEventListener('input', () => {
            data.resolucion = resolucionField.value;
        });

        cancelButton?.addEventListener('click', () => {
            closeModal();
        });

        prevButton?.addEventListener('click', () => {
            this.closeModalState.step = Math.max(1, step - 1);
            this.renderCloseModal();
        });

        nextButton?.addEventListener('click', () => {
            if (step === 1 && (!data.fechaCierre || !data.fechaCierre.trim())) {
                alert('Indica la fecha de cierre.');
                fechaInput?.focus();
                return;
            }
            this.closeModalState.step = Math.min(step + 1, totalSteps);
            this.renderCloseModal();
        });

        submitButton?.addEventListener('click', () => {
            const resolucionValue = (data.resolucion || '').trim();
            if (!resolucionValue) {
                alert('Describe la solucion aplicada.');
                resolucionField?.focus();
                return;
            }
            if (!data.naturaleza) {
                alert('Selecciona la naturaleza del incidente.');
                naturalezaSelect?.focus();
                return;
            }

            try {
                this.system.closeIncident(incident.id, {
                    resolucion: resolucionValue,
                    naturaleza: data.naturaleza,
                    fechaCierre: data.fechaCierre || getTodayISO(),
                    componenteId: hasComponentes && data.componenteId ? Number(data.componenteId) : null
                });
                closeModal();
                this.showIncidentsList();
            } catch (error) {
                console.error(error);
                alert('No se pudo cerrar la incidencia.');
            }
        });
    }

    markInProgress(id) {
        try {
            this.system.setIncidentStatus(id, 'in_progress');
            this.showIncidentsList();
        } catch (error) {
            console.error(error);
            alert('No se pudo actualizar el estado de la incidencia.');
        }
    }

    markAsOpen(id) {
        try {
            this.system.setIncidentStatus(id, 'open');
            this.showIncidentsList();
        } catch (error) {
            console.error(error);
            alert('No se pudo actualizar el estado de la incidencia.');
        }
    }

    editIncident(id) {
        const incident = this.system.getIncident(id);
        if (!incident) {
            alert('No se encontro la incidencia seleccionada.');
            return;
        }
        if (incident.status === 'closed') {
            alert('No se puede editar una incidencia cerrada. Reabre la incidencia para modificarla.');
            return;
        }
        this.openEditIncidentModal(incident);
    }

    openEditIncidentModal(incident) {
        const modal = document.createElement('div');
        modal.className = 'incident-modal';

        const impactoOptions = this.impactOptions
            .map(
                option => `
                    <option value="${option.id}" ${option.id === incident.impacto ? 'selected' : ''}>
                        ${option.label}
                    </option>
                `
            )
            .join('');

        modal.innerHTML = `
            <div class="incident-modal__content">
                <h3>Editar incidencia #${incident.id}</h3>
                <p class="incident-modal__summary">
                    ${escapeHtml(incident.domo.nombre)} / ${escapeHtml(incident.puesto.nombre)} / ${escapeHtml(incident.elemento.nombre)}
                </p>
                <form id="editIncidentForm" class="incident-modal__form">
                    <label class="modal-field">
                        <span>Impacto en el sistema *</span>
                        <select name="impacto" required>
                            <option value="">-- Selecciona impacto --</option>
                            ${impactoOptions}
                        </select>
                    </label>
                    <label class="modal-field">
                        <span>Descripcion del problema *</span>
                        <textarea name="descripcion" rows="4" required>${incident.descripcion || ''}</textarea>
                    </label>
                </form>
                <div class="incident-modal__actions">
                    <button type="button" class="incident-btn ghost" data-action="cancel">Cancelar</button>
                    <button type="button" class="incident-btn primary" data-action="submit">Guardar cambios</button>
                </div>
            </div>
        `;

        const closeModal = () => {
            modal.remove();
        };

        document.body.appendChild(modal);

        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeModal();
            }
        });

        const impactoSelect = modal.querySelector('select[name="impacto"]');
        const descripcionField = modal.querySelector('textarea[name="descripcion"]');
        const cancelButton = modal.querySelector('[data-action="cancel"]');
        const submitButton = modal.querySelector('[data-action="submit"]');

        cancelButton?.addEventListener('click', () => closeModal());

        submitButton?.addEventListener('click', () => {
            const impacto = impactoSelect?.value || '';
            const descripcion = (descripcionField?.value || '').trim();

            if (!impacto) {
                alert('Selecciona el impacto en el sistema.');
                impactoSelect?.focus();
                return;
            }
            if (!descripcion) {
                alert('Describe el problema.');
                descripcionField?.focus();
                return;
            }

            try {
                this.system.updateIncident(incident.id, {
                    impacto,
                    descripcion
                });
                closeModal();
                this.showIncidentsList();
            } catch (error) {
                console.error(error);
                alert('No se pudieron guardar los cambios.');
            }
        });
    }

    renderCloseSubelementSelect(incident, selectedValue = null, componentesList = null) {
        const componentes = Array.isArray(componentesList)
            ? componentesList
            : this.system.listComponentes(incident.elemento.id);
        const selectedId = selectedValue != null && selectedValue !== '' ? Number(selectedValue) : null;
        const options = [
            `<option value="">Elemento principal (${escapeHtml(incident.elemento.nombre)})</option>`
        ];

        componentes.forEach(parent => {
            options.push(
                `<option value="${parent.id}" ${selectedId === Number(parent.id) ? 'selected' : ''}>${escapeHtml(parent.nombre)}</option>`
            );
            parent.hijos.forEach(child => {
                const isSelected = selectedId === Number(child.id);
                options.push(
                    `<option value="${child.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(parent.nombre)} / ${escapeHtml(child.nombre)}</option>`
                );
            });
        });

        return `<select name="componenteId" class="step-select">${options.join('')}</select>`;
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

    exportJSON() {
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

    exportCSV() {
        const data = this.system.exportToCSV();
        const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `incidencias_${getTodayISO()}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    // Presentation helpers ---------------------------------------------------

    showIncidentsList() {
        if (this.searchDebounce) {
            clearTimeout(this.searchDebounce);
            this.searchDebounce = null;
        }
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
        const exportJsonButton = document.getElementById('exportIncidentsJsonButton');
        const exportCsvButton = document.getElementById('exportIncidentsCsvButton');
        const table = document.querySelector('.incident-table tbody');
        const statusFilter = document.getElementById('filterStatus');
        const domoFilter = document.getElementById('filterDomo');
        const puestoFilter = document.getElementById('filterPuesto');
        const impactoFilter = document.getElementById('filterImpacto');
        const searchInput = document.getElementById('filterSearch');
        const clearFiltersButton = document.getElementById('clearFiltersButton');

        newButton?.addEventListener('click', () => this.startNewIncident());
        exportJsonButton?.addEventListener('click', () => this.exportJSON());
        exportCsvButton?.addEventListener('click', () => this.exportCSV());

        statusFilter?.addEventListener('change', () => {
            this.filters.status = statusFilter.value || 'all';
            this.showIncidentsList();
        });

        domoFilter?.addEventListener('change', () => {
            this.filters.domoId = domoFilter.value;
            this.filters.puestoId = '';
            this.showIncidentsList();
        });

        puestoFilter?.addEventListener('change', () => {
            this.filters.puestoId = puestoFilter.value;
            this.showIncidentsList();
        });

        impactoFilter?.addEventListener('change', () => {
            this.filters.impacto = impactoFilter.value;
            this.showIncidentsList();
        });

        searchInput?.addEventListener('input', event => {
            this.filters.search = event.target.value;
            if (this.searchDebounce) {
                clearTimeout(this.searchDebounce);
            }
            this.searchDebounce = setTimeout(() => {
                this.showIncidentsList();
            }, 250);
        });

        clearFiltersButton?.addEventListener('click', () => {
            if (this.searchDebounce) {
                clearTimeout(this.searchDebounce);
                this.searchDebounce = null;
            }
            this.filters = {
                status: 'all',
                domoId: '',
                puestoId: '',
                impacto: '',
                search: ''
            };
            this.showIncidentsList();
        });

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
            } else if (action === 'start') {
                this.markInProgress(id);
            } else if (action === 'set-open') {
                this.markAsOpen(id);
            } else if (action === 'edit') {
                this.editIncident(id);
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
            default:
                break;
        }
    }

    bindStep1Events() {
        const select = document.getElementById('domoSelect');
        const nextButton = document.getElementById('step1Next');
        const cancelButton = document.getElementById('cancelWizard');

        select?.addEventListener('change', () => {
            const value = select.value;
            this.formData.domoId = value ? Number(value) : null;
            nextButton.disabled = !this.formData.domoId;
            this.formData.puestoId = null;
            this.formData.elementoId = null;
            this.formData.descripcion = '';
            this.formData.impacto = '';
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
        const nextButton = document.getElementById('step2Next');
        const prevButton = document.getElementById('stepPrev');

        select?.addEventListener('change', () => {
            const value = select.value;
            this.formData.puestoId = value ? Number(value) : null;
            nextButton.disabled = !this.formData.puestoId;
            this.formData.elementoId = null;
            this.formData.descripcion = '';
            this.formData.impacto = '';
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
        const nextButton = document.getElementById('step3Next');
        const prevButton = document.getElementById('stepPrev');

        select?.addEventListener('change', () => {
            const value = select.value;
            this.formData.elementoId = value ? Number(value) : null;
            nextButton.disabled = !this.formData.elementoId;
            this.formData.descripcion = '';
            this.formData.impacto = '';
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
        const prevButton = document.getElementById('stepPrev');
        const saveButton = document.getElementById('saveIncidentButton');
        const descripcionEl = document.getElementById('descripcionTextarea');
        const impactSelect = document.getElementById('impactSelect');
        const fechaInput = document.getElementById('fechaAperturaInput');

        descripcionEl?.addEventListener('input', () => {
            this.formData.descripcion = descripcionEl.value;
        });

        impactSelect?.addEventListener('change', () => {
            this.formData.impacto = impactSelect.value;
        });

        fechaInput?.addEventListener('change', () => {
            const value = fechaInput.value;
            this.formData.fecha = value || getTodayISO();
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

