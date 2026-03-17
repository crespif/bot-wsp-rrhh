const XLSX = require("xlsx");
const config = require("./config");

function obtenerFrancos(sector) {
  const workbook = XLSX.readFile(config.RUTA_FRANCOS + sector + ".xlsx");

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet);
}

module.exports = { obtenerFrancos };
