// Las pruebas usan horas locales de la granja (Valledupar, UTC−5). Se fija la
// zona horaria para que los resultados no dependan de la máquina.
module.exports = () => {
  process.env.TZ = 'America/Bogota';
};
