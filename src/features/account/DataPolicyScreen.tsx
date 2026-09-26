import { StyleSheet, View } from 'react-native';

import { AppText, Card, Screen, SectionHeader } from '@/components/ui';
import { DATA_POLICY } from '@/services/account/dataPolicy';
import { Spacing, useTheme } from '@/theme';

/** Política de tratamiento de datos (Ley 1581): siempre disponible, con o sin sesión. */
export function DataPolicyScreen() {
  const c = useTheme();
  return (
    <Screen topInset={false} subtitle={DATA_POLICY.summary}>
      {DATA_POLICY.sections.map((section) => (
        <Card key={section.title} style={styles.section}>
          <SectionHeader title={section.title} />
          {section.paragraphs.map((p) =>
            section.paragraphs.length > 1 ? (
              <View key={p} style={styles.bullet}>
                <View style={[styles.dot, { backgroundColor: c.primary }]} />
                <AppText style={styles.flex}>{p}</AppText>
              </View>
            ) : (
              <AppText key={p}>{p}</AppText>
            ),
          )}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  flex: { flex: 1 },
});
