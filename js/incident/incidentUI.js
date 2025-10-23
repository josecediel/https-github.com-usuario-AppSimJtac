/**
 * INTERFAZ DE INCIDENCIAS
 * -----------------------
 * Presenta un flujo paso a paso para registrar incidencias basado en la jerarquia:
 * Domo -> Puesto -> Elemento -> Detalle del problema e impacto.
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
            impacto: 'all',
            naturaleza: 'all',
            recurrente: 'all',
            range: 'all',
            search: ''
        };
        this.pagination = {
            page: 1,
            pageSize: 10
        };
        this.view = 'home';
        this.previousView = 'home';
        this.previousViewBeforeWizard = 'home';
        this.pendingReturnView = null;
        this.sorting = {
            column: 'fecha',
            direction: 'desc'
        };
        this.inventoryCache = new Map();
        this.highlightedIncidentId = null;
        this.currentStep = 1;
        this.formData = {
            fecha: getTodayISO(),
            fechaModo: 'today',
            domoId: null,
            puestoId: null,
            elementoId: null,
            componenteId: null,
            descripcion: '',
            impacto: ''
        };
        this.closeModalState = null;
        this.searchDebounce = null;
        this.puestoComponentsOpenFor = null;
    }

    registerPresenter(presenter) {
        this.presenter = presenter;
    }

    showHome() {
        const cameFrom = this.view;
        this.view = 'home';
        this.presentContent('Gestor de incidencias', this.renderHome(), () => {
            this.bindHomeEvents();
            if (this.pendingReturnView && this.pendingReturnView !== 'home') {
                this.previousView = this.pendingReturnView;
            } else if (cameFrom && cameFrom !== 'home' && cameFrom !== 'wizard') {
                this.previousView = cameFrom;
            } else if (!this.previousView || this.previousView === 'wizard') {
                this.previousView = 'home';
            }
            this.pendingReturnView = null;
            this.previousViewBeforeWizard = 'home';
        });
    }

    renderHome() {
        const stats = this.system.getStatistics(this.buildListQuery());
        const abiertas = stats?.abiertos ?? 0;
        const enCurso = stats?.enCurso ?? 0;
        const cerradas = stats?.cerrados ?? 0;
        return `
            <div class="incident-home">
                <div class="incident-home__summary incident-stats">
                    <div class="stat-card open">
                        <span class="stat-value">${abiertas}</span>
                        <span class="stat-label">Abiertas</span>
                    </div>
                    <div class="stat-card progress">
                        <span class="stat-value">${enCurso}</span>
                        <span class="stat-label">En curso</span>
                    </div>
                    <div class="stat-card closed">
                        <span class="stat-value">${cerradas}</span>
                        <span class="stat-label">Cerradas</span>
                    </div>
                </div>
                <div class="incident-home__actions">
                    <button class="incident-home__action primary" data-action="new">
                        Nueva incidencia
                    </button>
                    <button class="incident-home__action" data-action="listado">
                        Listado de incidencias
                    </button>
                    <button class="incident-home__action" data-action="dashboard">
                        Dashboard y analitica
                    </button>
                    <button class="incident-home__action" data-action="export">
                        Exportar datos
                    </button>
                </div>
            </div>
        `;
    }

    bindHomeEvents() {
        const container = document.querySelector('.incident-home__actions');
        if (!container) {
            return;
        }
        container.addEventListener('click', event => {
            const button = event.target.closest('button[data-action]');
            if (!button) {
                return;
            }
            const action = button.dataset.action;
            if (action === 'new') {
                this.startNewIncident();
            } else if (action === 'listado') {
                this.showIncidentsList();
            } else if (action === 'dashboard') {
                this.showDashboard();
            } else if (action === 'export') {
                this.showExportPanel();
            }
        });
    }

    showDashboard() {
        this.pendingReturnView = null;
        const cameFrom = this.view;
        this.view = 'dashboard';
        if (cameFrom && cameFrom !== 'wizard') {
            this.previousView = cameFrom;
        }
        const stats = this.system.getStatistics(this.buildListQuery());
        const content = `
            <div class="incident-dashboard">
                ${this.renderAnalytics(stats)}
                <div class="dashboard-actions">
                    <button id="dashboardBack" class="incident-btn ghost">Volver</button>
                    <button id="dashboardList" class="incident-btn secondary">Ver listado</button>
                </div>
            </div>
        `;
        this.presentContent('Dashboard de incidencias', content, () => this.bindDashboardEvents());
    }

    bindDashboardEvents() {
        const backButton = document.getElementById('dashboardBack');
        const listButton = document.getElementById('dashboardList');
        backButton?.addEventListener('click', () => this.showHome());
        listButton?.addEventListener('click', () => this.showIncidentsList());
    }

    showExportPanel() {
        this.pendingReturnView = null;
        const cameFrom = this.view;
        this.view = 'export';
        if (cameFrom && cameFrom !== 'wizard') {
            this.previousView = cameFrom;
        }
        const query = this.buildListQuery();
        const incidents = this.system.listIncidents(query);
        const stats = this.system.getStatistics(query);
        const filtersSummary = this.describeActiveFilters();
        const content = `
            <div class="incident-export">
                <div class="export-summary">
                    <p><strong>Incidencias filtradas:</strong> ${incidents.length}</p>
                    <div class="export-filters">${filtersSummary}</div>
                    <div class="export-cards incident-stats">
                        <div class="stat-card open">
                            <span class="stat-label">Abiertas</span>
                            <span class="stat-value">${stats?.abiertos ?? 0}</span>
                        </div>
                        <div class="stat-card progress">
                            <span class="stat-label">En curso</span>
                            <span class="stat-value">${stats?.enCurso ?? 0}</span>
                        </div>
                        <div class="stat-card closed">
                            <span class="stat-label">Cerradas</span>
                            <span class="stat-value">${stats?.cerrados ?? 0}</span>
                        </div>
                    </div>
                </div>
                <div class="export-actions">
                    <button id="exportJsonNow" class="incident-btn primary">Exportar JSON</button>
                    <button id="exportCsvNow" class="incident-btn secondary">Exportar CSV</button>
                    <button id="exportBack" class="incident-btn ghost">Volver</button>
                </div>
            </div>
        `;
        this.presentContent('Exportar incidencias', content, () => this.bindExportEvents(query));
    }

    bindExportEvents(query) {
        const jsonButton = document.getElementById('exportJsonNow');
        const csvButton = document.getElementById('exportCsvNow');
        const backButton = document.getElementById('exportBack');
        jsonButton?.addEventListener('click', () => this.exportJSON(query));
        csvButton?.addEventListener('click', () => this.exportCSV(query));
        backButton?.addEventListener('click', () => this.showHome());
    }

    describeActiveFilters() {
        const entries = [];
        if (this.filters.status && this.filters.status !== 'all') {
            entries.push(`<span class="filter-pill">Estado: ${escapeHtml(this.getStatusLabel(this.filters.status))}</span>`);
        }
        if (this.filters.impacto && this.filters.impacto !== 'all') {
            entries.push(`<span class="filter-pill">Impacto: ${escapeHtml(this.getImpactLabel(this.filters.impacto))}</span>`);
        }
        if (this.filters.naturaleza && this.filters.naturaleza !== 'all') {
            entries.push(`<span class="filter-pill">Naturaleza: ${escapeHtml(this.getNatureLabel(this.filters.naturaleza))}</span>`);
        }
        if (this.filters.recurrente && this.filters.recurrente !== 'all') {
            entries.push(`<span class="filter-pill">Recurrente: ${this.filters.recurrente === 'yes' ? 'Sí' : 'No'}</span>`);
        }
        if (this.filters.range && this.filters.range !== 'all') {
            const rangeLabels = {
                '7d': 'Últimos 7 días',
                '30d': 'Últimos 30 días',
                '90d': 'Últimos 90 días'
            };
            const label = rangeLabels[this.filters.range] || this.filters.range;
            entries.push(`<span class="filter-pill">Rango: ${escapeHtml(label)}</span>`);
        }
        if (this.filters.domoId) {
            const domo = this.system.listDomos().find(item => String(item.id) === String(this.filters.domoId));
            if (domo) {
                entries.push(`<span class="filter-pill">Domo: ${escapeHtml(domo.nombre)}</span>`);
            }
        }
        if (this.filters.puestoId) {
            const puestos = this.filters.domoId
                ? this.system.listPuestos(Number(this.filters.domoId))
                : [];
            const puesto = puestos.find(item => String(item.id) === String(this.filters.puestoId));
            if (puesto) {
                entries.push(`<span class="filter-pill">Puesto: ${escapeHtml(puesto.nombre)}</span>`);
            }
        }
        if (this.filters.search) {
            entries.push(`<span class="filter-pill">Búsqueda: ${escapeHtml(this.filters.search)}</span>`);
        }
        return entries.length ? entries.join('') : '<span class="filter-pill muted">Sin filtros activos</span>';
    }

    showRelatedIncidents(incidentId) {
        const incident = this.system.getIncident(incidentId);
        if (!incident) {
            alert('No se encontró la incidencia seleccionada.');
            return;
        }

        const all = this.system.listIncidents();
        const related = all
            .filter(item => {
                if (item.elemento?.id !== incident.elemento?.id) {
                    return false;
                }
                if (incident.componenteId) {
                    return item.componenteId === incident.componenteId;
                }
                return true;
            })
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        const modal = document.createElement('div');
        modal.className = 'incident-modal';

        const closeModal = () => {
            modal.remove();
        };

        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeModal();
            }
        });

        const listItems = related
            .map(item => `
                <li class="related-item ${item.id === incident.id ? 'current' : ''}">
                    <div>
                        <strong>#${item.id}</strong> · ${formatDate(item.fecha)} · ${escapeHtml(this.getStatusLabel(item.status))}
                        <div class="related-path">${escapeHtml(item.domo.nombre)} / ${escapeHtml(item.puesto.nombre)} / ${escapeHtml(item.elemento.nombre)}</div>
                    </div>
                    <button type="button" class="incident-link related" data-related-id="${item.id}">Ver en listado</button>
                </li>
            `)
            .join('');

        const container = document.createElement('div');
        container.className = 'incident-modal__content related-modal';
        container.innerHTML = `
            <h3>Incidencias relacionadas (#${incident.id})</h3>
            <p class="incident-modal__summary">${escapeHtml(incident.domo.nombre)} / ${escapeHtml(incident.puesto.nombre)} / ${escapeHtml(incident.elemento.nombre)}</p>
            <ul class="related-list">${listItems}</ul>
            <div class="incident-modal__actions">
                <button type="button" class="incident-btn ghost" data-action="close">Cerrar</button>
                <button type="button" class="incident-btn secondary" data-action="go-list">Ver listado completo</button>
            </div>
        `;

        modal.appendChild(container);
        document.body.appendChild(modal);

        container.querySelector('[data-action="close"]')?.addEventListener('click', () => closeModal());

        container.querySelector('[data-action="go-list"]')?.addEventListener('click', () => {
            this.highlightedIncidentId = incident.id;
            this.filters = {
                status: 'all',
                domoId: String(incident.domo.id),
                puestoId: String(incident.puesto.id),
                impacto: 'all',
                naturaleza: 'all',
                recurrente: 'all',
                range: 'all',
                search: ''
            };
            this.pagination.page = 1;
            this.sorting = { column: 'fecha', direction: 'desc' };
            closeModal();
            this.showIncidentsList();
        });

        container.querySelectorAll('button[data-related-id]')?.forEach(button => {
            button.addEventListener('click', () => {
                const relatedId = Number(button.dataset.relatedId);
                const target = this.system.getIncident(relatedId);
                if (!target) {
                    closeModal();
                    return;
                }
                this.highlightedIncidentId = relatedId;
                this.filters = {
                    status: 'all',
                    domoId: String(target.domo.id),
                    puestoId: String(target.puesto.id),
                    impacto: 'all',
                    naturaleza: 'all',
                    recurrente: 'all',
                    range: 'all',
                    search: String(target.id)
                };
                this.pagination.page = 1;
                this.sorting = { column: 'fecha', direction: 'desc' };
                closeModal();
                this.showIncidentsList();
            });
        });
    }


    buildListQuery(overrides = {}) {
        const filters = { ...this.filters, ...overrides };
        const query = {
            status: filters.status && filters.status !== 'all' ? filters.status : null,
            domoId: filters.domoId ? Number(filters.domoId) : null,
            puestoId: filters.puestoId ? Number(filters.puestoId) : null,
            impacto:
                filters.impacto && filters.impacto !== 'all'
                    ? filters.impacto
                    : null,
            naturaleza:
                filters.naturaleza && filters.naturaleza !== 'all'
                    ? filters.naturaleza
                    : null,
            recurrente:
                filters.recurrente && filters.recurrente !== 'all'
                    ? filters.recurrente
                    : null,
            search: filters.search || null
        };

        const rangeValue = filters.range || 'all';
        if (rangeValue && rangeValue !== 'all') {
            const match = /^(\d+)d$/.exec(rangeValue);
            if (match) {
                const days = Number(match[1]);
                if (!Number.isNaN(days) && days > 0) {
                    query.fechaDesde = getISODateWithOffset(-(days - 1));
                    query.fechaHasta = getTodayISO();
                }
            }
        }

        return query;
    }

    renderIncidentsList() {
        const filterState = this.filters || {};
        const query = this.buildListQuery();
        const incidentsRaw = this.system.listIncidents(query);
        const stats = this.system.getStatistics(query);
        const domos = this.system.listDomos();
        const puestos = filterState.domoId
            ? this.system.listPuestos(Number(filterState.domoId))
            : [];
        const sortedIncidents = this.applySorting(incidentsRaw);
        const pagination = this.paginateIncidents(sortedIncidents);
        const incidents = pagination.items;

        const statusChips = this.buildChipGroup(
            'status',
            [
                { value: 'all', label: 'Todas' },
                { value: 'open', label: 'Abiertas' },
                { value: 'in_progress', label: 'En curso' },
                { value: 'closed', label: 'Cerradas' }
            ],
            filterState.status || 'all'
        );

        const impactoChips = this.buildChipGroup(
            'impacto',
            [
                { value: 'all', label: 'Todas' },
                ...this.impactOptions.map(option => ({ value: option.id, label: option.label }))
            ],
            filterState.impacto || 'all'
        );

        const naturalezaChips = this.buildChipGroup(
            'naturaleza',
            [
                { value: 'all', label: 'Todas' },
                { value: 'sin_definir', label: 'Sin definir' },
                ...this.natureOptions.map(option => ({ value: option.id, label: option.label }))
            ],
            filterState.naturaleza || 'all'
        );

        const rangeChips = this.buildChipGroup(
            'range',
            [
                { value: 'all', label: 'Todo el histórico' },
                { value: '7d', label: 'Últimos 7 días' },
                { value: '30d', label: 'Últimos 30 días' },
                { value: '90d', label: 'Últimos 90 días' }
            ],
            filterState.range || 'all'
        );

        const recurrentChips = this.buildChipGroup(
            'recurrente',
            [
                { value: 'all', label: 'Todos' },
                { value: 'yes', label: 'Recurrentes' },
                { value: 'no', label: 'No recurrentes' }
            ],
            filterState.recurrente || 'all'
        );

        const domoChips = this.buildChipGroup(
            'domoId',
            [
                { value: '', label: 'Todos' },
                ...domos.map(domo => ({ value: String(domo.id), label: domo.nombre }))
            ],
            filterState.domoId ? String(filterState.domoId) : ''
        );

        const puestoChips = filterState.domoId
            ? this.buildChipGroup(
                  'puestoId',
                  [
                      { value: '', label: 'Todos' },
                      ...puestos.map(puesto => ({ value: String(puesto.id), label: puesto.nombre }))
                  ],
                  filterState.puestoId ? String(filterState.puestoId) : ''
              )
            : '<p class="filter-hint">Selecciona primero un domo.</p>';

        const sortColumn = this.sorting?.column || 'fecha';
        const sortDir = this.sorting?.direction || 'desc';

        return `
            <div class="incident-module">
                <div class="incident-summary">
                    ${this.renderListSummary(stats)}
                </div>
                <div class="incident-filters" id="incidentFilterBar">
                    <div class="filter-group" data-filter="status">
                        <span class="filter-label">Estado</span>
                        <div class="chip-group">${statusChips}</div>
                    </div>
                    <div class="filter-group" data-filter="impacto">
                        <span class="filter-label">Impacto</span>
                        <div class="chip-group">${impactoChips}</div>
                    </div>
                    <div class="filter-group" data-filter="naturaleza">
                        <span class="filter-label">Naturaleza</span>
                        <div class="chip-group">${naturalezaChips}</div>
                    </div>
                    <div class="filter-group" data-filter="range">
                        <span class="filter-label">Rango temporal</span>
                        <div class="chip-group">${rangeChips}</div>
                    </div>
                    <div class="filter-group" data-filter="recurrente">
                        <span class="filter-label">Recurrente</span>
                        <div class="chip-group">${recurrentChips}</div>
                    </div>
                    <div class="filter-group" data-filter="domoId">
                        <span class="filter-label">Domo</span>
                        <div class="chip-group">${domoChips}</div>
                    </div>
                    <div class="filter-group" data-filter="puestoId">
                        <span class="filter-label">Puesto</span>
                        <div class="chip-group">${puestoChips}</div>
                    </div>
                </div>
                <div class="incident-filters secondary">
                    <div class="filter-field filter-search">
                        <label for="filterSearch">Buscar</label>
                        <input id="filterSearch" type="search" class="filter-input" placeholder="Descripción, domo, elemento..." value="${escapeHtml(filterState.search || '')}">
                    </div>
                    <div class="filter-actions">
                        <button id="clearFiltersButton" class="incident-btn ghost">Limpiar filtros</button>
                    </div>
                </div>
                <div class="incident-actions">
                    <button id="newIncidentButton" class="incident-btn primary">Nueva incidencia</button>
                    <button id="exportIncidentsJsonButton" class="incident-btn secondary">Exportar JSON</button>
                    <button id="exportIncidentsCsvButton" class="incident-btn secondary">Exportar CSV</button>
                </div>

                <div class="incident-table-wrapper">
                    <table class="incident-table">
                        <thead>
                            <tr>
                                <th data-sort="id" ${sortColumn === 'id' ? `data-active="${sortDir}"` : ''}>ID</th>
                                <th data-sort="status" ${sortColumn === 'status' ? `data-active="${sortDir}"` : ''}>Estado</th>
                                <th data-sort="fecha" ${sortColumn === 'fecha' ? `data-active="${sortDir}"` : ''}>Fecha apertura</th>
                                <th data-sort="fechaCierre" ${sortColumn === 'fechaCierre' ? `data-active="${sortDir}"` : ''}>Fecha cierre</th>
                                <th data-sort="domo" ${sortColumn === 'domo' ? `data-active="${sortDir}"` : ''}>Domo</th>
                                <th data-sort="puesto" ${sortColumn === 'puesto' ? `data-active="${sortDir}"` : ''}>Puesto</th>
                                <th data-sort="elemento" ${sortColumn === 'elemento' ? `data-active="${sortDir}"` : ''}>Elemento</th>
                                <th data-sort="componente" ${sortColumn === 'componente' ? `data-active="${sortDir}"` : ''}>Terminal / Ruta</th>
                                <th data-sort="impacto" ${sortColumn === 'impacto' ? `data-active="${sortDir}"` : ''}>Impacto</th>
                                <th data-sort="naturaleza" ${sortColumn === 'naturaleza' ? `data-active="${sortDir}"` : ''}>Naturaleza</th>
                                <th data-sort="dias" ${sortColumn === 'dias' ? `data-active="${sortDir}"` : ''}>Edad (días)</th>
                                <th data-sort="recurrente" ${sortColumn === 'recurrente' ? `data-active="${sortDir}"` : ''}>Recurrente</th>
                                <th data-sort="tiempoResolucion" ${sortColumn === 'tiempoResolucion' ? `data-active="${sortDir}"` : ''}>Tiempo de resolución</th>
                                <th>Descripción</th>
                                <th>Resolución</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${incidents.length ? incidents.map(incident => this.renderIncidentRow(incident)).join('') : `
                                <tr>
                                    <td colspan="16" class="incident-empty">No hay incidencias registradas.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>

                ${this.renderPagination(pagination.page, pagination.totalPages, pagination.total)}

                ${this.renderAnalytics(stats)}
            </div>
        `;
    }

    renderListSummary(stats) {
        const total = stats?.total ?? 0;
        const abiertas = stats?.abiertos ?? 0;
        const enCurso = stats?.enCurso ?? 0;
        const cerradas = stats?.cerrados ?? 0;
        const aging = stats?.aging ?? { le7: 0, between8And30: 0, gt30: 0 };

        return `
            <div class="incident-stats summary-row">
                <div class="stat-card">
                    <span class="stat-label">Total registradas</span>
                    <span class="stat-value">${total}</span>
                </div>
                <div class="stat-card open">
                    <span class="stat-label">Abiertas</span>
                    <span class="stat-value">${abiertas}</span>
                </div>
                <div class="stat-card progress">
                    <span class="stat-label">En curso</span>
                    <span class="stat-value">${enCurso}</span>
                </div>
                <div class="stat-card closed">
                    <span class="stat-label">Cerradas</span>
                    <span class="stat-value">${cerradas}</span>
                </div>
                <div class="stat-card aging">
                    <span class="stat-label">Aging activo</span>
                    <span class="stat-extra">≤7: ${aging.le7 ?? 0} · 8-30: ${aging.between8And30 ?? 0} · >30: ${aging.gt30 ?? 0}</span>
                </div>
            </div>
        `;
    }

    buildChipGroup(filterKey, options, activeValue) {
        if (!Array.isArray(options) || !options.length) {
            return '';
        }
        const active = activeValue != null ? String(activeValue) : '';
        return options
            .map(option => {
                const value = option.value != null ? String(option.value) : '';
                const label = escapeHtml(option.label ?? value);
                const subtitle = option.subtitle ? `<small>${escapeHtml(option.subtitle)}</small>` : '';
                const extraClass = option.compact ? ' compact' : '';
                const isActive = value === active;
                return `<button type="button" class="filter-chip${extraClass} ${isActive ? 'active' : ''}" data-filter="${filterKey}" data-value="${value}">${label}${subtitle}</button>`;
            })
            .join('');
    }

    applySorting(list) {
        if (!Array.isArray(list)) {
            return [];
        }
        const { column, direction } = this.sorting || { column: 'fecha', direction: 'desc' };
        const factor = direction === 'asc' ? 1 : -1;
        const safeColumn = column || 'fecha';
        return [...list].sort((a, b) => {
            switch (safeColumn) {
                case 'id':
                    return (a.id - b.id) * factor;
                case 'status':
                    return a.status.localeCompare(b.status) * factor;
                case 'domo':
                    return (a.domo?.nombre || '').localeCompare(b.domo?.nombre || '', 'es', { sensitivity: 'base' }) * factor;
                case 'puesto':
                    return (a.puesto?.nombre || '').localeCompare(b.puesto?.nombre || '', 'es', { sensitivity: 'base' }) * factor;
                case 'elemento':
                    return (a.elemento?.nombre || '').localeCompare(b.elemento?.nombre || '', 'es', { sensitivity: 'base' }) * factor;
                case 'componente':
                    return (a.ruta || '').localeCompare(b.ruta || '', 'es', { sensitivity: 'base' }) * factor;
                case 'impacto':
                    return (a.impacto || '').localeCompare(b.impacto || '', 'es', { sensitivity: 'base' }) * factor;
                case 'naturaleza':
                    return (a.naturaleza || '').localeCompare(b.naturaleza || '', 'es', { sensitivity: 'base' }) * factor;
                case 'dias':
                    return ((a.diasAbierta ?? 0) - (b.diasAbierta ?? 0)) * factor;
                case 'recurrente':
                    return (Number(a.recurrente) - Number(b.recurrente)) * factor;
                case 'tiempoResolucion':
                    return ((a.tiempoResolucion ?? 0) - (b.tiempoResolucion ?? 0)) * factor;
                case 'fechaCierre': {
                    const fechaA = a.fechaCierre ? new Date(a.fechaCierre).getTime() : 0;
                    const fechaB = b.fechaCierre ? new Date(b.fechaCierre).getTime() : 0;
                    return (fechaA - fechaB) * factor;
                }
                case 'fecha':
                default: {
                    const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0;
                    const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0;
                    return (fechaA - fechaB) * factor;
                }
            }
        });
    }

    paginateIncidents(list) {
        const items = Array.isArray(list) ? list : [];
        const pageSize = Math.max(1, this.pagination?.pageSize ?? 10);
        const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
        let page = Math.max(1, this.pagination?.page ?? 1);
        if (page > totalPages) {
            page = totalPages;
            this.pagination.page = page;
        }
        const start = (page - 1) * pageSize;
        const slice = items.slice(start, start + pageSize);
        return {
            items: slice,
            page,
            totalPages,
            total: items.length
        };
    }

    renderPagination(page, totalPages, totalItems) {
        const pageSize = this.pagination?.pageSize ?? 10;
        if (totalItems <= pageSize) {
            return `<div class="incident-pagination muted" data-current-page="${page}" data-total-pages="1">Mostrando ${totalItems} registro(s)</div>`;
        }
        return `
            <div class="incident-pagination" data-current-page="${page}" data-total-pages="${totalPages}">
                <div class="incident-pagination__info">
                    Pagina ${page} de ${totalPages} · ${totalItems} incidencia(s)
                </div>
                <div class="incident-pagination__controls">
                    <button class="incident-btn ghost" id="paginationPrev" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
                    <button class="incident-btn ghost" id="paginationNext" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button>
                </div>
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
        const aging = stats.aging ?? { le7: 0, between8And30: 0, gt30: 0 };
        const porFecha = Array.isArray(stats.porFecha) ? stats.porFecha.slice(-12) : [];
        const abiertasVsCerradas = Array.isArray(stats.abiertasVsCerradas) ? stats.abiertasVsCerradas : [];
        const mttrGeneral = stats.mttr?.general ?? null;
        const mttrNaturaleza = Array.isArray(stats.mttr?.porNaturaleza) ? stats.mttr.porNaturaleza : [];

        const trendMarkup = porFecha.length
            ? `
                <div class="trend-grid">
                    <div class="trend-header"><span>Fecha</span><span>Abiertas</span><span>Cerradas</span></div>
                    ${porFecha
                        .map(item => `
                            <div class="trend-row">
                                <span>${formatDate(item.fecha)}</span>
                                <span>${item.abiertas}</span>
                                <span>${item.cerradas}</span>
                            </div>
                        `)
                        .join('')}
                </div>
            `
            : '<p class="chart-empty">Sin datos recientes</p>';

        const agingMarkup = `
            <ul class="aging-list">
                <li><strong>≤7 días:</strong> ${aging.le7 ?? 0}</li>
                <li><strong>8-30 días:</strong> ${aging.between8And30 ?? 0}</li>
                <li><strong>&gt;30 días:</strong> ${aging.gt30 ?? 0}</li>
            </ul>
        `;

        const mttrMarkup = mttrGeneral != null
            ? `<p class="mttr-value">MTTR general: <strong>${mttrGeneral} día(s)</strong></p>`
            : '<p class="chart-empty">Sin cierres suficientes</p>';

        const mttrDetalle = mttrNaturaleza.length
            ? `<ul class="analytics-list">${mttrNaturaleza
                  .map(item => `<li>${escapeHtml(item.label)}: ${item.promedio} día(s) (${item.total})</li>`)
                  .join('')}</ul>`
            : '<p class="chart-empty">Sin datos por naturaleza</p>';

        return `
            <div class="incident-analytics">
                <div class="analytics-card wide">
                    <h3>Abiertas vs cerradas (Últimos 30 días)</h3>
                    ${trendMarkup}
                </div>
                <div class="analytics-card">
                    <h3>Abiertas vs cerradas (total)</h3>
                    ${this.renderBarList(abiertasVsCerradas, 'label', 'total')}
                </div>
                <div class="analytics-card">
                    <h3>Aging backlog abierto</h3>
                    ${agingMarkup}
                </div>
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
                    <h3>Elementos con más incidencias</h3>
                    ${this.renderTopList(topElementos, item => `${item.elemento} - ${item.total}`)}
                </div>
                <div class="analytics-card">
                    <h3>Componentes más afectados</h3>
                    ${this.renderTopList(topComponentes, item => `${item.componente} - ${item.total}`)}
                </div>
                <div class="analytics-card">
                    <h3>Promedio de cierre por elemento</h3>
                    ${this.renderTopList(
                        tiemposElementos.slice(0, 5),
                        item => `${item.elemento} - ${item.promedio} días (${item.total})`
                    )}
                </div>
                <div class="analytics-card">
                    <h3>MTTR general</h3>
                    ${mttrMarkup}
                </div>
                <div class="analytics-card">
                    <h3>MTTR por naturaleza</h3>
                    ${mttrDetalle}
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
                                <span class="open-days">${item.dias} días</span>
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
        if (incident.recurrente) {
            actions.push({ action: 'related', label: 'Relacionadas', className: 'related' });
        }

        const ruta = incident.ruta || incident.componente || '-';
        const recurrentBadge = incident.recurrente
            ? `<span class="tag tag-recurrente" title="Incidencia recurrente">Recurrente</span>`
            : '<span class="tag tag-normal">No</span>';
        const tiempoResolucion =
            incident.tiempoResolucion != null ? `${incident.tiempoResolucion} día(s)` : '-';
        const relacionadas =
            Array.isArray(incident.relacionadas) && incident.relacionadas.length
                ? ` data-relacionadas="${incident.relacionadas.join(',')}"`
                : '';
        const rowClasses = [];
        if (incident.id === this.highlightedIncidentId) {
            rowClasses.push('highlight-row');
        }
        const classAttr = rowClasses.length ? ` class="${rowClasses.join(' ')}"` : '';

        return `
            <tr data-id="${incident.id}"${classAttr}${relacionadas}>
                <td>${incident.id}</td>
                <td><span class="status-tag ${statusClass}">${statusLabel}</span></td>
                <td>${formatDate(incident.fecha)}</td>
                <td>${incident.fechaCierre ? formatDate(incident.fechaCierre) : '-'}</td>
                <td>${escapeHtml(incident.domo.nombre)}</td>
                <td>${escapeHtml(incident.puesto.nombre)}</td>
                <td>${escapeHtml(incident.elemento.nombre)}</td>
                <td>${escapeHtml(ruta)}</td>
                <td>${incident.impactoLabel ? escapeHtml(incident.impactoLabel) : '-'}</td>
                <td>${incident.naturalezaLabel ? escapeHtml(incident.naturalezaLabel) : '-'}</td>
                <td>${incident.diasAbierta}</td>
                <td>${recurrentBadge}</td>
                <td>${tiempoResolucion}</td>
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
            { number: 1, label: 'Fecha de apertura' },
            { number: 2, label: 'Selecciona el domo' },
            { number: 3, label: 'Selecciona el puesto' },
            { number: 4, label: 'Identifica el elemento' },
            { number: 5, label: 'Describe el problema e impacto' }
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
                return this.renderStepFecha();
            case 2:
                return this.renderStepDomos();
            case 3:
                return this.renderStepPuestos();
            case 4:
                return this.renderStepElementos();
            case 5:
                return this.renderStepDetalle();
            default:
                return '<p>Paso no disponible.</p>';
        }
    }

    renderStepFecha() {
        const fecha = this.formData.fecha || getTodayISO();
        const mode = this.formData.fechaModo || 'today';
        const today = getTodayISO();
        const yesterday = getISODateWithOffset(-1);
        const customVisible = mode === 'custom';
        return `
            <div class="step-panel">
                <h3 class="step-title">Fecha del error</h3>
                <div class="step-grid" role="group">
                    <button type="button" class="step-chip ${mode === 'today' ? 'active' : ''}" data-step-action="set-date" data-value="today">
                        Hoy (${today})
                    </button>
                    <button type="button" class="step-chip ${mode === 'yesterday' ? 'active' : ''}" data-step-action="set-date" data-value="yesterday">
                        Ayer (${yesterday})
                    </button>
                    <button type="button" class="step-chip ${mode === 'custom' ? 'active' : ''}" data-step-action="set-date" data-value="custom">
                        Personalizar
                    </button>
                </div>
                <div class="step-row ${customVisible ? 'visible' : 'hidden'}" id="customDateWrapper">
                    <label for="customDateInput" class="step-label-inline">Selecciona una fecha</label>
                    <input type="date" id="customDateInput" class="step-input" value="${fecha}">
                </div>
                <div class="step-actions">
                    <button id="cancelWizard" class="incident-btn ghost">Cancelar</button>
                    <button id="step1Next" class="incident-btn primary" ${fecha ? '' : 'disabled'}>Siguiente</button>
                </div>
            </div>
        `;
    }

    renderStepDomos() {
        const domos = this.system.listDomos();
        const selected = this.formData.domoId ?? null;
        return `
            <div class="step-panel">
                <h3 class="step-title">Selecciona la sala o domo</h3>
                <div class="step-grid" role="group">
                    ${domos
                        .map(
                            domo => `
                                <button type="button" class="step-chip ${Number(domo.id) === Number(selected) ? 'active' : ''}" data-step-action="select-domo" data-id="${domo.id}">
                                    ${escapeHtml(domo.nombre)}
                                </button>
                            `
                        )
                        .join('')}
                </div>
                <div class="step-actions">
                    <button id="cancelWizard" class="incident-btn ghost">Cancelar</button>
                    <button id="stepPrev" class="incident-btn ghost">Retroceder</button>
                    <button id="step2Next" class="incident-btn primary" ${selected ? '' : 'disabled'}>Siguiente</button>
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
        const selectedPuesto = selected
            ? puestos.find(item => Number(item.id) === Number(selected)) || null
            : null;
        const showActions =
            selectedPuesto && Number(this.puestoComponentsOpenFor) === Number(selectedPuesto.id);
        const componentsSection = this.buildPuestoComponentsSection(
            puestos,
            selectedPuesto,
            showActions
        );

        return `
            <div class="step-panel">
                <h3 class="step-title">Selecciona el puesto</h3>
                <div class="step-grid" role="group">
                    ${puestos
                        .map(
                            puesto => `
                                <button type="button" class="step-chip ${Number(puesto.id) === Number(selected) ? 'active' : ''}" data-step-action="select-puesto" data-id="${puesto.id}">
                                    ${escapeHtml(puesto.nombre)}
                                </button>
                            `
                        )
                        .join('')}
                </div>
                <div id="puestoComponentesSection">${componentsSection}</div>
                <div class="step-actions">
                    <button id="stepPrev" class="incident-btn ghost">Anterior</button>
                    <button id="step3Next" class="incident-btn primary" ${selected ? '' : 'disabled'}>Siguiente</button>
                </div>
            </div>
        `;
    }

    buildPuestoComponentsSection(puestos, selectedPuesto, showActions) {
        if (!Array.isArray(puestos) || !puestos.length) {
            return this.renderPuestoComponentsEmpty();
        }

        if (!selectedPuesto) {
            return this.renderPuestoComponentsPlaceholder();
        }

        return this.renderPuestoComponentsCard(selectedPuesto, showActions);
    }

    renderPuestoComponentsPlaceholder() {
        return `
            <div class="card puesto-component-card puesto-component-card--placeholder">
                <p class="puesto-component-card__hint">Selecciona un puesto para acceder a sus componentes.</p>
            </div>
        `;
    }

    renderPuestoComponentsEmpty() {
        return `
            <div class="card puesto-component-card puesto-component-card--placeholder">
                <p class="puesto-component-card__hint">No hay puestos registrados para esta sala.</p>
            </div>
        `;
    }

    renderPuestoComponentsCard(puesto, showActions) {
        const puestoNombre = escapeHtml(puesto?.nombre ?? 'Puesto');

        if (!showActions) {
            return `
                <div class="card puesto-component-card" data-puesto-id="${puesto.id}">
                    <div class="puesto-component-card__header">
                        <h4>${puestoNombre}</h4>
                    </div>
                    <p class="puesto-component-card__hint">Accede a las acciones rápidas del puesto.</p>
                    <div class="grid">
                        <button type="button" class="btn" data-step-action="open-componentes">Componentes</button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="card puesto-component-card" data-puesto-id="${puesto.id}">
                <div class="puesto-component-card__header">
                    <h4>${puestoNombre}</h4>
                    <button type="button" class="btn ghost" data-step-action="close-componentes">Volver</button>
                </div>
                <p class="puesto-component-card__hint">Selecciona la opción que deseas consultar.</p>
                <div class="grid two-columns">
                    <button type="button" class="btn" data-step-action="puesto-instrucciones">Instrucciones</button>
                    <button type="button" class="btn secondary" data-step-action="puesto-incidencia">Incidencia diaria</button>
                </div>
            </div>
        `;
    }

    renderStepElementos() {
        if (!this.ensureStepState('puestoId')) {
            return this.renderMissingSelectionMessage('puesto');
        }

        const elementos = this.system.listElementos(this.formData.puestoId);
        const selectedId = this.formData.elementoId ?? null;
        const selectedElemento = selectedId
            ? elementos.find(item => Number(item.id) === Number(selectedId)) || null
            : null;
        const componentes = selectedElemento ? this.getCachedComponentes(selectedElemento.id) : [];
        const componentSelected = this.formData.componenteId ?? null;

        return `
            <div class="step-panel">
                <h3 class="step-title">Selecciona el elemento o terminal afectado</h3>
                <div class="inventory-layout">
                    <div class="inventory-column">
                        <h4>Elementos principales</h4>
                        <div class="inventory-list" role="group">
                            ${elementos
                                .map(
                                    elemento => `
                                        <button type="button" class="inventory-chip ${Number(elemento.id) === Number(selectedId) ? 'active' : ''}" data-step-action="select-elemento" data-id="${elemento.id}">
                                            ${escapeHtml(elemento.nombre)}
                                        </button>
                                    `
                                )
                                .join('')}
                        </div>
                    </div>
                    <div class="inventory-column">
                        <h4>Componentes y terminales</h4>
                        ${
                            selectedElemento
                                ? this.renderComponentTree(selectedElemento, componentes, componentSelected)
                                : '<p class="inventory-hint">Selecciona primero un elemento principal.</p>'
                        }
                    </div>
                </div>
                <div class="inventory-summary">
                    <strong>Selección actual:</strong>
                    ${this.renderInventorySelectionSummary(selectedElemento, componentSelected, componentes)}
                </div>
                <div class="step-actions">
                    <button id="stepPrev" class="incident-btn ghost">Anterior</button>
                    <button id="step4Next" class="incident-btn primary" ${selectedElemento ? '' : 'disabled'}>Siguiente</button>
                </div>
            </div>
        `;
    }

    getCachedComponentes(elementoId) {
        const key = Number(elementoId);
        if (!this.inventoryCache.has(key)) {
            this.inventoryCache.set(key, this.system.listComponentes(key));
        }
        return this.inventoryCache.get(key) || [];
    }

    renderComponentTree(elemento, componentes, selectedComponentId) {
        const elementName = elemento?.nombre ?? '';
        const primaryActive = !selectedComponentId;
        const primaryButton = `
            <button type="button" class="inventory-chip ${primaryActive ? 'active' : ''}" data-step-action="select-componente" data-id="">
                ${escapeHtml(elementName)} (principal)
            </button>
        `;

        if (!Array.isArray(componentes) || !componentes.length) {
            return `
                <div class="inventory-list">
                    ${primaryButton}
                    <p class="inventory-hint">El elemento no tiene componentes registrados.</p>
                </div>
            `;
        }

        const treeButtons = componentes
            .map(parent => {
                const parentActive = Number(selectedComponentId) === Number(parent.id);
                const childButtons = (parent.hijos || [])
                    .map(child => {
                        const childActive = Number(selectedComponentId) === Number(child.id);
                        return `
                            <button type="button" class="inventory-chip child ${childActive ? 'active' : ''}" data-step-action="select-componente" data-id="${child.id}">
                                ${escapeHtml(parent.nombre)} / ${escapeHtml(child.nombre)}
                                ${child.finFlujo ? '<span class="tag tag-end">Fin de flujo</span>' : ''}
                            </button>
                        `;
                    })
                    .join('');
                return `
                    <div class="inventory-group">
                        <button type="button" class="inventory-chip parent ${parentActive ? 'active' : ''}" data-step-action="select-componente" data-id="${parent.id}">
                            ${escapeHtml(parent.nombre)}
                            ${parent.finFlujo ? '<span class="tag tag-end">Fin de flujo</span>' : ''}
                        </button>
                        ${childButtons ? `<div class="inventory-children">${childButtons}</div>` : ''}
                    </div>
                `;
            })
            .join('');

        return `
            <div class="inventory-list">
                ${primaryButton}
                ${treeButtons}
            </div>
        `;
    }

    renderInventorySelectionSummary(elemento, componenteId, componentes) {
        if (!elemento) {
            return 'Sin definir';
        }

        const pills = [];
        pills.push(
            `<span class="summary-pill">Elemento: ${escapeHtml(elemento.nombre)} (ID ${elemento.id})</span>`
        );

        if (!componenteId) {
            pills.push('<span class="summary-pill muted">Terminal: Elemento principal</span>');
            return pills.join(' ');
        }

        const tree = Array.isArray(componentes) ? componentes : [];
        let selected = null;

        tree.forEach(parent => {
            if (Number(parent.id) === Number(componenteId)) {
                selected = parent;
            }
            (parent.hijos || []).forEach(child => {
                if (Number(child.id) === Number(componenteId)) {
                    selected = {
                        ...child,
                        nombreCompleto: `${parent.nombre} / ${child.nombre}`
                    };
                }
            });
        });

        if (!selected) {
            pills.push('<span class="summary-pill muted">Terminal: No identificado</span>');
            return pills.join(' ');
        }

        const nombreCompleto = selected.nombreCompleto || selected.nombre || 'Terminal';
        pills.push(`<span class="summary-pill">Terminal: ${escapeHtml(nombreCompleto)}</span>`);

        if (selected.finFlujo) {
            pills.push('<span class="summary-pill highlight">Fin de flujo</span>');
        }
        if (selected.nota) {
            pills.push(`<span class="summary-pill muted">${escapeHtml(selected.nota)}</span>`);
        }
        if (selected.tipo) {
            pills.push(`<span class="summary-pill muted">Tipo: ${escapeHtml(selected.tipo)}</span>`);
        }

        return pills.join(' ');
    }

    renderStepDetalle() {
        const resumen = this.buildResumenSeleccion();
        const impactoSeleccionado = this.formData.impacto || '';
        const descripcion = this.formData.descripcion || '';

        return `
            <div class="step-panel">
                <div class="summary-block">
                    <h4>Resumen de la selección</h4>
                    <ul>
                        <li><strong>Fecha:</strong> ${formatDateTime(resumen.fecha)}</li>
                        <li><strong>Domo:</strong> ${escapeHtml(resumen.domo)}</li>
                        <li><strong>Puesto:</strong> ${escapeHtml(resumen.puesto)}</li>
                        <li><strong>Elemento:</strong> ${escapeHtml(resumen.elemento)}</li>
                        <li><strong>Terminal:</strong> ${escapeHtml(resumen.componente)}</li>
                    </ul>
                </div>
                <div class="form-block">
                    <div class="form-row">
                        <label for="descripcionTextarea">Descripción del problema *</label>
                        <textarea id="descripcionTextarea" class="step-textarea" rows="4" required>${descripcion}</textarea>
                    </div>
                    <div class="form-row">
                        <span class="form-label">Impacto en el sistema *</span>
                        <div class="step-grid" role="group" id="impactPicker">
                            ${this.impactOptions
                                .map(
                                    option => `
                                        <button type="button" class="step-chip ${option.id === impactoSeleccionado ? 'active' : ''}" data-step-action="select-impacto" data-id="${option.id}">
                                            ${escapeHtml(option.label)}
                                        </button>
                                    `
                                )
                                .join('')}
                        </div>
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
        let componenteNombre = 'Elemento principal';
        if (elemento && this.formData.componenteId) {
            const componentes = this.getCachedComponentes(elemento.id);
            componentes.forEach(parent => {
                if (Number(parent.id) === Number(this.formData.componenteId)) {
                    componenteNombre = parent.nombre;
                }
                (parent.hijos || []).forEach(child => {
                    if (Number(child.id) === Number(this.formData.componenteId)) {
                        componenteNombre = `${parent.nombre} / ${child.nombre}`;
                    }
                });
            });
        }
        return {
            fecha: this.formData.fecha || getTodayISO(),
            domo: domo?.nombre || 'No definido',
            puesto: puesto?.nombre || 'No definido',
            elemento: elemento?.nombre || 'No definido',
            componente: componenteNombre
        };
    }

    // Actions ----------------------------------------------------------------

    startNewIncident() {
        const origin = this.view || this.previousView || 'home';
        this.previousViewBeforeWizard = origin;
        this.pendingReturnView = null;
        this.previousView = origin;
        this.view = 'wizard';
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
            this.resetForm();
            this.returnToPreviousView();
        }
    }

    cancelWizard() {
        this.resetForm();
        this.returnToPreviousView();
    }

    saveIncident() {
        const descripcionEl = document.getElementById('descripcionTextarea');

        if (!descripcionEl) {
            alert('No se encontró el campo de descripción.');
            return;
        }

        if (!this.formData.domoId || !this.formData.puestoId || !this.formData.elementoId) {
            alert('Selecciona domo, puesto y elemento antes de guardar.');
            return;
        }

        if (!this.formData.fecha) {
            alert('Define la fecha de apertura.');
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
            componenteId:
                this.formData.componenteId != null && this.formData.componenteId !== ''
                    ? Number(this.formData.componenteId)
                    : null,
            impacto,
            descripcion
        };

        this.system.createIncident(payload);
        alert('Incidencia registrada correctamente.');
        this.resetForm();
        this.showIncidentsList();
    }

    returnToPreviousView() {
        if (this.view === 'wizard') {
            const target = this.previousViewBeforeWizard || this.previousView || 'home';
            if (target && target !== 'home') {
                this.pendingReturnView = target;
            } else {
                this.pendingReturnView = null;
            }
            this.previousViewBeforeWizard = 'home';
            this.previousView = target;
            this.showHome();
            return;
        }

        const target = this.previousView || 'home';
        this.previousView = target;
        switch (target) {
            case 'home':
                this.showHome();
                break;
            case 'dashboard':
                this.showDashboard();
                break;
            case 'export':
                this.showExportPanel();
                break;
            case 'list':
            default:
                this.showIncidentsList();
                break;
        }
    }

    closeIncident(id) {
        this.openCloseIncidentModal(id);
    }

    openCloseIncidentModal(id) {
        const incident = this.system.getIncident(id);
        if (!incident) {
            alert('No se encontró la incidencia seleccionada.');
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
                  { index: 3, label: 'Naturaleza y solución' }
              ]
            : [
                  { index: 1, label: 'Fecha de cierre' },
                  { index: 2, label: 'Naturaleza y solución' }
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
                    <span>Fecha de cierre</span>
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
            const selectedNature = data.naturaleza || (this.natureOptions[0]?.id ?? '');
            const natureButtons = this.natureOptions
                .map(option => `
                    <button type="button" class="filter-chip ${option.id === selectedNature ? 'active' : ''}" data-value="${option.id}">
                        ${option.label}
                    </button>
                `)
                .join('');
            body = `
                <div class="modal-field">
                    <span>Naturaleza *</span>
                    <div class="chip-group" data-close-nature>${natureButtons}</div>
                </div>
                <label class="modal-field">
                    <span>Descripción de la solución *</span>
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
        const componentPicker = form?.querySelector('[data-close-component-picker]');
        const naturePicker = form?.querySelector('[data-close-nature]');
        const resolucionField = form?.querySelector('textarea[name="resolucion"]');
        const cancelButton = container.querySelector('[data-action="cancel"]');
        const prevButton = container.querySelector('[data-action="prev"]');
        const nextButton = container.querySelector('[data-action="next"]');
        const submitButton = container.querySelector('[data-action="submit"]');

        fechaInput?.addEventListener('change', () => {
            data.fechaCierre = fechaInput.value;
        });

        componentPicker?.addEventListener('click', event => {
            const button = event.target.closest('button[data-value]');
            if (!button) {
                return;
            }
            const value = button.dataset.value ?? '';
            componentPicker.querySelectorAll('button[data-value]').forEach(btn => {
                btn.classList.toggle('active', btn === button);
            });
            data.componenteId = value;
        });

        naturePicker?.addEventListener('click', event => {
            const button = event.target.closest('button[data-value]');
            if (!button) {
                return;
            }
            const value = button.dataset.value ?? '';
            naturePicker.querySelectorAll('button[data-value]').forEach(btn => {
                btn.classList.toggle('active', btn === button);
            });
            data.naturaleza = value;
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
                alert('Describe la solución aplicada.');
                resolucionField?.focus();
                return;
            }
            if (!data.naturaleza) {
                alert('Selecciona la naturaleza del incidente.');
                naturePicker?.querySelector('button')?.focus();
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
            alert('No se encontró la incidencia seleccionada.');
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
                        <span>Descripción del problema *</span>
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
        const buttons = [
            `<button type="button" class="filter-chip ${selectedId == null ? 'active' : ''}" data-value="">Elemento principal (${escapeHtml(incident.elemento.nombre)})</button>`
        ];

        componentes.forEach(parent => {
            const parentActive = selectedId === Number(parent.id);
            const note = parent.finFlujo ? '<span class="tag tag-end">Fin de flujo</span>' : '';
            buttons.push(
                `<button type="button" class="filter-chip ${parentActive ? 'active' : ''}" data-value="${parent.id}">${escapeHtml(parent.nombre)} ${note}</button>`
            );
            parent.hijos.forEach(child => {
                const isSelected = selectedId === Number(child.id);
                const childNote = child.finFlujo ? '<span class="tag tag-end">Fin de flujo</span>' : '';
                buttons.push(
                    `<button type="button" class="filter-chip compact ${isSelected ? 'active' : ''}" data-value="${child.id}">${escapeHtml(parent.nombre)} / ${escapeHtml(child.nombre)} ${childNote}</button>`
                );
            });
        });

        return `<div class="chip-group" data-close-component-picker>${buttons.join('')}</div>`;
    }

    reopenIncident(id) {
        if (!confirm('Deseas reabrir esta incidencia?')) {
            return;
        }
        this.system.reopenIncident(id);
        this.showIncidentsList();
    }

    deleteIncident(id) {
        if (!confirm('¿Eliminar la incidencia seleccionada?')) {
            return;
        }
        this.system.removeIncident(id);
        this.showIncidentsList();
    }

    exportJSON(filters = null) {
        const data = this.system.exportToJSON(filters ?? null);
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

    exportCSV(filters = null) {
        const data = this.system.exportToCSV(filters ?? null);
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
        this.pendingReturnView = null;
        const cameFrom = this.view;
        this.view = 'list';
        if (cameFrom && cameFrom !== 'wizard' && cameFrom !== 'list') {
            this.previousView = cameFrom;
        }
        const content = this.renderIncidentsList();
        this.presentContent('Incidencias', content, () => this.bindListEvents());
    }

    showCurrentStep() {
        this.view = 'wizard';
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
        const header = document.querySelector('.incident-table thead');
        const filterBar = document.getElementById('incidentFilterBar');
        const searchInput = document.getElementById('filterSearch');
        const clearFiltersButton = document.getElementById('clearFiltersButton');
        const paginationPrev = document.getElementById('paginationPrev');
        const paginationNext = document.getElementById('paginationNext');

        newButton?.addEventListener('click', () => this.startNewIncident());
        exportJsonButton?.addEventListener('click', () => this.exportJSON(this.buildListQuery()));
        exportCsvButton?.addEventListener('click', () => this.exportCSV(this.buildListQuery()));

        filterBar?.addEventListener('click', event => {
            const chip = event.target.closest('.filter-chip');
            if (!chip) {
                return;
            }
            const filter = chip.dataset.filter;
            const value = chip.dataset.value ?? '';
            if (!filter) {
                return;
            }
            if (filter === 'domoId') {
                this.filters.puestoId = '';
            }
            if (filter === 'puestoId' && !this.filters.domoId) {
                return;
            }
            this.highlightedIncidentId = null;
            this.filters[filter] = value;
            this.pagination.page = 1;
            this.showIncidentsList();
        });

        searchInput?.addEventListener('input', event => {
            this.highlightedIncidentId = null;
            this.filters.search = event.target.value;
            this.pagination.page = 1;
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
                impacto: 'all',
                naturaleza: 'all',
                recurrente: 'all',
                range: 'all',
                search: ''
            };
            this.highlightedIncidentId = null;
            this.pagination.page = 1;
            this.sorting = { column: 'fecha', direction: 'desc' };
            this.showIncidentsList();
        });

        header?.addEventListener('click', event => {
            const th = event.target.closest('[data-sort]');
            if (!th) {
                return;
            }
            const column = th.dataset.sort;
            if (!column) {
                return;
            }
            if (this.sorting.column === column) {
                this.sorting.direction = this.sorting.direction === 'asc' ? 'desc' : 'asc';
            } else {
                this.sorting.column = column;
                this.sorting.direction = column === 'id' ? 'desc' : 'asc';
            }
            this.pagination.page = 1;
            this.showIncidentsList();
        });

        paginationPrev?.addEventListener('click', () => {
            if (this.pagination.page > 1) {
                this.pagination.page -= 1;
                this.showIncidentsList();
            }
        });

        paginationNext?.addEventListener('click', () => {
            const container = document.querySelector('.incident-pagination');
            const totalPages = Number(container?.dataset.totalPages || this.pagination.page || 1);
            if (this.pagination.page < totalPages) {
                this.pagination.page += 1;
                this.showIncidentsList();
            }
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
            } else if (action === 'related') {
                this.showRelatedIncidents(id);
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
        const nextButton = document.getElementById('step1Next');
        const cancelButton = document.getElementById('cancelWizard');
        const customWrapper = document.getElementById('customDateWrapper');
        const customInput = document.getElementById('customDateInput');
        const buttons = document.querySelectorAll('button[data-step-action="set-date"]');

        const refreshState = () => {
            buttons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === this.formData.fechaModo);
            });
            if (customWrapper) {
                if (this.formData.fechaModo === 'custom') {
                    customWrapper.classList.remove('hidden');
                    customWrapper.classList.add('visible');
                } else {
                    customWrapper.classList.remove('visible');
                    customWrapper.classList.add('hidden');
                }
            }
            if (nextButton) {
                nextButton.disabled = !this.formData.fecha;
            }
        };

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const value = button.dataset.value;
                if (value === 'today') {
                    this.formData.fechaModo = 'today';
                    this.formData.fecha = getTodayISO();
                } else if (value === 'yesterday') {
                    this.formData.fechaModo = 'yesterday';
                    this.formData.fecha = getISODateWithOffset(-1);
                } else {
                    this.formData.fechaModo = 'custom';
                    if (!this.formData.fecha) {
                        this.formData.fecha = getTodayISO();
                    }
                    setTimeout(() => customInput?.focus(), 0);
                }
                refreshState();
            });
        });

        customInput?.addEventListener('change', () => {
            const value = customInput.value;
            this.formData.fecha = value || '';
            refreshState();
        });

        cancelButton?.addEventListener('click', () => this.cancelWizard());
        nextButton?.addEventListener('click', () => {
            if (!this.formData.fecha) {
                alert('Selecciona una fecha para continuar.');
                return;
            }
            this.currentStep = 2;
            this.showCurrentStep();
        });

        refreshState();
    }

    bindStep2Events() {
        const nextButton = document.getElementById('step2Next');
        const cancelButton = document.getElementById('cancelWizard');
        const prevButton = document.getElementById('stepPrev');
        const chips = document.querySelectorAll('button[data-step-action="select-domo"]');

        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const id = Number(chip.dataset.id);
                this.formData.domoId = id;
                this.formData.puestoId = null;
                this.formData.elementoId = null;
                this.formData.componenteId = null;
                this.puestoComponentsOpenFor = null;
                this.toggleActiveChip(chips, chip);
                if (nextButton) {
                    nextButton.disabled = false;
                }
            });
        });

        cancelButton?.addEventListener('click', () => this.cancelWizard());
        prevButton?.addEventListener('click', () => this.previousStep());
        nextButton?.addEventListener('click', () => {
            if (!this.formData.domoId) {
                alert('Selecciona un domo para continuar.');
                return;
            }
            this.currentStep = 3;
            this.showCurrentStep();
        });

        if (nextButton) {
            nextButton.disabled = !this.formData.domoId;
        }
    }

    bindStep3Events() {
        const prevButton = document.getElementById('stepPrev');
        const nextButton = document.getElementById('step3Next');
        const chips = Array.from(
            document.querySelectorAll('button[data-step-action="select-puesto"]')
        );
        const componentsContainer = document.getElementById('puestoComponentesSection');

        const updateNextButtonState = () => {
            if (nextButton) {
                nextButton.disabled = !this.formData.puestoId;
            }
        };

        const highlightSelectedChip = () => {
            if (!chips.length) {
                return;
            }
            const activeChip = chips.find(
                chip => Number(chip.dataset.id) === Number(this.formData.puestoId)
            );
            this.toggleActiveChip(chips, activeChip || null);
        };

        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const id = Number(chip.dataset.id);
                this.formData.puestoId = id;
                this.formData.elementoId = null;
                this.formData.componenteId = null;
                this.puestoComponentsOpenFor = null;
                this.toggleActiveChip(chips, chip);
                updateNextButtonState();
                this.updatePuestoComponentsSection();
            });
        });

        prevButton?.addEventListener('click', () => this.previousStep());
        nextButton?.addEventListener('click', () => {
            if (!this.formData.puestoId) {
                alert('Selecciona un puesto para continuar.');
                return;
            }
            this.currentStep = 4;
            this.showCurrentStep();
        });

        componentsContainer?.addEventListener('click', event => {
            const button = event.target.closest('[data-step-action]');
            if (!button) {
                return;
            }

            const action = button.dataset.stepAction;
            if (action === 'open-componentes') {
                if (!this.formData.puestoId) {
                    return;
                }
                this.puestoComponentsOpenFor = Number(this.formData.puestoId);
                this.updatePuestoComponentsSection();
            } else if (action === 'close-componentes') {
                this.puestoComponentsOpenFor = null;
                this.updatePuestoComponentsSection();
            } else if (action === 'puesto-instrucciones') {
                this.handlePuestoQuickAction('instrucciones');
            } else if (action === 'puesto-incidencia') {
                this.handlePuestoQuickAction('incidencia');
            }
        });

        updateNextButtonState();
        highlightSelectedChip();
        this.updatePuestoComponentsSection();
    }

    handlePuestoQuickAction(action) {
        const domoId = this.formData.domoId;
        const puestoId = this.formData.puestoId;

        if (!domoId || !puestoId) {
            return;
        }

        const puestos = this.system.listPuestos(domoId) || [];
        const puesto = puestos.find(item => Number(item.id) === Number(puestoId)) || null;
        const puestoNombre = puesto ? puesto.nombre : `Puesto ${puestoId}`;
        const actionLabel = action === 'instrucciones' ? 'Instrucciones' : 'Incidencia diaria';

        console.info(`[IncidentUI] Acción rápida "${actionLabel}" seleccionada para ${puestoNombre}.`);
    }

    updatePuestoComponentsSection() {
        const container = document.getElementById('puestoComponentesSection');
        if (!container) {
            return;
        }

        const domoId = this.formData.domoId;
        if (!domoId) {
            container.innerHTML = this.renderPuestoComponentsPlaceholder();
            return;
        }

        const puestos = this.system.listPuestos(domoId) || [];
        const selected = this.formData.puestoId ?? null;
        const selectedPuesto = selected
            ? puestos.find(item => Number(item.id) === Number(selected)) || null
            : null;
        const showActions =
            selectedPuesto && Number(this.puestoComponentsOpenFor) === Number(selectedPuesto.id);

        container.innerHTML = this.buildPuestoComponentsSection(puestos, selectedPuesto, showActions);
    }

    bindStep4Events() {
        const prevButton = document.getElementById('stepPrev');
        const nextButton = document.getElementById('step4Next');
        const elementChips = document.querySelectorAll('button[data-step-action="select-elemento"]');
        const componentContainer = document.querySelector('.inventory-column:nth-of-type(2)');

        elementChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const id = Number(chip.dataset.id);
                this.formData.elementoId = id;
                this.formData.componenteId = null;
                this.toggleActiveChip(elementChips, chip);
                this.currentStep = 4;
                this.showCurrentStep();
            });
        });

        componentContainer?.addEventListener('click', event => {
            const button = event.target.closest('button[data-step-action="select-componente"]');
            if (!button) {
                return;
            }
            const id = button.dataset.id;
            const buttons = componentContainer.querySelectorAll('button[data-step-action="select-componente"]');
            buttons.forEach(btn => btn.classList.toggle('active', btn === button));
            this.formData.componenteId = id === '' ? null : Number(id);
        });

        prevButton?.addEventListener('click', () => this.previousStep());
        nextButton?.addEventListener('click', () => {
            if (!this.formData.elementoId) {
                alert('Selecciona un elemento para continuar.');
                return;
            }
            this.currentStep = 5;
            this.showCurrentStep();
        });

        if (nextButton) {
            nextButton.disabled = !this.formData.elementoId;
        }
    }

    bindStep5Events() {
        const prevButton = document.getElementById('stepPrev');
        const saveButton = document.getElementById('saveIncidentButton');
        const descripcionEl = document.getElementById('descripcionTextarea');
        const impactButtons = document.querySelectorAll('#impactPicker button[data-step-action="select-impacto"]');

        descripcionEl?.addEventListener('input', () => {
            this.formData.descripcion = descripcionEl.value;
        });

        impactButtons.forEach(button => {
            button.addEventListener('click', () => {
                const id = button.dataset.id;
                this.formData.impacto = id;
                this.toggleActiveChip(impactButtons, button);
            });
        });

        prevButton?.addEventListener('click', () => this.previousStep());
        saveButton?.addEventListener('click', () => this.saveIncident());
    }

    toggleActiveChip(collection, active) {
        collection.forEach(item => {
            item.classList.toggle('active', item === active);
        });
    }

    resetForm() {
        this.currentStep = 1;
        this.formData = {
            fecha: getTodayISO(),
            fechaModo: 'today',
            domoId: null,
            puestoId: null,
            elementoId: null,
            componenteId: null,
            descripcion: '',
            impacto: ''
        };
        this.puestoComponentsOpenFor = null;
    }
}

// ---------------------------------------------------------------------------

function formatDate(value) {
    if (!value) return '-';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch {
        return value;
    }
}

function formatDateTime(value) {
    if (!value) return '-';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
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

function getISODateWithOffset(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().split('T')[0];
}
