import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { getFarmRuntime } from '@/services/runtime';
import { useTheme } from '@/theme';

// Avisos conocidos e inofensivos de three.js/expo-gl en desarrollo.
LogBox.ignoreLogs(['THREE.Clock', 'EXGL: gl.pixelStorei']);

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useTheme();

  useEffect(() => {
    getFarmRuntime()
      .start()
      .catch((error) => console.warn('[VigíaAI] No se pudo iniciar la telemetría', error));
    // Se detiene el runtime vigente (puede haber cambiado de modo desde la pestaña Demo).
    return () => getFarmRuntime().stop();
  }, []);

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Inicio' }} />
        <Stack.Screen name="sensor/[kind]" options={{ title: '' }} />
      </Stack>
    </ThemeProvider>
  );
}
