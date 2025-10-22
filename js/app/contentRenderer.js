/**
 * PINTOR DE CONTENIDOS
 * --------------------
 * Este módulo recibe los datos de cada opción y se encarga de mostrar el texto,
 * las imágenes, las tablas o los PDFs dentro del área de contenido.
 * También ofrece edición básica para aquellos textos marcados como editables.
 */

const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PYoN7wAAAABJRU5ErkJggg==';

export class ContentRenderer {
    constructor(elements, state, customRenderers = {}) {
        this.elements = elements;
        this.state = state;
        this.customRenderers = customRenderers;
    }

    render(optionData) {
        const { contentBody, contentHeader } = this.elements;
        const storageKey = this.generateStorageKey();

        if (!optionData) {
            contentHeader.textContent = 'Detalle';
            contentBody.innerHTML = '<p>Contenido no disponible.</p>';
            this.focusHeader();
            return;
        }

        contentHeader.textContent = optionData.title || 'Detalle';

        const customRenderer = this.customRenderers?.[optionData.type];
        if (typeof customRenderer === 'function') {
            contentBody.innerHTML = '';
            customRenderer({
                optionData,
                elements: this.elements,
                state: this.state,
                storageKey
            });
            this.focusHeader();
            return;
        }

        switch (optionData.type) {
            case 'text':
                this.renderText(optionData, storageKey);
                break;
            case 'image':
                this.renderImage(optionData);
                break;
            case 'pdf':
                this.renderPdf(optionData);
                break;
            case 'table':
                this.renderTable(optionData);
                break;
            default:
                contentBody.innerHTML = '<p>Tipo de contenido no soportado.</p>';
        }

        this.focusHeader();
    }

    renderText(optionData, storageKey) {
        const { contentBody } = this.elements;
        const storedContent = localStorage.getItem(storageKey);
        const displayContent = storedContent !== null ? storedContent : optionData.content;

        if (optionData.editable) {
            contentBody.innerHTML = `
                <div id="textContentArea">${displayContent}</div>
                <button id="editTextButton" class="back-button" style="margin-top:10px;">Editar</button>
            `;

            const editButton = contentBody.querySelector('#editTextButton');
            if (editButton) {
                editButton.addEventListener('click', () => this.renderEditableEditor(optionData, displayContent, storageKey));
            }
        } else {
            contentBody.innerHTML = `<div id="textContentArea">${displayContent}</div>`;
        }
    }

    renderEditableEditor(optionData, currentContent, storageKey) {
        const { contentBody } = this.elements;
        const plainText = this.stripHtml(currentContent);

        contentBody.innerHTML = `
            <textarea id="editTextArea" style="width:100%;height:200px;">${plainText}</textarea>
            <br>
            <button id="saveTextButton" class="back-button">Guardar</button>
            <button id="cancelEditButton" class="back-button">Cancelar</button>
        `;

        const saveButton = contentBody.querySelector('#saveTextButton');
        const cancelButton = contentBody.querySelector('#cancelEditButton');

        if (saveButton) {
            saveButton.addEventListener('click', () => {
                const newValue = contentBody.querySelector('#editTextArea').value;
                optionData.content = newValue;
                localStorage.setItem(storageKey, newValue);
                this.render(optionData);
            });
        }

        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                this.render(optionData);
            });
        }
    }

    renderImage(optionData) {
        const { contentBody } = this.elements;
        contentBody.innerHTML = `
            <img src="${optionData.content}" 
                 alt="${optionData.title}"
                 onerror="this.src='${FALLBACK_IMAGE}'">
        `;
    }

    renderPdf(optionData) {
        const { contentBody } = this.elements;
        contentBody.innerHTML = `
            <embed src="${optionData.content}" 
                   class="pdf-viewer" 
                   type="application/pdf">
            <p style="margin-top: 10px; text-align: center; color: #666;">
                Si el PDF no se muestra, 
                <a href="${optionData.content}" target="_blank" style="color: var(--primary-color);">
                    haz clic aquí para abrirlo en una nueva pestaña
                </a>
            </p>
        `;
    }

    renderTable(optionData) {
        const { contentBody } = this.elements;
        const tableData = optionData.content;

        if (!Array.isArray(tableData) || tableData.length === 0) {
            contentBody.innerHTML = '<p>Tabla sin datos.</p>';
            return;
        }

        const columns = Object.keys(tableData[0]);

        const header = columns.map(col => `<th>${col}</th>`).join('');
        const rows = tableData
            .map(row => `<tr>${columns.map(col => `<td>${row[col]}</td>`).join('')}</tr>`)
            .join('');

        contentBody.innerHTML = `
            <table class="data-table">
                <thead><tr>${header}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    generateStorageKey() {
        if (!this.state.currentButton || !this.state.currentOption) {
            return '';
        }
        return `${this.state.currentButton}_${this.state.currentOption}`;
    }

    stripHtml(content) {
        const tmp = document.createElement('div');
        tmp.innerHTML = content;
        return tmp.textContent || tmp.innerText || '';
    }

    focusHeader() {
        const { contentHeader } = this.elements;

        if (!contentHeader) {
            return;
        }

        if (!contentHeader.hasAttribute('tabindex')) {
            contentHeader.setAttribute('tabindex', '-1');
        }

        requestAnimationFrame(() => {
            contentHeader.focus();
        });
    }
}
