import { KEYBOARD_GAP, keyboardPadding, revealDelta, TOP_MARGIN } from '../keyboardMath';

describe('teclado sobre los formularios', () => {
  // Pantalla de 800 px de alto con un teclado de 300 px: el teclado empieza en y = 500.
  const keyboardTop = 500;

  it('sube el contenido lo justo cuando el teclado tapa el campo', () => {
    // Campo de 40 px en y = 600 (detrás del teclado).
    expect(revealDelta(600, 640, keyboardTop)).toBe(640 + KEYBOARD_GAP - keyboardTop);
    // Campo que apenas roza el teclado.
    expect(revealDelta(440, 480, keyboardTop)).toBe(4);
  });

  it('no mueve nada si el campo ya se ve', () => {
    expect(revealDelta(300, 340, keyboardTop)).toBe(0);
  });

  it('baja el contenido si el campo quedó escondido arriba', () => {
    expect(revealDelta(20, 60, keyboardTop)).toBe(20 - TOP_MARGIN);
  });

  it('reserva al final solo el espacio que el teclado tapa', () => {
    // iOS: la zona de scroll llega al borde inferior (800): el teclado tapa 300 px.
    expect(keyboardPadding(800, keyboardTop)).toBe(300);
    // Android que ya encogió la ventana: la zona termina donde empieza el teclado.
    expect(keyboardPadding(500, keyboardTop)).toBe(0);
    expect(keyboardPadding(480, keyboardTop)).toBe(0);
  });
});
