import { useColorScheme } from 'react-native';
import { colors } from './tokens';

export const darkColors = {
  ...colors,
  bg: '#0B1220',
  surface: '#121A2B',
  surface2: '#1A2437',
  card: '#121A2B',
  border: '#2C3A55',
  text: '#F3F4F6',
  muted: '#A0AEC0',
  white: '#FFFFFF'
};

export const lightColors = colors;

export function useAppPalette() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}
