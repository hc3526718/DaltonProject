import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { DS } from '../designSystem';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  inputStyle?: object;
};

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: { types?: string[]; fields?: string[] },
          ) => {
            addListener: (event: string, handler: () => void) => void;
            getPlace: () => { formatted_address?: string; name?: string };
          };
        };
      };
    };
  }
}

function mapsKey(): string {
  return (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();
}

function loadPlacesScript(): Promise<void> {
  const key = mapsKey();
  if (!key) return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  const existing = document.querySelector('script[data-dga-places]');
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    s.async = true;
    s.defer = true;
    s.dataset.dgaPlaces = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google Maps script failed'));
    document.head.appendChild(s);
  });
}

/** Venue field with Google Places suggestions on web when `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set. */
export function PlacesAutocompleteField({ value, onChangeText, placeholder, inputStyle }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [ready, setReady] = useState(Platform.OS !== 'web' || !mapsKey());

  useEffect(() => {
    if (Platform.OS !== 'web' || !mapsKey()) return;
    let cancelled = false;
    void loadPlacesScript()
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ['establishment', 'geocode'],
          fields: ['formatted_address', 'name'],
        });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          const label = place.formatted_address || place.name || inputRef.current?.value || '';
          if (label) onChangeText(label);
        });
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, [onChangeText]);

  if (Platform.OS !== 'web' || !mapsKey()) {
    return (
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={DS.color.textMuted}
        style={[styles.input, inputStyle]}
      />
    );
  }

  return (
    <View>
      {/* eslint-disable-next-line react/forbid-elements */}
      <input
        ref={(el) => {
          inputRef.current = el;
          if (el && el.value !== value) el.value = value;
        }}
        defaultValue={value}
        placeholder={placeholder}
        onChange={(e) => onChangeText(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(0,0,0,0.35)',
          color: '#D4D0C8',
          fontSize: 15,
          fontFamily: 'DM Sans, system-ui, sans-serif',
          boxSizing: 'border-box',
        }}
        autoComplete="off"
      />
      {!ready ? (
        <Text style={styles.loading}>Loading location suggestions…</Text>
      ) : (
        <Text style={styles.hint}>Start typing for venue suggestions (Google Maps).</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
    borderRadius: DS.radius.lg,
    paddingHorizontal: DS.space.md,
    paddingVertical: 12,
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.text,
    backgroundColor: DS.color.surface,
  },
  hint: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
    marginTop: DS.space.xs,
  },
  loading: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.gold,
    marginTop: DS.space.xs,
  },
});
