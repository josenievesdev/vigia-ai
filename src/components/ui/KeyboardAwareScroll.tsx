import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';

import { KEYBOARD_GAP, keyboardPadding, revealDelta } from './keyboardMath';

/** Lo mínimo que se necesita de un campo para ubicarlo en la pantalla. */
interface Measurable {
  measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
}

export interface KeyboardFocus {
  focus(field: Measurable | null): void;
  blur(field: Measurable | null): void;
}

/** Los campos avisan a su zona de scroll cuándo se enfocan, para quedar a la vista sobre el teclado. */
const KeyboardFocusContext = createContext<KeyboardFocus | null>(null);

export function useKeyboardFocus(): KeyboardFocus | null {
  return useContext(KeyboardFocusContext);
}

const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
/** Espera a que se aplique el espacio extra antes de desplazar (ms). */
const SETTLE_MS = Platform.OS === 'ios' ? 120 : 60;

/**
 * ScrollView para pantallas con formularios: reserva al final el espacio que tapa el teclado y
 * lleva el campo que se está escribiendo justo encima de él. Tocar un botón con el teclado abierto
 * funciona al primer toque. Sin librerías nativas: funciona en Expo Go. En la web no hace falta
 * (el navegador ya lo resuelve), así que no escucha el teclado.
 */
export function KeyboardAwareScroll({
  children,
  contentContainerStyle,
  ...rest
}: ScrollViewProps & { children: ReactNode }) {
  const frameRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  /** Borde superior del teclado en la ventana; null si está cerrado. */
  const keyboardTop = useRef<number | null>(null);
  /** Campo que se está escribiendo. */
  const active = useRef<Measurable | null>(null);
  const [padding, setPadding] = useState(0);

  // Solo leen refs y se llaman desde eventos, nunca durante el render.
  const measurePadding = useCallback(() => {
    const top = keyboardTop.current;
    const frame = frameRef.current;
    if (top === null || !frame) {
      setPadding(0);
      return;
    }
    frame.measureInWindow((_x, y, _w, h) => setPadding(keyboardPadding(y + h, top)));
  }, []);

  const reveal = useCallback(() => {
    const top = keyboardTop.current;
    const field = active.current;
    if (top === null || !field) return;
    field.measureInWindow((_x, y, _w, h) => {
      const delta = revealDelta(y, y + h, top);
      if (delta !== 0) scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + delta), animated: true });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const shown = Keyboard.addListener(SHOW_EVENT, (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      measurePadding();
      setTimeout(reveal, SETTLE_MS);
    });
    const hidden = Keyboard.addListener(HIDE_EVENT, () => {
      keyboardTop.current = null;
      setPadding(0);
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [measurePadding, reveal]);

  const focus = useMemo<KeyboardFocus>(
    () => ({
      focus: (field) => {
        active.current = field;
        // Con el teclado ya abierto (al pasar de un campo a otro) no llega otro aviso del teclado.
        if (keyboardTop.current !== null) setTimeout(reveal, SETTLE_MS);
      },
      blur: (field) => {
        if (active.current === field) active.current = null;
      },
    }),
    [reveal],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  };

  /** Si el sistema cambia el tamaño de la ventana con el teclado abierto, se recalcula el espacio. */
  const onLayout = () => {
    if (keyboardTop.current !== null) measurePadding();
  };

  return (
    <KeyboardFocusContext.Provider value={focus}>
      <View ref={frameRef} style={styles.frame} onLayout={onLayout} collapsable={false}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
          scrollEventThrottle={16}
          onScroll={onScroll}
          {...rest}
          contentContainerStyle={[contentContainerStyle, padding > 0 && { paddingBottom: padding + KEYBOARD_GAP }]}>
          {children}
        </ScrollView>
      </View>
    </KeyboardFocusContext.Provider>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
});
