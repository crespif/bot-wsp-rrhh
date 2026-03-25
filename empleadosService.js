const XLSX = require("xlsx");
const config = require("./config");
const chokidar = require("chokidar")

let empleadosCache = [];

chokidar.watch(config.RUTA_EMPLEADOS).on("change", () => {
  console.log("empleados.xlsx actualizado")
  cargarEmpleados()
})

function cargarEmpleados() {
  try {
    const sheet = XLSX.readFile(config.RUTA_EMPLEADOS).Sheets["Hoja1"]
    empleadosCache = XLSX.utils.sheet_to_json(sheet);
    console.log("Empleados cargados:", empleadosCache.length)
  } catch (error) {
    console.error("Error al cargar empleados:", error)
  }
}

function buscarEmpleado(numero) {
  return empleadosCache.find((e) => {
    return e.telefono == numero;
  });
}

module.exports = { buscarEmpleado, cargarEmpleados };
