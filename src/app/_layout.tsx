import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, LogBox } from 'react-native';

import { bootstrapSession, refreshProfileQuietly } from '@/features/account/session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { stopFarm } from '@/services/runtime';
import { useAccess, useAuthStore } from '@/store/useAuthStore';
import { useTheme } from '@/theme';

// Avisos conocidos e inofensivos de three.js/expo-gl en desarrollo.
LogBox.ignoreLogs(['THREE.Clock', 'EXGL: gl.pixelStorei']);

// La pantalla de inicio sigue visible hasta saber si hay sesión (no se ve el ingreso un instante).
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useTheme();
  const access = useAccess();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const staff = useAuthStore((s) => s.profile?.role === 'admin' || s.profile?.role === 'installer');

  useEffect(() => {
    void bootstrapSession();
    // Al volver a primer plano se revisa la cuenta (contraseña restablecida, pagos registrados).
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshProfileQuietly();
    });
    return () => {
      subscription.remove();
      stopFarm();
    };
  }, []);

  useEffect(() => {
    if (access !== 'loading') SplashScreen.hide();
  }, [access]);

  // Cada grupo solo existe en su estado; al cambiar el estado, la navegación se ajusta sola.
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
        <Stack.Protected guard={access === 'app'}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Inicio' }} />
          <Stack.Screen name="sensor/[kind]" options={{ title: '' }} />
          <Stack.Screen name="automation" options={{ title: 'Control de equipos' }} />
          <Stack.Screen name="demo" options={{ title: 'Modo demo' }} />
          <Stack.Screen name="settings" options={{ title: 'Configuración' }} />
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="change-password" options={{ title: 'Contraseña' }} />
          </Stack.Protected>
          <Stack.Protected guard={staff}>
            <Stack.Screen name="accounts/index" options={{ title: 'Clientes' }} />
            <Stack.Screen name="accounts/new" options={{ title: 'Nueva cuenta' }} />
            <Stack.Screen name="accounts/[id]" options={{ title: '' }} />
          </Stack.Protected>
        </Stack.Protected>

        {/* Solo mientras falte cambiar la contraseña inicial: al guardarla la ruta deja de existir
            y la navegación lleva sola al inicio. No compartir rutas entre estados, o no redirige. */}
        <Stack.Protected guard={access === 'changePassword'}>
          <Stack.Screen name="password-setup" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={access === 'blocked'}>
          <Stack.Screen name="blocked" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={access === 'signedOut' || access === 'loading'}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
