import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { getFarmRuntime } from '@/services/runtime';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useTheme();

  useEffect(() => {
    const runtime = getFarmRuntime();
    runtime.start().catch((error) => console.warn('[VigíaAI] No se pudo iniciar la telemetría', error));
    return () => runtime.stop();
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
