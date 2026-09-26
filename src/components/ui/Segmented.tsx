import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

interface SegmentedProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string | number>({ options, value, onChange }: SegmentedProps<T>) {
  const c = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: c.surfaceMuted }]} accessibilityRole="tablist">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.item, selected && { backgroundColor: c.surface }]}>
            <AppText variant="label" color={selected ? c.text : c.textMuted}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', padding: 3, borderRadius: Radius.md, gap: 3 },
  item: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.sm },
});
