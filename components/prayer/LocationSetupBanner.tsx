import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Brand } from '@/constants/theme';
import type { Coordinates } from '@/lib/location';
import { isValidManualCity, requestDeviceLocation } from '@/lib/location';

export type LocationSource =
  | { type: 'coords'; coords: Coordinates }
  | { type: 'city'; city: string; country: string };

interface LocationSetupBannerProps {
  onLocationResolved: (source: LocationSource) => void;
}

/**
 * Non-blocking per the spec: if location is unresolved, this renders as a
 * small banner rather than a full-screen gate. GPS is offered first;
 * denying or failing falls through to a manual city/country form.
 */
export function LocationSetupBanner({ onLocationResolved }: LocationSetupBannerProps) {
  const [requesting, setRequesting] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleUseGps = async () => {
    setRequesting(true);
    setError(null);
    const result = await requestDeviceLocation();
    setRequesting(false);

    if (result.status === 'granted') {
      onLocationResolved({ type: 'coords', coords: result.coords });
      return;
    }
    if (result.status === 'denied') {
      setShowManualForm(true);
      return;
    }
    // unavailable — e.g. GPS hardware/service error
    setError('Could not get your location. Try entering your city instead.');
    setShowManualForm(true);
  };

  const handleManualSubmit = () => {
    const input = { city: city.trim(), country: country.trim() };
    if (!isValidManualCity(input)) {
      setError('Enter both a city and a country.');
      return;
    }
    setError(null);
    onLocationResolved({ type: 'city', city: input.city, country: input.country });
  };

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Set your location for accurate prayer times</Text>

      {!showManualForm && (
        <Pressable
          onPress={handleUseGps}
          disabled={requesting}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          accessibilityRole="button">
          {requesting ? (
            <ActivityIndicator size="small" color={Brand.paper} />
          ) : (
            <Text style={styles.primaryButtonText}>Use my location</Text>
          )}
        </Pressable>
      )}

      {showManualForm && (
        <View style={styles.manualForm}>
          <TextInput
            style={styles.input}
            placeholder="City"
            placeholderTextColor={Brand.muted}
            value={city}
            onChangeText={setCity}
            accessibilityLabel="City"
          />
          <TextInput
            style={styles.input}
            placeholder="Country"
            placeholderTextColor={Brand.muted}
            value={country}
            onChangeText={setCountry}
            accessibilityLabel="Country"
          />
          <Pressable
            onPress={handleManualSubmit}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Set location</Text>
          </Pressable>
          <Pressable onPress={handleUseGps} accessibilityRole="button">
            <Text style={styles.linkText}>Try GPS again</Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Brand.paperDeep,
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.ink,
  },
  primaryButton: {
    backgroundColor: Brand.ink,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: Brand.paper,
    fontWeight: '600',
    fontSize: 14,
  },
  manualForm: {
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Brand.ink,
    backgroundColor: Brand.paper,
  },
  linkText: {
    fontSize: 13,
    color: Brand.muted,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  errorText: {
    fontSize: 12,
    color: Brand.muted,
  },
});
