/**
 * CONTROLADOR DE NAVEGACIÓN
 * -------------------------
 * Este archivo decide qué se muestra en pantalla en cada momento.
 * Piensa en él como un guía turístico que:
 * - Crea los botones principales y sus submenús.
 * - Abre el contenido adecuado cuando haces clic.
 * - Lleva un historial para poder volver atrás sin perderte.
 */

import { AppState } from './state.js';
import { getDomElements } from './domElements.js';
import { ContentRenderer } from './contentRenderer.js';

export class AppController {
    constructor(config, customRenderers = {}) {
        this.config = config;
        this.state = new AppState();
        this.elements = getDomElements();
        this.contentRenderer = new ContentRenderer(this.elements, this.state, customRenderers);
        this.slugIndex = this.buildSlugIndex();
        this.isUpdatingHash = false;
        this.onHashChange = () => {
            if (this.isUpdatingHash) {
                this.isUpdatingHash = false;
                return;
            }
            this.navigateFromHash();
        };
        window.addEventListener('hashchange', this.onHashChange);
    }

    init() {
        this.attachEventListeners();
        this.renderMainButtons();
        this.navigateFromHash();
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

    renderMainButtonSubmenu(buttonId, optionPath = []) {
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
            parentButtonId: buttonId,
            optionPath
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

    openMainButton(buttonId, options = {}) {
        const { skipHashUpdate = false } = options;
        this.state.openMainButton(buttonId);
        this.renderMainButtonSubmenu(buttonId);
        if (!skipHashUpdate) {
            this.updateHashFromState();
        }
    }

    handleMainButtonClick(buttonId) {
        this.openMainButton(buttonId);
    }

    createSubmenuOption(buttonId, optionId, optionData, optionPath = []) {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'submenu-option';
        option.textContent = optionData.title;
        const fullPath = [...optionPath, optionId];
        option.dataset.optionPath = JSON.stringify(fullPath);
        option.addEventListener('click', () => this.handleSubmenuClick(buttonId, optionId, optionData, fullPath));
        return option;
    }

    handleSubmenuClick(buttonId, optionId, optionData, optionPath = [], options = {}) {
        const { skipHashUpdate = false } = options;

        if (optionData.type === 'submenu' && optionData.submenu) {
            this.state.enterSubmenu(buttonId, optionId);
            this.renderSubmenu({
                title: optionData.title,
                entries: optionData.submenu,
                parentButtonId: buttonId,
                optionPath
            });
            if (!skipHashUpdate) {
                this.setHashForPath(buttonId, optionPath);
            }
            return;
        }

        this.state.openContent(buttonId, optionId);
        this.showContentDirect(optionData);
        if (!skipHashUpdate) {
            this.setHashForPath(buttonId, optionPath);
        }
    }

    showContentDirect(optionData) {
        this.hideSubmenu();
        this.showContentArea();
        this.contentRenderer.render(optionData);
    }

    renderSubmenu({ title, entries, parentButtonId, optionPath = [] }) {
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
        backButton.type = 'button';
        backButton.textContent = '← Volver';
        backButton.setAttribute('aria-label', 'Volver al menú anterior');
        backButton.addEventListener('click', () => this.goBack());

        const titleElement = document.createElement('h2');
        titleElement.className = 'submenu-title';
        titleElement.textContent = title;

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'submenu-options';

        Object.entries(entries).forEach(([optionId, optionData]) => {
            const option = this.createSubmenuOption(parentButtonId, optionId, optionData, optionPath);
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
                return;
        }

        this.updateHashFromState();
    }

    showMainSubmenu(buttonId) {
        if (!buttonId) {
            this.reset();
            return;
        }
        this.openMainButton(buttonId, { skipHashUpdate: true });
    }

    showSubmenuFromOption(buttonId, optionId) {
        const buttonConfig = this.config[buttonId];

        if (!buttonConfig || !buttonConfig.submenu) {
            this.reset();
            return;
        }

        const optionPath = this.getCurrentOptionPath();
        const optionConfig = this.getOptionDataFromPath(buttonId, optionPath);

        if (!optionConfig || optionConfig.type !== 'submenu') {
            this.openMainButton(buttonId, { skipHashUpdate: true });
            return;
        }

        this.renderSubmenu({
            title: optionConfig.title,
            entries: optionConfig.submenu,
            parentButtonId: buttonId,
            optionPath
        });
    }

    showContentFromIds(buttonId, optionId) {
        const optionPath = this.getCurrentOptionPath();
        const optionConfig = this.getOptionDataFromPath(buttonId, optionPath);

        if (!optionConfig) {
            this.reset({ skipHashUpdate: true });
            return;
        }

        this.showContentDirect(optionConfig);
    }

    reset(options = {}) {
        const { skipHashUpdate = false } = options;
        this.state.reset();
        this.hideContentArea();
        this.hideSubmenu();
        this.showMainButtons();
        this.updateActiveButton(null);
        if (!skipHashUpdate) {
            this.setHashForPath(null, []);
        }
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

    updateHashFromState() {
        const buttonId = this.state.currentButton;
        if (!buttonId) {
            this.setHashForPath(null, []);
            return;
        }

        const optionPath = this.getCurrentOptionPath();
        this.setHashForPath(buttonId, optionPath);
    }

    getCurrentOptionPath() {
        return this.state.history
            .filter(entry => entry.type !== 'main')
            .map(entry => entry.optionId)
            .filter(Boolean);
    }

    getOptionDataFromPath(buttonId, optionPath = []) {
        if (!buttonId || !Array.isArray(optionPath)) {
            return null;
        }

        let entries = this.config[buttonId]?.submenu;
        let optionData = null;

        for (const optionId of optionPath) {
            optionData = entries?.[optionId];
            if (!optionData) {
                return null;
            }
            entries = optionData.submenu;
        }

        return optionData;
    }

    setHashForPath(buttonId, optionPath = []) {
        const newHash = this.buildHashPath(buttonId, optionPath);
        const currentHash = window.location.hash || '';

        if (currentHash === newHash) {
            return;
        }

        this.isUpdatingHash = true;
        window.location.hash = newHash;
    }

    buildHashPath(buttonId, optionPath = []) {
        if (!buttonId) {
            return '#/';
        }

        const buttonData = this.config[buttonId];
        if (!buttonData) {
            return '#/';
        }

        const slugs = [];
        const buttonSlug =
            this.slugIndex.buttonSlugById.get(buttonId) ||
            this.slugify(buttonData.title || buttonId);
        slugs.push(buttonSlug);

        const optionSlugByPath = this.slugIndex.optionSlugByPath;

        let traversedPath = [];
        optionPath.forEach(optionId => {
            traversedPath = [...traversedPath, optionId];
            const slugKey = this.buildOptionSlugKey(buttonId, traversedPath);
            const storedSlug = optionSlugByPath.get(slugKey);

            if (storedSlug) {
                slugs.push(storedSlug);
            } else {
                const optionData = this.getOptionDataFromPath(buttonId, traversedPath);
                if (optionData) {
                    slugs.push(this.slugify(optionData.title || optionId));
                }
            }
        });

        return `#/${slugs.join('/')}`;
    }

    getHashSegments() {
        const rawHash = window.location.hash || '';
        const cleaned = rawHash.replace(/^#\/?/, '').trim();

        if (!cleaned) {
            return [];
        }

        return cleaned
            .split('/')
            .map(segment => decodeURIComponent(segment).toLowerCase())
            .filter(Boolean);
    }

    navigateFromHash() {
        const segments = this.getHashSegments();

        if (segments.length === 0) {
            const shouldSkipUpdate = !window.location.hash || window.location.hash === '#/' || window.location.hash === '#';
            this.reset({ skipHashUpdate: shouldSkipUpdate });
            return;
        }

        const [buttonSlug, ...rest] = segments;
        const buttonId = this.slugIndex.buttonIdBySlug.get(buttonSlug);

        if (!buttonId) {
            this.reset();
            return;
        }

        this.openMainButton(buttonId, { skipHashUpdate: true });

        if (rest.length === 0) {
            this.setHashForPath(buttonId, []);
            return;
        }

        const pathKey = [buttonSlug, ...rest].join('/');
        const entry = this.slugIndex.pathIndex.get(pathKey);

        if (!entry) {
            return;
        }

        this.followOptionChain(buttonId, entry.optionChain, { skipHashUpdate: true });
        this.setHashForPath(buttonId, entry.optionChain);
    }

    followOptionChain(buttonId, optionChain, options = {}) {
        const { skipHashUpdate = false } = options;

        if (!Array.isArray(optionChain) || optionChain.length === 0) {
            if (!skipHashUpdate) {
                this.setHashForPath(buttonId, []);
            }
            return;
        }

        let entries = this.config[buttonId]?.submenu;
        let processedPath = [];

        for (let index = 0; index < optionChain.length; index += 1) {
            const optionId = optionChain[index];
            const optionData = entries?.[optionId];

            if (!optionData) {
                break;
            }

            const currentPath = optionChain.slice(0, index + 1);
            processedPath = currentPath;

            if (optionData.type === 'submenu' && optionData.submenu) {
                this.state.enterSubmenu(buttonId, optionId);
                this.renderSubmenu({
                    title: optionData.title,
                    entries: optionData.submenu,
                    parentButtonId: buttonId,
                    optionPath: currentPath
                });
                entries = optionData.submenu;
                continue;
            }

            this.state.openContent(buttonId, optionId);
            this.showContentDirect(optionData);

            entries = optionData.submenu;
            break;
        }

        if (!skipHashUpdate) {
            this.setHashForPath(buttonId, processedPath);
        }
    }

    slugify(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'item';
    }

    buildSlugIndex() {
        const buttonSlugById = new Map();
        const buttonIdBySlug = new Map();
        const optionSlugByPath = new Map();
        const pathIndex = new Map();
        const usedButtonSlugs = new Set();

        Object.entries(this.config).forEach(([buttonId, buttonData]) => {
            const baseSlug = this.slugify(buttonData.title || buttonId);
            const buttonSlug = this.ensureUniqueSlug(baseSlug, usedButtonSlugs);
            usedButtonSlugs.add(buttonSlug);
            buttonSlugById.set(buttonId, buttonSlug);
            buttonIdBySlug.set(buttonSlug, buttonId);

            this.indexOptionPaths({
                buttonId,
                buttonSlug,
                entries: buttonData.submenu || {},
                optionIdChain: [],
                slugChain: [],
                pathIndex,
                optionSlugMap: optionSlugByPath
            });
        });

        return { buttonSlugById, buttonIdBySlug, optionSlugByPath, pathIndex };
    }

    indexOptionPaths({ buttonId, buttonSlug, entries, optionIdChain, slugChain, pathIndex, optionSlugMap }) {
        const usedSlugs = new Set();

        Object.entries(entries).forEach(([optionId, optionData]) => {
            const baseSlug = this.slugify(optionData.title || optionId);
            const optionSlug = this.ensureUniqueSlug(baseSlug, usedSlugs);
            usedSlugs.add(optionSlug);
            const nextIdChain = [...optionIdChain, optionId];
            const nextSlugChain = [...slugChain, optionSlug];
            const pathKey = [buttonSlug, ...nextSlugChain].join('/');
            const slugKey = this.buildOptionSlugKey(buttonId, nextIdChain);

            optionSlugMap.set(slugKey, optionSlug);

            pathIndex.set(pathKey, {
                buttonId,
                optionChain: nextIdChain
            });

            if (optionData.type === 'submenu' && optionData.submenu) {
                this.indexOptionPaths({
                    buttonId,
                    buttonSlug,
                    entries: optionData.submenu,
                    optionIdChain: nextIdChain,
                    slugChain: nextSlugChain,
                    pathIndex,
                    optionSlugMap
                });
            }
        });
    }

    buildOptionSlugKey(buttonId, optionChain) {
        return `${buttonId}|${optionChain.join('.')}`;
    }

    ensureUniqueSlug(baseSlug, usedSlugs) {
        const sanitizedBase = baseSlug || 'item';
        let slug = sanitizedBase;
        let counter = 2;

        while (usedSlugs.has(slug)) {
            slug = `${sanitizedBase}-${counter}`;
            counter += 1;
        }

        return slug;
    }

    getDebugInfo() {
        return {
            state: { ...this.state },
            config: this.config
        };
    }
}
