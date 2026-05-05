import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/Button';

type Props = {
  /** Currently-selected start time, or null when "Optional". */
  value: Date | null;
  onChange: (next: Date | null) => void;
  /** Optional label override. Defaults to "Start time". */
  label?: string;
};

function formatStartTime(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Phase 8 — optional crew start-time field. Tapping the row opens a
 * native date+time picker. The "Clear" affordance reverts back to
 * "Optional" so a host can change their mind.
 */
export function StartTimePicker({
  value,
  onChange,
  label = 'Start time',
}: Props): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(value);

  const open = (): void => {
    setDraft(value ?? defaultDraft());
    setIsOpen(true);
  };

  const cancel = (): void => {
    setDraft(value);
    setIsOpen(false);
  };

  const confirm = (): void => {
    if (draft) onChange(draft);
    setIsOpen(false);
  };

  const clear = (): void => {
    onChange(null);
  };

  // Android shows the picker as a modal dialog managed by the OS — fire,
  // capture, close. iOS gets an inline spinner inside our own modal.
  const handleAndroidChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ): void => {
    if (event.type === 'dismissed' || !selected) {
      cancel();
      return;
    }
    onChange(selected);
    setIsOpen(false);
  };

  const valueLabel = value ? formatStartTime(value) : 'Optional';

  return (
    <View style={{ gap: 6 }}>
      <Text className="font-medium text-sm text-gray-700">{label}</Text>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit start time"
          onPress={open}
          style={({ pressed }) => ({
            flex: 1,
            height: 48,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#d1d5db',
            backgroundColor: pressed ? '#f9fafb' : '#ffffff',
          })}
        >
          <Text
            style={{
              fontSize: 16,
              color: value ? '#111827' : '#9ca3af',
            }}
          >
            {valueLabel}
          </Text>
          <Ionicons name="time-outline" size={18} color="#6b7280" />
        </Pressable>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear start time"
            onPress={clear}
            style={({ pressed }) => ({
              height: 48,
              paddingHorizontal: 12,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              backgroundColor: pressed ? '#f3f4f6' : 'transparent',
            })}
          >
            <Text style={{ color: '#6b7280', fontSize: 14 }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {Platform.OS === 'android' && isOpen ? (
        <DateTimePicker
          value={draft ?? defaultDraft()}
          mode="datetime"
          minimumDate={new Date()}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={isOpen}
          animationType="slide"
          transparent
          onRequestClose={cancel}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
          >
            <View
              style={{
                backgroundColor: '#ffffff',
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 32,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                gap: 12,
              }}
            >
              <View style={{ alignItems: 'center', marginBottom: 4 }}>
                <View
                  style={{
                    height: 4,
                    width: 48,
                    borderRadius: 999,
                    backgroundColor: '#d1d5db',
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#111827',
                  textAlign: 'center',
                }}
              >
                Choose start time
              </Text>
              <DateTimePicker
                value={draft ?? defaultDraft()}
                mode="datetime"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_, selected) => {
                  if (selected) setDraft(selected);
                }}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={cancel}
                    style={({ pressed }) => ({
                      height: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 12,
                      backgroundColor: pressed ? '#e5e7eb' : '#f3f4f6',
                    })}
                  >
                    <Text
                      style={{
                        color: '#111827',
                        fontWeight: '600',
                        fontSize: 16,
                      }}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Set" onPress={confirm} />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function defaultDraft(): Date {
  // Default to one hour from now, rounded up to the next 5-min mark.
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const ms = 5 * 60 * 1000;
  return new Date(Math.ceil(d.getTime() / ms) * ms);
}
