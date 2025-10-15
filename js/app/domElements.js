/**
 * BUSCADOR DE ELEMENTOS DEL DOM
 * -----------------------------
 * Esta función localiza en la página los bloques que la aplicación necesita
 * manipular (botones, contenedores, etc.). Así evitamos buscar lo mismo varias
 * veces y mantenemos todo centralizado en un único lugar.
 */

export function getDomElements() {
    const elements = {
        mainButtons: document.getElementById('mainButtons'),
        submenuContainer: document.getElementById('submenuContainer'),
        contentArea: document.getElementById('contentArea'),
        contentHeader: document.getElementById('contentHeader'),
        contentBody: document.getElementById('contentBody'),
        backButton: document.getElementById('backButton'),
        homeButton: document.getElementById('homeButton')
    };

    return elements;
}
