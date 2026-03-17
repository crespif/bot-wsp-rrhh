const fs = require("fs");
const config = require("./config");

const esDocker = process.env.DOCKER === "true";

async function obtenerLicencias() {
  if (esDocker) {
    // ── Linux / Docker: usar mdb-reader (JavaScript puro, sin drivers Windows) ──
    const MDBReader = require("mdb-reader");
    const buffer = fs.readFileSync(config.RUTA_ACCESS);
    const reader = new MDBReader(buffer);
    const table = reader.getTable(config.TABLA_LICENCIAS);
    return table.getData();
  } else {
    // ── Windows / desarrollo local: usar node-adodb con ACE.OLEDB ──
    const ADODB = require("node-adodb");
    const connection = ADODB.open(
      `Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${config.RUTA_ACCESS};Persist Security Info=False;`
    );
    return await connection.query(`SELECT * FROM ${config.TABLA_LICENCIAS}`);
  }
}

module.exports = { obtenerLicencias };
