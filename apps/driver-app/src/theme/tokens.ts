export const colors = {
  brand600: '#FF3B1D',
  brand700: '#E03218',
  brand800: '#B92512',
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surface2: '#F4F5F7',
  border: '#D0D5DD',
  text: '#111827',
  muted: '#4B5563',
  success: '#16A34A',
  danger: '#DC2626',
  info: '#2563EB',
  warning: '#F59E0B'
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
}

export const radius = {
  card: 8,
  button: 10,
  input: 10,
  pill: 999
}

export const typography = {
  title: { fontSize: 20, lineHeight: 24, fontWeight: '600' as const },
  h2: { fontSize: 16, lineHeight: 20, fontWeight: '600' as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const }
}

export const shadow = {
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }
  },
  android: {
    elevation: 2
  }
}

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  shadow
}
