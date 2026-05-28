import { View, StyleSheet, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { DS } from '../designSystem';

type Props = {
  value: string;
};

/** Renders a scannable QR for check-in tokens. */
export function BookingQrCode({ value }: Props) {
  const { width } = useWindowDimensions();
  const size = Math.min(200, Math.floor(width * 0.45));
  return (
    <View style={styles.wrap} accessibilityLabel="Booking check-in QR code">
      <QRCode value={value} size={size} backgroundColor="#FFFFFF" color="#0A0A0A" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: DS.space.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
});
