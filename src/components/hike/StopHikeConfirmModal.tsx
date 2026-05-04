import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import {
  enqueue as enqueueOutbox,
  getOutbox,
  uuidV4,
  type OutboxedHikePayload,
} from '@/lib/hikeOutbox';
import { fetchOnlineState } from '@/lib/netinfo';
import { supabase } from '@/lib/supabase';
import { formatDistance, formatDuration, formatElevation } from '@/lib/units';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHikeTrackingStore } from '@/stores/useHikeTrackingStore';
import { useOfflineStore } from '@/stores/useOfflineStore';
import { useProfileStore } from '@/stores/useProfileStore';

const SHORT_HIKE_THRESHOLD_M = 50;

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function StopHikeConfirmModal({
  visible,
  onClose,
}: Props): React.JSX.Element {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const unitSystem = useProfileStore((s) => s.profile?.unit_system ?? 'metric');

  const finalizeHike = useHikeTrackingStore((s) => s.finalizeHike);
  const markSaving = useHikeTrackingStore((s) => s.markSaving);
  const resetHike = useHikeTrackingStore((s) => s.resetHike);
  const stats = useHikeTrackingStore((s) => s.stats);

  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isShortHike = stats.distanceMeters < SHORT_HIKE_THRESHOLD_M;

  const handleSave = async (): Promise<void> => {
    if (!userId) {
      setError('Not signed in.');
      return;
    }
    const draft = finalizeHike();
    if (!draft) {
      setError('Nothing to save — no GPS points captured yet.');
      return;
    }

    setIsSaving(true);
    setError(null);
    markSaving();

    const startedAtIso = new Date(draft.startedAtMs).toISOString();
    const endedAtIso = new Date(draft.endedAtMs).toISOString();
    const finalName =
      name.trim() || `Hike on ${format(draft.startedAtMs, 'PP')}`;

    // Generate the row id locally so the outbox identity equals the
    // server row identity if we have to fall back to offline save.
    const payload: OutboxedHikePayload = {
      id: uuidV4(),
      user_id: userId,
      name: finalName,
      started_at: startedAtIso,
      ended_at: endedAtIso,
      duration_seconds: draft.durationSeconds,
      distance_meters: draft.distanceMeters,
      elevation_gain_meters: draft.elevationGainMeters,
      elevation_loss_meters: draft.elevationLossMeters,
      path: draft.path,
      bounding_box: draft.bounding_box,
    };

    const queueAndExit = async (reason: string): Promise<void> => {
      await enqueueOutbox(payload);
      const items = await getOutbox();
      useOfflineStore.getState().setOutboxCount(items.length);
      setIsSaving(false);
      resetHike();
      onClose();
      console.log('[outbox] queued hike for sync:', reason);
      router.replace('/(tabs)/hikes');
    };

    const online = await fetchOnlineState();
    if (!online) {
      await queueAndExit('offline');
      return;
    }

    const { error: insertError } = await supabase.from('hikes').insert(payload);

    if (insertError) {
      // Network round-tripped but the DB rejected. Could be transient
      // (rate-limit, RLS race) — queue rather than lose the data. The
      // user can retry from the outbox banner if it's a permanent
      // failure surfaced by attemptCount climbing.
      await queueAndExit(`insert error: ${insertError.message}`);
      return;
    }

    setIsSaving(false);
    resetHike();
    onClose();
    router.replace(`/hike/${payload.id}`);
  };

  const handleDiscard = (): void => {
    Alert.alert(
      'Discard hike?',
      'This will delete the hike permanently. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            resetHike();
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="rounded-t-3xl bg-white p-6 pb-10">
          <View className="mb-4 items-center">
            <View className="h-1 w-12 rounded-full bg-gray-300" />
          </View>
          <Text className="text-2xl font-bold text-gray-900">
            Save this hike?
          </Text>

          {isShortHike ? (
            <View className="mt-3 rounded-xl bg-amber-50 px-4 py-3">
              <Text className="text-sm text-amber-900">
                This hike is very short (
                {formatDistance(stats.distanceMeters, unitSystem)}). You may
                want to discard it.
              </Text>
            </View>
          ) : null}

          <View className="mt-4 flex-row justify-between rounded-xl bg-gray-50 p-4">
            <SummaryStat
              label="Distance"
              value={formatDistance(stats.distanceMeters, unitSystem)}
            />
            <SummaryStat
              label="Duration"
              value={formatDuration(stats.durationSeconds)}
            />
            <SummaryStat
              label="Elevation"
              value={formatElevation(stats.elevationGainMeters, unitSystem)}
            />
          </View>

          <View className="mt-5 gap-1.5">
            <Text className="text-sm font-medium text-gray-700">
              Name (optional)
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={`Hike on ${format(Date.now(), 'PP')}`}
              placeholderTextColor="#9ca3af"
              className="h-12 rounded-xl border border-gray-300 bg-white px-3.5 text-base text-gray-900"
            />
          </View>

          {error ? (
            <Text className="mt-3 text-sm text-red-600">{error}</Text>
          ) : null}

          <View className="mt-6 gap-3">
            <Button
              label="Save Hike"
              onPress={handleSave}
              isLoading={isSaving}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleDiscard}
              disabled={isSaving}
              className="h-12 items-center justify-center rounded-xl active:bg-red-50"
            >
              <Text className="text-base font-semibold text-red-600">
                Discard
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              disabled={isSaving}
              className="h-12 items-center justify-center"
            >
              <Text className="text-base text-gray-600">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View className="items-center">
      <Text className="text-base font-semibold text-gray-900">{value}</Text>
      <Text className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </Text>
    </View>
  );
}
