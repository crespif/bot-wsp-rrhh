// Las rutas cambian según el entorno:
//   - Windows (desarrollo local): rutas UNC \\servidor\...
//   - Docker (Linux):             rutas /mnt/sueldos/...
//
// Para Docker, definí la variable de entorno DOCKER=true en el .env

const esDocker = process.env.DOCKER === "true";

const BASE = esDocker
  ? "/mnt/sueldos"
  : "\\\\serv-ad03\\General-Sueldos";

module.exports = {
  RUTA_FRANCOS: esDocker
    ? `${BASE}/Francos - LLegadas Tde/FRANCOS `
    : `${BASE}\\Francos - LLegadas Tde\\FRANCOS `,

  RUTA_ACCESS: esDocker
    ? `${BASE}/Programa de Licencias/2026/Programa de licencias 2026.accdb`
    : `${BASE}\\Programa de Licencias\\2026\\Programa de licencias 2026.accdb`,

  RUTA_EMPLEADOS: esDocker
    ? `${BASE}/Maestro de Empleados/empleados.xlsx`
    : `${BASE}\\Maestro de Empleados\\empleados.xlsx`,

  RUTA_INASISTENCIAS: esDocker
    ? `${BASE}/BAE/2026/Acumulado Llegadas Tarde para Bae 2026.xlsx`
    : `${BASE}\\BAE\\2026\\Acumulado Llegadas Tarde para Bae 2026.xlsx`,

  PORTAL_RRHH:
    "https://portalrrhh.celta.com.ar",

  TABLA_LICENCIAS: "licencias",

  CACHE_MINUTES: 5,
};
