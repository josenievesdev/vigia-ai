import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, TextField } from '@/components/ui';
import { type FarmLocation, formatLocation } from '@/domain/location';
import { searchPlaces } from '@/services/weather/geocoding';
import { Radius, Spacing, useTheme } from '@/theme';

interface LocationPickerProps {
  value: FarmLocation;
  onChange: (location: FarmLocation) => void;
}

/** "Municipio de Montería · Colombia · 29 m": distingue lugares con el mismo nombre. */
function placeDetail(place: FarmLocation): string {
  return [place.district, place.country, `${Math.round(place.elevation)} m`].filter(Boolean).join(' · ');
}

/** Busca la ciudad de la granja (Open-Meteo Geocoding) para el clima y el sol reales. */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const c = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FarmLocation[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = () => {
    setSearching(true);
    setError(null);
    searchPlaces(query)
      .then((found) => {
        setResults(found);
        if (!found.length) setError('No se encontraron lugares con ese nombre.');
      })
      .catch(() => setError('No se pudo buscar: revisa la conexión.'))
      .finally(() => setSearching(false));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.current, { backgroundColor: c.surfaceMuted }]}>
        <Icon name="map-marker-outline" size={20} color={c.primary} />
        <View style={styles.flex}>
          <AppText variant="label">{formatLocation(value)}</AppText>
          <AppText variant="caption" muted>
            {placeDetail(value)} · {value.latitude.toFixed(3)}, {value.longitude.toFixed(3)}
          </AppText>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.flex}>
          <TextField
            label="Buscar otra ubicación"
            value={query}
            onChangeText={setQuery}
            placeholder="Ej.: Montería, Bucaramanga…"
            returnKeyType="search"
            onSubmitEditing={search}
            autoCorrect={false}
          />
        </View>
        <Pressable
          onPress={search}
          disabled={searching || query.trim().length < 2}
          accessibilityRole="button"
          accessibilityLabel="Buscar ubicación"
          style={[styles.searchButton, { backgroundColor: c.primarySoft, opacity: query.trim().length < 2 ? 0.5 : 1 }]}>
          {searching ? <ActivityIndicator /> : <Icon name="magnify" size={20} color={c.primary} />}
        </Pressable>
      </View>

      {error ? (
        <AppText variant="caption" color={c.warning}>
          {error}
        </AppText>
      ) : null}

      {results?.map((place) => (
        <Pressable
          key={`${place.latitude},${place.longitude}`}
          onPress={() => {
            onChange(place);
            setResults(null);
            setQuery('');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.result, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
          <AppText variant="label">{formatLocation(place)}</AppText>
          <AppText variant="caption" muted>
            {placeDetail(place)}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.sm },
  flex: { flex: 1 },
  current: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  searchButton: { width: 44, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  result: { padding: Spacing.sm, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
});
