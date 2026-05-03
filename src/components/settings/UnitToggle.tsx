import { Pressable, Text, View } from 'react-native';

import type { UnitSystem } from '@/lib/units';
import { useProfileStore } from '@/stores/useProfileStore';

const OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric (km, m)' },
  { value: 'imperial', label: 'Imperial (mi, ft)' },
];

export function UnitToggle(): React.JSX.Element {
  const unitSystem = useProfileStore((s) => s.profile?.unit_system ?? 'metric');
  const updateUnitSystem = useProfileStore((s) => s.updateUnitSystem);

  return (
    <View className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {OPTIONS.map((option, idx) => {
        const isSelected = option.value === unitSystem;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            onPress={() => void updateUnitSystem(option.value)}
            className={`flex-row items-center justify-between px-4 py-4 active:bg-gray-50 ${
              idx === 0 ? 'border-b border-gray-100' : ''
            }`}
          >
            <Text className="text-base text-gray-900">{option.label}</Text>
            {isSelected ? (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-teal-700">
                <View className="h-2 w-2 rounded-full bg-white" />
              </View>
            ) : (
              <View className="h-5 w-5 rounded-full border border-gray-300" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
