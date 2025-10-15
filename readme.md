# 📱 Mi Aplicación Web

Aplicación web modular con sistema de navegación por menús y submenús.

## 📁 Estructura del Proyecto

```
mi-aplicacion/
│
├── index.html          # Página principal
├── css/
│   └── styles.css      # Estilos de la aplicación
├── js/
│   ├── config.js       # Configuración de contenido
│   └── app.js          # Lógica de la aplicación
├── assets/
│   ├── images/         # Carpeta para imágenes
│   └── pdfs/           # Carpeta para documentos PDF
└── README.md           # Este archivo
```

## 🚀 Cómo usar

### Instalación

1. Descarga todos los archivos
2. Mantén la estructura de carpetas como se muestra arriba
3. Abre `index.html` en tu navegador

**No necesitas servidor local**, aunque es recomendable para producción.

### Servidor local (opcional pero recomendado)

Si quieres usar un servidor local para desarrollo:

**Opción 1: Python**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**Opción 2: Node.js (con npx)**
```bash
npx http-server
```

**Opción 3: VS Code**
- Instala la extensión "Live Server"
- Clic derecho en `index.html` → "Open with Live Server"

Luego abre: `http://localhost:8000`

## ⚙️ Configuración

### Añadir o modificar contenido

Todo el contenido se gestiona desde **`js/config.js`**. No necesitas tocar HTML ni CSS.

#### Ejemplo: Añadir una nueva opción

```javascript
button1: {
    title: "Mi Sección",
    icon: "🎯", // Opcional
    submenu: {
        nuevaOpcion: {
            title: "Nueva Opción",
            type: "text",
            content: `
                <h3>Título</h3>
                <p>Tu contenido aquí...</p>
            `
        }
    }
}
```

### Tipos de contenido soportados

#### 1. **Texto/HTML** (`type: "text"`)
```javascript
{
    type: "text",
    content: `
        <h3>Título</h3>
        <p>Párrafo con <strong>negrita</strong></p>
        <ul>
            <li>Item 1</li>
            <li>Item 2</li>
        </ul>
    `
}
```

#### 2. **Imágenes** (`type: "image"`)
```javascript
{
    type: "image",
    content: "assets/images/mi-imagen.png"
    // O URL externa: "https://ejemplo.com/imagen.jpg"
}
```

#### 3. **PDFs** (`type: "pdf"`)
```javascript
{
    type: "pdf",
    content: "assets/pdfs/documento.pdf"
    // O URL externa: "https://ejemplo.com/doc.pdf"
}
```

## 📂 Añadir tus archivos

### Imágenes
1. Coloca tus imágenes en: `assets/images/`
2. En `config.js` usa: `"assets/images/tu-imagen.jpg"`

### PDFs
1. Coloca tus PDFs en: `assets/pdfs/`
2. En `config.js` usa: `"assets/pdfs/tu-documento.pdf"`

## 🎨 Personalización de estilos

### Cambiar colores principales

Edita las variables CSS en **`css/styles.css`**:

```css
:root {
    --primary-color: #667eea;      /* Color principal */
    --secondary-color: #764ba2;    /* Color secundario */
    --text-dark: #333;             /* Texto oscuro */
    --text-light: #ffffff;         /* Texto claro */
}
```

### Ejemplos de paletas de colores

**Azul profesional:**
```css
--primary-color: #2563eb;
--secondary-color: #1e40af;
```

**Verde natural:**
```css
--primary-color: #10b981;
--secondary-color: #059669;
```

**Naranja energético:**
```css
--primary-color: #f59e0b;
--secondary-color: #d97706;
```

## 🔧 Funcionalidades

- ✅ **6 botones principales** totalmente configurables
- ✅ **Submenús ilimitados** por cada botón
- ✅ **3 tipos de contenido**: Texto, Imágenes, PDFs
- ✅ **Navegación intuitiva** con botón "Volver"
- ✅ **Responsive Design** - funciona en móviles y tablets
- ✅ **Animaciones suaves**
- ✅ **Sin dependencias externas**

## 🐛 Debugging

La aplicación incluye herramientas de debugging en la consola del navegador:

```javascript
// Ver el estado actual
App.debug.getState()

// Ver la configuración
App.debug.getConfig()

// Log del estado en tabla
App.debug.logState()
```

Para abrir la consola:
- **Chrome/Edge**: `F12` o `Ctrl + Shift + J`
- **Firefox**: `F12` o `Ctrl + Shift + K`
- **Safari**: `Cmd + Option + C`

## 📱 Responsive

La aplicación está optimizada para:
- 💻 **Desktop**: Diseño en grid de 2-3 columnas
- 📱 **Tablet**: Diseño adaptado a 1-2 columnas
- 📱 **Mobile**: Diseño de 1 columna

## 🚀 Migración a React (futuro)

Esta estructura está pensada para facilitar la migración a React:

### Correspondencia de archivos:
- `config.js` → Estado global / Context API
- `app.js` → Componentes React
- Cada función se convertirá en un componente

### Ventajas de esta estructura:
- ✅ Separación de datos y lógica
- ✅ Funciones modulares → Componentes
- ✅ Ya usa conceptos similares (estado, eventos)

## 📝 Ejemplo completo

```javascript
// En config.js
button1: {
    title: "Recursos",
    icon: "📚",
    submenu: {
        manual: {
            title: "Manual de Usuario",
            type: "pdf",
            content: "assets/pdfs/manual.pdf"
        },
        guia: {
            title: "Guía Rápida",
            type: "text",
            content: `
                <h3>Guía de Inicio Rápido</h3>
                <ol>
                    <li>Selecciona una categoría</li>
                    <li>Elige una opción del menú</li>
                    <li>Consulta la información</li>
                </ol>
            `
        },
        imagenes: {
            title: "Capturas de Pantalla",
            type: "image",
            content: "assets/images/screenshot.png"
        }
    }
}
```

## 🆘 Solución de problemas

### Los PDFs no se muestran
- Verifica que la ruta sea correcta
- Usa un servidor local (no funciona bien con `file://`)
- Verifica que el PDF no esté protegido

### Las imágenes no cargan
- Verifica la ruta del archivo
- Comprueba que el nombre y extensión sean correctos
- Las rutas son case-sensitive en algunos servidores

### Los estilos no se aplican
- Verifica que `styles.css` esté en `css/`
- Comprueba la consola del navegador por errores

## 📈 Próximas mejoras sugeridas

- [ ] Sistema de búsqueda
- [ ] Modo oscuro
- [ ] Favoritos
- [ ] Historial de navegación
- [ ] Exportar/Importar configuración
- [ ] Soporte para videos
- [ ] Internacionalización (i18n)

## 📄 Licencia

Este proyecto es de código abierto. Siéntete libre de modificarlo según tus necesidades.

## 👨‍💻 Autor

Creado con ❤️ para facilitar el desarrollo web modular.

---

**¿Necesitas ayuda?** Revisa la consola del navegador para mensajes de debug.