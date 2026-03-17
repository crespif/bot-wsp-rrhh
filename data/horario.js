const horario = {
    inicio: "07:00",
    fin: "14:00"
}

function estaFueraDeHorario() {
    const horaActual = new Date().getHours();
    const minutoActual = new Date().getMinutes();
    const horaInicio = parseInt(horario.inicio.split(":")[0]);
    const minutoInicio = parseInt(horario.inicio.split(":")[1]);
    const horaFin = parseInt(horario.fin.split(":")[0]);
    const minutoFin = parseInt(horario.fin.split(":")[1]);
    const horaActualTotal = horaActual * 60 + minutoActual;
    const horaInicioTotal = horaInicio * 60 + minutoInicio;
    const horaFinTotal = horaFin * 60 + minutoFin;
    return horaActualTotal < horaInicioTotal || horaActualTotal > horaFinTotal;
}

function cambiarHorario(inicio, fin) {
    horario.inicio = inicio;
    horario.fin = fin;
}

module.exports = { horario, estaFueraDeHorario, cambiarHorario }
/* 
<form action="/api/horario" method="post" style="display: flex; gap: 10px; align-items: center; justify-content: center; background-color: #f5f5f5; padding: 10px; border-radius: 5px;">
        <label for="inicio" style="font-size: 16px;">Horario:</label>
        <input type="time" id="inicio" name="inicio" value="${horario.inicio}" style="padding: 10px; border-radius: 5px; border: 1px solid #ccc;">
        <label for="fin" style="font-size: 16px;">a:</label>
        <input type="time" id="fin" name="fin" value="${horario.fin}" style="padding: 10px; border-radius: 5px; border: 1px solid #ccc;">
        <button type="submit" style="padding: 10px; background: #40c351; color: white; border: none; border-radius: 5px; cursor: pointer;">💾 Guardar</button>
      </form> */