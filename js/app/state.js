/**
 * MEMORIA DE LA NAVEGACIÓN
 * ------------------------
 * Este archivo guarda el estado básico de la aplicación.
 * Funciona como una libreta donde apuntamos:
 * - Qué botón principal está abierto.
 * - Qué opción del submenú estamos viendo.
 * - El camino recorrido para poder regresar sin perder contexto.
 */

export class AppState {
    constructor() {
        this.reset();
    }

    reset() {
        this.currentButton = null;
        this.currentOption = null;
        this.history = [];
    }

    openMainButton(buttonId) {
        this.currentButton = buttonId;
        this.currentOption = null;
        this.history = [{ type: 'main', buttonId }];
    }

    enterSubmenu(buttonId, optionId) {
        this.currentOption = optionId;
        this.history.push({ type: 'submenu', buttonId, optionId });
    }

    openContent(buttonId, optionId) {
        this.currentButton = buttonId;
        this.currentOption = optionId;
        this.history.push({ type: 'content', buttonId, optionId });
    }

    popHistory() {
        return this.history.pop();
    }

    peekHistory() {
        return this.history[this.history.length - 1] || null;
    }
}
