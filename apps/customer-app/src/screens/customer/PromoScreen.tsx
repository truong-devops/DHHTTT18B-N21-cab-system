import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/common/Card';
import { colors, spacing, typography } from '../../theme/tokens';
import { IconSymbol, type IconSymbolName } from '../../components/ui/icon-symbol';

const promos: { id: string; title: string; desc: string; color: string; icon: IconSymbolName }[] = [
  { id: 'p1', title: 'Giam 20% chuyen tiep theo', desc: 'Ap dung moi khung gio', color: '#FFF4F1', icon: 'flash.fill' },
  { id: 'p2', title: 'Mien phi 1km dau', desc: 'Xe may gio thap diem', color: '#F4F7FF', icon: 'motorbike.fill' },
  { id: 'p3', title: 'Tang 50K cho ban moi', desc: 'Nhap ma WELCOME50', color: '#FFF8E6', icon: 'gift.fill' }
];

const PromoScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Uu dai</Text>
      {promos.map((p) => (
        <Card key={p.id} style={[styles.card, { backgroundColor: p.color }]}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <IconSymbol name={p.icon} size={20} color={colors.brand700} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{p.title}</Text>
              <Text style={styles.desc}>{p.desc}</Text>
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  card: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardTitle: { ...typography.h2, color: colors.text },
  desc: { ...typography.body, color: colors.muted }
});

export default PromoScreen;
