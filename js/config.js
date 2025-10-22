/**
 * CATÁLOGO DE CONTENIDOS
 * ----------------------
 * Este archivo define los menús, submenús y el contenido que verá el usuario.
 */

export const appConfig = {
    // BOTÓN 1
    button1: {
        title: "Instructor",
        icon: "🎖️",
        submenu: {
            option1: {
                title: "Diagrama",
                type: "image",
                content: "assets/img/DB_OAV-JTAC_INS_DOMOS.jpg"
            },
            option2: {
                title: "IP's",
                type: "text",
                content: `
                <style>
                .ip-tables-container {
                    display: flex;
                    gap: 32px;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                .ip-table {
                    border-collapse: collapse;
                    min-width: 220px;
                    margin-bottom: 20px;
                    background: #fafafa;
                    box-shadow: 0 2px 8px #0001;
                }
                .ip-table th, .ip-table td {
                    border: 1px solid #ccc;
                    padding: 8px 12px;
                    text-align: left;
                }
                .ip-table th {
                    background: #e0e0e0;
                }
                @media (max-width: 700px) {
                    .ip-tables-container {
                        flex-direction: column;
                        gap: 0;
                    }
                }
                </style>
                <div class="ip-tables-container">
                    <table class="ip-table">
                        <caption><strong>Domo 1</strong></caption>
                        <thead>
                            <tr><th>Componente</th><th>IP</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Gis + Interfaz</td><td>192.168.1.101</td></tr>
                            <tr><td>Visual</td><td>192.168.1.102</td></tr>
                            <tr><td>Radio Virtual</td><td>¿?</td></tr>
                        </tbody>
                    </table>
                    <table class="ip-table">
                        <caption><strong>Domo 2</strong></caption>
                        <thead>
                            <tr><th>Componente</th><th>IP</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Gis + Interfaz</td><td>192.168.1.201</td></tr>
                            <tr><td>Visual</td><td>192.168.1.202</td></tr>
                            <tr><td>Radio Virtual</td><td>¿?</td></tr>
                        </tbody>
                    </table>
                </div>
                `
            },
            option3: {
                title: "Componentes",
                type: "submenu",
                submenu: {
                    suboption1: {
                        title: "Gis + interfaz",
                        type: "text",
                        editable: true,
                        content: `
                <h3>Aplicaciones</h3>
                <p>VBS</p>
            `
                    },
                    suboption2: {
                        title: "Visual",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>VBS</p>
                `
                    },
                    suboption3: {
                        title: "Radio virtual",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>LinPhone</p>
                `
                    }
                }
            }
        }
    },

    // BOTÓN 2
    button2: {
        title: "Piloto",
        icon: "🪖",
        submenu: {
            option1: {
                title: "Diagrama",
                type: "image",
                content: "assets/img/DB_OAV-JTAC_PLT_DOMOS.jpg"
            },
            option2: {
                title: "IP`s",
                type: "text",
                content: `
                <style>
                .ip-tables-container {
                    display: flex;
                    gap: 32px;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                .ip-table {
                    border-collapse: collapse;
                    min-width: 220px;
                    margin-bottom: 20px;
                    background: #fafafa;
                    box-shadow: 0 2px 8px #0001;
                }
                .ip-table th, .ip-table td {
                    border: 1px solid #ccc;
                    padding: 8px 12px;
                    text-align: left;
                }
                .ip-table th {
                    background: #e0e0e0;
                }
                @media (max-width: 700px) {
                    .ip-tables-container {
                        flex-direction: column;
                        gap: 0;
                    }
                }
                </style>
                <div class="ip-tables-container">
                    <table class="ip-table">
                        <caption><strong>Domo 1</strong></caption>
                        <thead>
                            <tr><th>Componente</th><th>IP</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Visual Piloto</td><td>192.168.1.104</td></tr>
                            <tr><td>Rover (sensor) + Panel de instrumentos</td><td>192.168.1.105</td></tr>
                            <tr><td>Gis piloto</td><td>192.168.1.106</td></tr>
                            <tr><td>Radio Maquetada</td><td>192.168.1.102</td></tr>
                        </tbody>
                    </table>
                    <table class="ip-table">
                        <caption><strong>Domo 2</strong></caption>
                        <thead>
                            <tr><th>Componente</th><th>IP</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Visual Piloto</td><td>192.168.1.204</td></tr>
                            <tr><td>Rover (sensor) + Panel de instrumentos</td><td>192.168.1.205</td></tr>
                            <tr><td>Gis piloto</td><td>192.168.1.206</td></tr>
                            <tr><td>Radio Maquetada</td><td>192.168.1.202</td></tr>
                        </tbody>
                    </table>
                </div>
                `
            },
            option3: {
                title: "Componentes",
                type: "submenu",
                submenu: {
                    suboption1: {
                        title: "Gis + interfaz",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>VBS</p>
                `
                    },
                    suboption2: {
                        title: "Visual",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>VBS</p>
                `
                    },
                    suboption3: {
                        title: "Rover (sensor) + Panel de instrumentos",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>VBS</p>
                `
                    },
                    suboption4: {
                        title: "Gis piloto",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>VBS</p>
                `
                    },
                    suboption5: {
                        title: "Radio maquetada",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>Lin Phone</p>
                `
                    }
                }
            }
        }
    },

    // BOTÓN 3
    button3: {
        title: "JTAC",
        icon: "🛩️",
        submenu: {
            option1: {
                title: "Diagrama",
                type: "image",
                content: "assets/img/DB_OAV-JTAC_ENT_DOMOS.jpg"
            },
            option2: {
                title: "IP's",
                type: "text",
                content: `
                <style>
                .ip-tables-container {
                    display: flex;
                    gap: 32px;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                .ip-table {
                    border-collapse: collapse;
                    min-width: 220px;
                    margin-bottom: 20px;
                    background: #fafafa;
                    box-shadow: 0 2px 8px #0001;
                }
                .ip-table th, .ip-table td {
                    border: 1px solid #ccc;
                    padding: 8px 12px;
                    text-align: left;
                }
                .ip-table th {
                    background: #e0e0e0;
                }
                @media (max-width: 700px) {
                    .ip-tables-container {
                        flex-direction: column;
                        gap: 0;
                    }
                }
                </style>
                <div class="ip-tables-container">
                    <table class="ip-table">
                        <caption><strong>Domo 1</strong></caption>
                        <thead>
                            <tr><th>Componente</th><th>IP</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Visual Piloto</td><td>192.168.1.104</td></tr>
                            <tr><td>Rover (sensor) + Panel de instrumentos</td><td>192.168.1.105</td></tr>
                            <tr><td>Gis piloto</td><td>192.168.1.106</td></tr>
                            <tr><td>Radio Maquetada</td><td>192.168.1.102</td></tr>
                        </tbody>
                    </table>
                    <table class="ip-table">
                        <caption><strong>Domo 2</strong></caption>
                        <thead>
                            <tr><th>Componente</th><th>IP</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Visual Piloto</td><td>192.168.1.204</td></tr>
                            <tr><td>Rover (sensor) + Panel de instrumentos</td><td>192.168.1.205</td></tr>
                            <tr><td>Gis piloto</td><td>192.168.1.206</td></tr>
                            <tr><td>Radio Maquetada</td><td>192.168.1.202</td></tr>
                        </tbody>
                    </table>
                </div>
                `
            },
            option3: {
                title: "Componentes",
                type: "submenu",
                submenu: {
                    suboption1: {
                        title: "Visual 3D",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>VBS</p>
                `
                    },
                    suboption2: {
                        title: "Visual",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>VBS</p>
                `
                    },
                    suboption3: {
                        title: "Designador láser",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>VBS</p>
                `
                    },
                    suboption4: {
                        title: "Moskito",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>VBS</p>
                `
                    },
                    suboption5: {
                        title: "Jimp compact",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <p>Lin Phone</p>
                `
                    },
                    suboption6: {
                        title: "Sincronismo de proyección",
                        type: "text",
                        content: `
                    <h3>Aplicaciones</h3>
                    <h4>Puntero láser</h4>
                    <h4>DAGR</h4>
                    <p>VBS</p>
                `
                    }
                }
            },
            option4: {
                title: "Sistema de proyección",
                type: "submenu",
                submenu: {
                    suboption1: {
                        title: "Diagrama de bloques",
                        type: "image",
                        content: "assets/img/DB_OAV-JTAC_PRY_DOMOS.jpg"
                    },
                    suboption2: {
                        title: "IP's",
                        type: "text",
                        content: `
                <style>
                .ip-tables-container {
                    display: flex;
                    gap: 32px;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                .ip-table {
                    border-collapse: collapse;
                    min-width: 220px;
                    margin-bottom: 20px;
                    background: #fafafa;
                    box-shadow: 0 2px 8px #0001;
                }
                .ip-table th, .ip-table td {
                    border: 1px solid #ccc;
                    padding: 8px 12px;
                    text-align: left;
                }
                .ip-table th {
                    background: #e0e0e0;
                }
                @media (max-width: 700px) {
                    .ip-tables-container {
                        flex-direction: column;
                        gap: 0;
                    }
                }
                </style>
                <div class="ip-tables-container">
                    <table class="ip-table">
                        <caption><strong>Domo 1</strong></caption>
                        <thead>
                            <tr><th>Componente</th><th>IP</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Canal 1</td><td>192.168.1.111</td></tr>
                            <tr><td>Canal 2</td><td>192.168.1.112</td></tr>
                            <tr><td>Canal 3</td><td>192.168.1.113</td></tr>
                            <tr><td>Canal 4</td><td>192.168.1.114</td></tr>
                            <tr><td>Canal 5</td><td>192.168.1.115</td></tr>
                            <tr><td>Canal 6</td><td>192.168.1.116</td></tr>
                            <tr><td>Canal 7</td><td>192.168.1.117</td></tr>
                            <tr><td>Canal 8</td><td>192.168.1.118</td></tr>
                        </tbody>
                    </table>
                    <table class="ip-table">
                        <caption><strong>Domo 2</strong></caption>
                        <thead>
                            <tr><th>Componente</th><th>IP</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Canal 1</td><td>192.168.1.211</td></tr>
                            <tr><td>Canal 2</td><td>192.168.1.212</td></tr>
                            <tr><td>Canal 3</td><td>192.168.1.213</td></tr>
                            <tr><td>Canal 4</td><td>192.168.1.214</td></tr>
                            <tr><td>Canal 5</td><td>192.168.1.215</td></tr>
                            <tr><td>Canal 6</td><td>192.168.1.216</td></tr>
                            <tr><td>Canal 7</td><td>192.168.1.217</td></tr>
                            <tr><td>Canal 8</td><td>192.168.1.218</td></tr>
                        </tbody>
                    </table>
                </div>
                `
                    },
                    suboption3: {
                        title: "Descripción técnica",
                        type: "text",
                        content: `<h3>Descripción técnica</h3><p>Información detallada sobre el sistema de proyección.</p>`
                    }
                }
            }
        }
    },

    // BOTÓN 4
    button4: {
        title: "CPD",
        icon: "💻",
        submenu: {
            option1: {
                title: "Rack 1",
                type: "text",
                content: `
                    <h3>Configuración General</h3>
                    <p>Información sobre los ajustes del sistema...</p>
                `
            },
            option2: {
                title: "Rack 2",
                type: "text",
                content: `
                    <h3>Configuración General</h3>
                    <p>Información sobre los ajustes del sistema...</p>
                `
            },
            option3: {
                title: "Rack 3",
                type: "text",
                content: `
                    <h3>Configuración General</h3>
                    <p>Información sobre los ajustes del sistema...</p>
                `
            },
            option4: {
                title: "Rack 4",
                type: "text",
                content: `
                    <h3>Configuración General</h3>
                    <p>Información sobre los ajustes del sistema...</p>
                `
            },
            option5: {
                title: "Rack 5",
                type: "text",
                content: `
                    <h3>Configuración General</h3>
                    <p>Información sobre los ajustes del sistema...</p>
                `
            }
        }
    },

    // BOTÓN 5
    button5: {
        title: "Redes",
        icon: "🛜",
        submenu: {
            option1: {
                title: "Red .1 Simulación",
                type: "text",
                content: `
                    <h3>Comunicaciones DDS entre los componentes SW del Simulation Core</h3>
                    <p> Simulation Engine. <br>
                    Instructor Operator Station (IOS). <br>
                    HLA Gateway. <br>
                    Talos Gateway. <br>
                    Blue IG, versión de VBS para gestionar únicamente fráfico como son los elementos orgánicos. <br> 
                    Instrumentación Piloto desarrollada en GL Studio <br>
                    Gestiona Sensor. </p>
                `
            },
            option2: {
                title: "Red .2 VBS",
                type: "text",
                content: `
                    <h3>Comunicaciones entre los componentes SW de BISim. </h3>
                    <p>VBS4. <br>
                    VBS Blue IG. <br>
                    VBS World Server. </p>
                `
            },
            option3: {
                title: "Red .3 Proyección",
                type: "text",
                content: `
                    <h3>Comunicaciones entre los equipos del sistema de proyección y los IGs</h3>
                    <p>Proyectores​. <br>
                    Cámaras de calibración. <br>
                    Componente para comptibilizar VBS con IOS <br>
                    VBS Blue IG (plugin Scalable)​. </p>
                `
            },
            option4: {
                title: "Red .4 Radio",
                type: "text",
                content: `
                    <h3>Comunicaciones entre los componentes SW del Radio Comms Simulator</h3>
                    <p>Radio Server Asterisk. <br>
                    Radio Client LinPhone.
                    </p>
                `
            }
        }
    },

    // BOTÓN 6
    button6: {
        title: "Manuales",
        icon: "📚",
        submenu: {
            manual1: {
                title: "JIM Compact",
                type: "pdf",
                content: "assets/pdf/jim-compact-manual-espanol.pdf"
            },
            manual2: {
                title: "Puntero Láser",
                type: "pdf",
                content: "assets/pdf/izud-ultra-infrarrojo-zoom-laser-illuminator-434p-manual-operador.pdf"
            },
            manual3: {
                title: "Designador Láser",
                type: "pdf",
                content: "assets/pdf/leonardo-type-163-designador-laser-manual-usuario.pdf"
            },
            manual4: {
                title: "Moskito",
                type: "pdf",
                content: "assets/pdf/moskito-gps-manual-formacion-esp.pdf"
            },
            manual5: {
                title: "Radio Harris",
                type: "pdf",
                content: "assets/pdf/harris-an-prc-152a-guia-estudiante.pdf"
            },
            manual6: {
                title: "DAGR GPS",
                type: "pdf",
                content: "assets/pdf/gps-receiver-dagr-manual-operacion-tecnico-mantenimiento-2007-eng.pdf"
            }
        }
    },

    // BOTÓN 7 - INCIDENCIAS
    button7: {
        title: "Incidencias",
        icon: "⚠️",
        submenu: {
            option1: {
                title: "Ver Incidencias",
                type: "incident",
                content: ""
            }
        }
    }
};

/**
 * ==========================================
 * CONFIGURACIÓN ADICIONAL
 * ==========================================
 */

export const appSettings = {
    appName: "Documentacion simJtac",
    version: "1.0.0",
    author: "Jose A. Cediel"
};
