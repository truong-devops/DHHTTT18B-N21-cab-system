import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { OpaqueColorValue, StyleProp, TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];
type IconMapping = Record<string, MaterialIconName>;

const MAPPING = {
  'house.fill': 'home',
  speedometer: 'speed',
  'car.fill': 'directions-car',
  'clock.fill': 'schedule',
  'creditcard.fill': 'account-balance-wallet',
  'person.fill': 'person',
  'ticket.fill': 'local-offer',
  'location.fill': 'place',
  'pin.fill': 'location-on',
  'flash.fill': 'bolt',
  'gift.fill': 'card-giftcard',
  'motorbike.fill': 'two-wheeler',
  'apps.fill': 'apps',
  'edit.fill': 'edit'
} as const satisfies IconMapping;

export type IconSymbolName = keyof typeof MAPPING;

type Props = {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
};

export function IconSymbol({ name, size = 24, color, style }: Props) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
