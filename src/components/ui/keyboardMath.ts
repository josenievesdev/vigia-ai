/** Espacio entre el campo que se escribe y el borde del teclado (px). */
export const KEYBOARD_GAP = 24;
/** Por encima de esto el campo quedaría bajo la barra superior (px desde arriba de la ventana). */
export const TOP_MARGIN = 96;

/**
 * Cuánto desplazar el contenido para que el campo [fieldTop, fieldBottom] quede visible entre la
 * parte de arriba y el teclado (coordenadas de ventana). Positivo: subir el contenido; 0: ya se ve.
 */
export function revealDelta(fieldTop: number, fieldBottom: number, keyboardTop: number): number {
  const hiddenBelow = fieldBottom + KEYBOARD_GAP - keyboardTop;
  if (hiddenBelow > 0) return hiddenBelow;
  if (fieldTop < TOP_MARGIN) return fieldTop - TOP_MARGIN;
  return 0;
}

/**
 * Espacio extra al final del contenido: la parte de la zona de scroll que el teclado tapa.
 * Si el sistema ya encogió la ventana (Android con "resize"), no tapa nada y da 0.
 */
export function keyboardPadding(frameBottom: number, keyboardTop: number): number {
  return Math.max(0, Math.round(frameBottom - keyboardTop));
}
