import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { useFarmStore } from '@/store/useFarmStore';
import { useTheme } from '@/theme';

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon name={name} size={size} color={color} />;
  };
}

export default function TabsLayout() {
  const c = useTheme();
  const alertCount = useFarmStore((s) => s.alerts.length);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: tabIcon('view-dashboard-outline') }} />
      <Tabs.Screen name="twin" options={{ title: 'Gemelo', tabBarIcon: tabIcon('cube-outline') }} />
      <Tabs.Screen name="production" options={{ title: 'Producción', tabBarIcon: tabIcon('egg-outline') }} />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertas',
          tabBarIcon: tabIcon('bell-outline'),
          tabBarBadge: alertCount || undefined,
          tabBarBadgeStyle: { backgroundColor: c.critical },
        }}
      />
      <Tabs.Screen name="more" options={{ title: 'Más', tabBarIcon: tabIcon('dots-horizontal-circle-outline') }} />
    </Tabs>
  );
}
