/**
 * CONTROLADOR DE NAVEGACIÓN
 * -------------------------
 * Este archivo decide qué se muestra en pantalla en cada momento.
 * Piensa en él como un guía turístico que:
 * - Crea los botones principales y sus submenús.
 * - Abre el contenido adecuado cuando haces clic.
 * - Lleva un historial para poder volver atrás sin perderte.
 * También integra el módulo de incidencias para que aparezca dentro del mismo flujo.
 */

import { AppState } from './state.js';
import { getDomElements } from './domElements.js';
import { ContentRenderer } from './contentRenderer.js';

export class AppController {
    constructor(config, incidentUI, customRenderers = {}) {
        this.config = config;
        this.incidentUI = incidentUI;
        this.state = new AppState();
        this.elements = getDomElements();
        this.contentRenderer = new ContentRenderer(this.elements, this.state, customRenderers);
    }

    init() {
        this.attachEventListeners();
        this.renderMainButtons();
    }

    attachEventListeners() {
        this.elements.backButton.addEventListener('click', () => this.goBack());

        if (this.elements.homeButton) {
            this.elements.homeButton.addEventListener('click', () => this.reset());
        }
    }

    renderMainButtons() {
        const container = this.elements.mainButtons;
        container.innerHTML = '';

        Object.entries(this.config).forEach(([buttonId, buttonData]) => {
            const button = this.createMainButton(buttonId, buttonData);
            container.appendChild(button);
        });
    }

    renderMainButtonSubmenu(buttonId) {
        const buttonData = this.config[buttonId];

        if (!buttonData) {
            console.error(`Botón ${buttonId} no encontrado en la configuración`);
            return;
        }

        this.updateActiveButton(buttonId);
        this.hideContentArea();
        this.hideMainButtons();
        this.renderSubmenu({
            title: buttonData.title,
            entries: buttonData.submenu || {},
            parentButtonId: buttonId
        });
    }

    createMainButton(buttonId, buttonData) {
        const button = document.createElement('button');
        button.className = 'main-button';
        button.dataset.buttonId = buttonId;

        if (buttonData.icon) {
            button.innerHTML = `<span style="font-size: 2em; display: block; margin-bottom: 10px;">${buttonData.icon}</span>${buttonData.title}`;
        } else {
            button.textContent = buttonData.title;
        }

        button.addEventListener('click', () => this.handleMainButtonClick(buttonId));

        return button;
    }

    handleMainButtonClick(buttonId) {
        this.state.openMainButton(buttonId);
        this.renderMainButtonSubmenu(buttonId);
    }

    createSubmenuOption(buttonId, optionId, optionData) {
        const option = document.createElement('div');
        option.className = 'submenu-option';
        option.textContent = optionData.title;
        option.addEventListener('click', () => this.handleSubmenuClick(buttonId, optionId, optionData));
        return option;
    }

    handleSubmenuClick(buttonId, optionId, optionData) {
        if (optionData.type === 'incident') {
            this.state.openContent(buttonId, optionId);
            this.incidentUI.showIncidentsList();
            return;
        }

        if (optionData.type === 'submenu' && optionData.submenu) {
            this.state.enterSubmenu(buttonId, optionId);
            this.renderSubmenu({
                title: optionData.title,
                entries: optionData.submenu,
                parentButtonId: buttonId
            });
            return;
        }

        this.state.openContent(buttonId, optionId);
        this.showContentDirect(optionData);
    }

    showContentDirect(optionData) {
        this.hideSubmenu();
        this.showContentArea();
        this.contentRenderer.render(optionData);
    }

    renderSubmenu({ title, entries, parentButtonId }) {
        const container = this.elements.submenuContainer;

        if (!entries || Object.keys(entries).length === 0) {
            this.showContentDirect({ title, type: 'text', content: '<p>Sin opciones disponibles.</p>' });
            return;
        }

        container.innerHTML = '';
        container.style.display = 'block';

        const wrapper = document.createElement('div');
        wrapper.className = 'submenu-container active';

        const backButton = document.createElement('button');
        backButton.className = 'back-button';
        backButton.textContent = '← Volver';
        backButton.addEventListener('click', () => this.goBack());

        const titleElement = document.createElement('h2');
        titleElement.className = 'submenu-title';
        titleElement.textContent = title;

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'submenu-options';

        Object.entries(entries).forEach(([optionId, optionData]) => {
            const option = this.createSubmenuOption(parentButtonId, optionId, optionData);
            optionsContainer.appendChild(option);
        });

        wrapper.appendChild(backButton);
        wrapper.appendChild(titleElement);
        wrapper.appendChild(optionsContainer);

        container.appendChild(wrapper);
        container.classList.add('active');
    }

    goBack() {
        this.state.popHistory();
        const previous = this.state.peekHistory();

        if (!previous) {
            this.reset();
            return;
        }

        this.state.currentButton = previous.buttonId || null;
        this.state.currentOption = previous.optionId || null;

        switch (previous.type) {
            case 'main':
                this.showMainSubmenu(previous.buttonId);
                break;
            case 'submenu':
                this.showSubmenuFromOption(previous.buttonId, previous.optionId);
                break;
            case 'content':
                this.showContentFromIds(previous.buttonId, previous.optionId);
                break;
            default:
                this.reset();
        }
    }

    showMainSubmenu(buttonId) {
        if (!buttonId) {
            this.reset();
            return;
        }
        this.renderMainButtonSubmenu(buttonId);
    }

    showSubmenuFromOption(buttonId, optionId) {
        const buttonConfig = this.config[buttonId];

        if (!buttonConfig || !buttonConfig.submenu) {
            this.reset();
            return;
        }

        const optionConfig = buttonConfig.submenu[optionId];

        if (!optionConfig || optionConfig.type !== 'submenu') {
            this.handleMainButtonClick(buttonId);
            return;
        }

        this.renderSubmenu({
            title: optionConfig.title,
            entries: optionConfig.submenu,
            parentButtonId: buttonId
        });
    }

    showContentFromIds(buttonId, optionId) {
        const buttonConfig = this.config[buttonId];
        const optionConfig = buttonConfig?.submenu?.[optionId];

        if (!optionConfig) {
            this.reset();
            return;
        }

        if (optionConfig.type === 'incident') {
            this.incidentUI.showIncidentsList();
            return;
        }

        this.showContentDirect(optionConfig);
    }

    reset() {
        this.state.reset();
        this.hideContentArea();
        this.hideSubmenu();
        this.showMainButtons();
        this.updateActiveButton(null);
    }

    updateActiveButton(activeId) {
        const buttons = this.elements.mainButtons.querySelectorAll('.main-button');
        buttons.forEach(btn => {
            if (btn.dataset.buttonId === activeId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    showMainButtons() {
        this.elements.mainButtons.style.display = '';
    }

    hideMainButtons() {
        this.elements.mainButtons.style.display = 'none';
    }

    showContentArea() {
        this.elements.contentArea.classList.add('active');
    }

    hideContentArea() {
        this.elements.contentArea.classList.remove('active');
    }

    hideSubmenu() {
        this.elements.submenuContainer.innerHTML = '';
        this.elements.submenuContainer.style.display = 'none';
        this.elements.submenuContainer.classList.remove('active');
    }

    getDebugInfo() {
        return {
            state: { ...this.state },
            config: this.config
        };
    }
}
