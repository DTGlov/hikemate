import { Text, View } from 'react-native';

type Props = {
  label: string;
  value: string;
  suffix?: string;
};

export function StatPill({ label, value, suffix }: Props): React.JSX.Element {
  return (
    <View
      style={{
        flex: 1,
        height: 80,
        borderRadius: 12,
        padding: 12,
        backgroundColor: '#f3f4f6',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: '500',
            color: '#111827',
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
        {suffix ? (
          <Text style={{ fontSize: 14, color: '#6b7280' }} numberOfLines={1}>
            {suffix}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '500',
          color: '#6b7280',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
