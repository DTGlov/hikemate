import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar/Avatar';
import { StatPill } from '@/components/profile/StatPill';
import { OfflineMapsSection } from '@/components/settings/OfflineMapsSection';
import { UnitToggle } from '@/components/settings/UnitToggle';
import { useBiometricLockPref } from '@/hooks/useBiometricLockPref';
import { useHikes } from '@/hooks/useHikes';
import { colorForUser } from '@/lib/memberColor';
import { formatDistance, formatElevation, type UnitSystem } from '@/lib/units';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProfileStore } from '@/stores/useProfileStore';

const HINT_DISMISSED_KEY = 'hikemate_avatar_hint_dismissed';
const REGEN_DEBOUNCE_MS = 1000;

function randomAvatarSeed(): string {
  // 11+ chars of base36 entropy — DiceBear hashes the seed so any string
  // produces a unique image, but more entropy = less repeat collision.
  return (
    Math.random().toString(36).slice(2, 15) +
    Math.random().toString(36).slice(2, 6)
  );
}

export default function ProfileScreen(): React.JSX.Element {
  const userEmail = useAuthStore((s) => s.user?.email ?? null);
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useProfileStore((s) => s.profile);
  const updateAvatarSeed = useProfileStore((s) => s.updateAvatarSeed);
  const unitSystem: UnitSystem = profile?.unit_system ?? 'metric';
  const displayName = profile?.display_name?.trim() || userEmail || 'Hiker';

  const { hikes } = useHikes();
  const totalHikes = hikes?.length ?? 0;
  const totalDistanceMeters =
    hikes?.reduce((sum, h) => sum + h.distance_meters, 0) ?? 0;
  const totalElevationMeters =
    hikes?.reduce((sum, h) => sum + h.elevation_gain_meters, 0) ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Hero
          avatarSeed={profile?.avatar_seed ?? null}
          displayName={displayName}
          fallbackColor={profile ? colorForUser(profile.id) : '#0f766e'}
          updateAvatarSeed={updateAvatarSeed}
        />

        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 16,
            marginTop: 20,
          }}
        >
          <StatPill label="HIKES" value={String(totalHikes)} />
          <StatPill
            label="DISTANCE"
            value={
              formatDistance(totalDistanceMeters, unitSystem).split(' ')[0]
            }
            suffix={unitSystem === 'imperial' ? 'mi' : 'km'}
          />
          <StatPill
            label="ELEVATION"
            value={
              formatElevation(totalElevationMeters, unitSystem).split(' ')[0]
            }
            suffix={unitSystem === 'imperial' ? 'ft' : 'm'}
          />
        </View>

        <Section title="Account">
          <Row label="Email" value={userEmail ?? '—'} />
          <SignOutRow onSignOut={signOut} />
        </Section>

        <Section title="Preferences">
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text className="mb-2 text-sm font-medium text-gray-700">
              Units
            </Text>
            <UnitToggle />
          </View>
          <BiometricRow />
        </Section>

        <Section title="Offline Maps">
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <OfflineMapsSection />
          </View>
        </Section>

        <Section title="About">
          <Row
            label="Version"
            value={`v${Constants.expoConfig?.version ?? '1.0.0'}`}
          />
          <FeedbackRow />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Hero({
  avatarSeed,
  displayName,
  fallbackColor,
  updateAvatarSeed,
}: {
  avatarSeed: string | null;
  displayName: string;
  fallbackColor: string;
  updateAvatarSeed: (next: string) => Promise<{ error: string | null }>;
}): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const lastRegenAt = useRef(0);
  const [hintHidden, setHintHidden] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read the dismissed flag once on mount so the hint reappears for any
  // user who hasn't tapped to regenerate yet.
  useEffect(() => {
    let cancelled = false;
    void SecureStore.getItemAsync(HINT_DISMISSED_KEY).then((v) => {
      if (!cancelled) setHintHidden(v === '1');
    });
    return (): void => {
      cancelled = true;
    };
  }, []);

  const popAnimation = useCallback((): void => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.12,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale]);

  const onRegenerate = useCallback(async (): Promise<void> => {
    const now = Date.now();
    if (now - lastRegenAt.current < REGEN_DEBOUNCE_MS) return;
    lastRegenAt.current = now;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
    popAnimation();
    setError(null);
    if (!hintHidden) {
      setHintHidden(true);
      void SecureStore.setItemAsync(HINT_DISMISSED_KEY, '1');
    }
    const next = randomAvatarSeed();
    const { error: updateError } = await updateAvatarSeed(next);
    if (updateError) setError('Could not save new avatar.');
  }, [hintHidden, popAnimation, updateAvatarSeed]);

  return (
    <View style={{ alignItems: 'center', paddingTop: 24, gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Regenerate avatar"
        onPress={() => void onRegenerate()}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Avatar
            seed={avatarSeed}
            displayName={displayName}
            fallbackColor={fallbackColor}
            size={120}
          />
        </Animated.View>
      </Pressable>
      <Text
        style={{ fontSize: 22, fontWeight: '500', color: '#111827' }}
        numberOfLines={1}
      >
        {displayName}
      </Text>
      {!hintHidden ? (
        <Text style={{ fontSize: 12, color: '#6b7280' }}>
          Tap avatar to regenerate
        </Text>
      ) : null}
      {error ? (
        <Text style={{ fontSize: 12, color: '#dc2626' }}>{error}</Text>
      ) : null}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={{ marginTop: 28 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 1,
          color: '#6b7280',
          textTransform: 'uppercase',
          paddingHorizontal: 16,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
      }}
    >
      <Text style={{ fontSize: 16, color: '#111827' }}>{label}</Text>
      <Text
        style={{ fontSize: 16, color: '#6b7280', flexShrink: 1 }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function BiometricRow(): React.JSX.Element {
  const { isEnabled, isLoading, setEnabled } = useBiometricLockPref();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
      }}
    >
      <Text style={{ fontSize: 16, color: '#111827' }}>Face ID Lock</Text>
      <Switch
        value={isEnabled}
        disabled={isLoading}
        onValueChange={(next) => void setEnabled(next)}
        trackColor={{ true: '#0f766e', false: '#d1d5db' }}
        accessibilityLabel="Face ID Lock"
        accessibilityRole="switch"
      />
    </View>
  );
}

function SignOutRow({
  onSignOut,
}: {
  onSignOut: () => Promise<{ error: { message: string } | null }>;
}): React.JSX.Element {
  const [isWorking, setIsWorking] = useState(false);
  const onPress = async (): Promise<void> => {
    setIsWorking(true);
    await onSignOut();
    setIsWorking(false);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      onPress={() => void onPress()}
      style={({ pressed }) => ({
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: pressed ? '#fef2f2' : '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
      })}
      disabled={isWorking}
    >
      <Text style={{ fontSize: 16, color: '#dc2626', fontWeight: '500' }}>
        Sign Out
      </Text>
      {isWorking ? (
        <ActivityIndicator size="small" color="#dc2626" />
      ) : (
        <Ionicons name="log-out-outline" size={18} color="#dc2626" />
      )}
    </Pressable>
  );
}

function FeedbackRow(): React.JSX.Element {
  const onPress = (): void => {
    void Linking.openURL(
      'mailto:dave@hikemate.app?subject=HikeMate%20feedback',
    ).catch(() => undefined);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Send feedback"
      onPress={onPress}
      style={({ pressed }) => ({
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: pressed ? '#f9fafb' : '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
      })}
    >
      <Text style={{ fontSize: 16, color: '#111827' }}>Send feedback</Text>
      <Ionicons name="mail-outline" size={18} color="#6b7280" />
    </Pressable>
  );
}
