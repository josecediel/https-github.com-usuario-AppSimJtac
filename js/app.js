/**
 * CONTROLADOR PRINCIPAL DE LA APP
 * --------------------------------
 * Este archivo arranca la aplicacion:
 * - Carga la configuracion de menus.
 * - Crea los modulos que dibujan pantallas y guardan incidencias.
 * - Conecta los modulos entre si para que compartan datos.
 *
 * Puedes verlo como el director de orquesta: reune a todos los musicos
 * (modulos) y da la senal para empezar a tocar en cuanto la pagina esta lista.
 */

import { appConfig } from './config.js';
import { AppController } from './app/appController.js';
import { IncidentSystem } from './incident/incidentSystem.js';
import { IncidentUI } from './incident/incidentUI.js';
import { initDB } from '../db.js';

let appController;
let incidentSystem;
let incidentUI;
let databaseReady = false;

bootstrap();

async function bootstrap() {
    await initDatabase();
    initModules();
}

async function initDatabase() {
    try {
        await initDB();
        databaseReady = true;
        console.info('[SQLite] Base de datos en memoria inicializada');
    } catch (error) {
        databaseReady = false;
        console.error('[SQLite] Error al inicializar la base de datos', error);
    }
}

function initModules() {
    incidentSystem = new IncidentSystem();
    incidentUI = new IncidentUI(incidentSystem);
    appController = new AppController(appConfig, incidentUI);

    incidentSystem.init();

    incidentUI.registerPresenter(optionData => {
        appController.showContentDirect(optionData);
    });

    const startApp = () => {
        appController.init();
        notifyDatabaseStatus();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp, { once: true });
    } else {
        startApp();
    }

    // Exponer utilidades para depuracion y manejadores inline del sistema de incidencias
    window.IncidentUI = incidentUI;
    window.AppDebug = {
        getState: () => ({
            currentButton: appController.state.currentButton,
            currentOption: appController.state.currentOption,
            history: [...appController.state.history]
        }),
        getConfig: () => appConfig
    };
}

function notifyDatabaseStatus() {
    if (!databaseReady) {
        console.warn('[SQLite] La base de datos no se ha podido inicializar. Revisa la carga de sql-wasm.js o recarga la pagina.');
    }
}
