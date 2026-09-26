import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { KeyboardAwareScroll } from './KeyboardAwareScroll';

interface ScreenProps {
  /** false cuando la pantalla ya tiene encabezado de navegación (Stack). */
  topInset?: boolean;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}

/** Contenedor estándar de pantalla: área segura, encabezado y scroll que respeta el teclado. */
export function Screen({ topInset = true, title, subtitle, headerRight, children }: ScreenProps) {
  const c = useTheme();
  return (
    <SafeAreaView
      edges={topInset ? ['top', 'left', 'right'] : ['left', 'right']}
      style={[styles.root, { backgroundColor: c.background }]}>
      <KeyboardAwareScroll contentContainerStyle={styles.content}>
        {title || subtitle ? (
          <View style={styles.header}>
            <View style={styles.headerText}>
              {title ? <AppText variant="title">{title}</AppText> : null}
              {subtitle ? <AppText muted>{subtitle}</AppText> : null}
            </View>
            {headerRight}
          </View>
        ) : null}
        {children}
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  headerText: { flex: 1, gap: 2 },
});
