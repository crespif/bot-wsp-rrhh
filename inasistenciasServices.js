const XLSX = require("xlsx");
const config = require("./config");
const chokidar = require("chokidar")

let inasistenciasCache = [];


function cargarInasistencias() {
  try {
    const workbook = XLSX.readFile(config.RUTA_INASISTENCIAS);
    //console.log("Hojas disponibles en el archivo de inasistencias:", workbook.SheetNames);

    // Me quedo con la hoja llamada "Acumulado"
    const sheetName = "Acumulado";
    const sheet = workbook.Sheets[sheetName];

    inasistenciasCache = XLSX.utils.sheet_to_json(sheet, {
      range: 3, // Empieza a leer desde la fila 4 (índice 3)
    });

    console.log("Inasistencias cargadas:", inasistenciasCache.length);
  } catch (error) {
    console.error("Error al cargar inasistencias:", error)
  }
}

function obtenerInasistencias() {
  return inasistenciasCache;
}

chokidar.watch(config.RUTA_INASISTENCIAS).on("change", () => {
  console.log("Archivo de inasistencias actualizado");
  cargarInasistencias();
});

module.exports = { obtenerInasistencias, cargarInasistencias };
