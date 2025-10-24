/**
 * CONTROLADOR PRINCIPAL DE LA APP
 * --------------------------------
 * Este archivo arranca la aplicación cargando la configuración y
 * preparando el controlador de navegación.
 */

import { appConfig } from './config.js';
import { AppController } from './app/appController.js';

let appController;

bootstrap();

function bootstrap() {
    initModules();
}

function initModules() {
    appController = new AppController(appConfig);

    const startApp = () => appController.init();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp, { once: true });
    } else {
        startApp();
    }

    window.AppDebug = {
        getState: () => ({
            currentButton: appController.state.currentButton,
            currentOption: appController.state.currentOption,
            history: [...appController.state.history]
        }),
        getConfig: () => appConfig
    };
}
