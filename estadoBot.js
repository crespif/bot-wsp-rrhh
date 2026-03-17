const chatsHumanos = new Set()
const consultasActivas = new Map()

function activarModoHumano(numero, empleado) {
    chatsHumanos.add(numero)
    consultasActivas.set(numero, empleado)
}

function desactivarModoHumano(numero) {
    chatsHumanos.delete(numero)
    consultasActivas.delete(numero)
}

function estaModoHumano(numero) {
    return chatsHumanos.has(numero)
}

/* Obtiene todas las consultas */
function getConsultas() {
    // si consultas está vacía, devuelve null para no mostrar nada en el panel
    if (consultasActivas.size === 0) return null
    return Array.from(consultasActivas.entries())
}

/* Devolver si existe una consulta activa para ese numero */
function isHasConsulta(numero) {
    return consultasActivas.has(numero);
}

module.exports = {
    activarModoHumano,
    desactivarModoHumano,
    estaModoHumano,
    getConsultas,
    isHasConsulta
}