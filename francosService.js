const XLSX = require("xlsx");
const config = require("./config");

function obtenerFrancos(sector) {

  if (sector == "REDES") {
    sector = "REDES CON RESUMEN"
  }

  const workbook = XLSX.readFile(config.RUTA_FRANCOS + sector + ".xlsx");

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet);
}

module.exports = { obtenerFrancos };
