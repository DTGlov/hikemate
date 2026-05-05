import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import {
  EditDisplayNameModal,
  type EditDisplayNameModalHandle,
} from '@/components/profile/EditDisplayNameModal';
import { ProfileRow } from '@/components/profile/ProfileRow';
import { StatPill } from '@/components/profile/StatPill';
import { NotificationSettings } from '@/components/profile/NotificationSettings';
import { OfflineMapsSection } from '@/components/settings/OfflineMapsSection';
import { UnitToggle } from '@/components/settings/UnitToggle';
import { useBiometricLockPref } from '@/hooks/useBiometricLockPref';
import { useHikes } from '@/hooks/useHikes';
import { colorForUser } from '@/lib/memberColor';
import { colors, fontFamily, fontSize, lineHeight, spacing } from '@/lib/theme';
import { formatDistance, formatElevation, type UnitSystem } from '@/lib/units';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProfileStore } from '@/stores/useProfileStore';

const HINT_DISMISSED_KEY = 'hikemate_avatar_hint_dismissed';
const REGEN_DEBOUNCE_MS = 1000;
const SECTION_PADDING_X = spacing.lg;

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

  const editNameRef = useRef<EditDisplayNameModalHandle>(null);

  const { hikes } = useHikes();
  const totalHikes = hikes?.length ?? 0;
  const totalDistanceMeters =
    hikes?.reduce((sum, h) => sum + h.distance_meters, 0) ?? 0;
  const totalElevationMeters =
    hikes?.reduce((sum, h) => sum + h.elevation_gain_meters, 0) ?? 0;

  const [isSigningOut, setIsSigningOut] = useState(false);
  const onSignOut = useCallback(async (): Promise<void> => {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
  }, [signOut]);

  const onSendFeedback = useCallback((): void => {
    void Linking.openURL(
      'mailto:dave@hikemate.app?subject=HikeMate%20feedback',
    ).catch(() => undefined);
  }, []);

  const onEditName = useCallback((): void => {
    editNameRef.current?.present();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Hero
          avatarSeed={profile?.avatar_seed ?? null}
          displayName={displayName}
          fallbackColor={profile ? colorForUser(profile.id) : '#0f766e'}
          updateAvatarSeed={updateAvatarSeed}
          onEditName={onEditName}
        />

        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: SECTION_PADDING_X,
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
          <ProfileRow
            icon="mail-outline"
            label="Email"
            value={userEmail ?? '—'}
          />
          <ProfileRow
            icon="log-out-outline"
            label="Sign Out"
            onPress={() => void onSignOut()}
            destructive
            loading={isSigningOut}
          />
        </Section>

        <Section title="Preferences">
          <UnitsBlock />
          <BiometricRow />
        </Section>

        <Section title="Notifications">
          <NotificationSettings />
        </Section>

        <Section title="Offline Maps">
          <View
            style={{
              paddingHorizontal: SECTION_PADDING_X,
              paddingVertical: 12,
            }}
          >
            <OfflineMapsSection />
          </View>
        </Section>

        <Section title="About">
          <ProfileRow
            icon="information-circle-outline"
            label="Version"
            value={`v${Constants.expoConfig?.version ?? '1.0.0'}`}
          />
          <ProfileRow
            icon="chatbubble-ellipses-outline"
            label="Send feedback"
            onPress={onSendFeedback}
          />
        </Section>
      </ScrollView>

      <EditDisplayNameModal ref={editNameRef} />
    </SafeAreaView>
  );
}

function Hero({
  avatarSeed,
  displayName,
  fallbackColor,
  updateAvatarSeed,
  onEditName,
}: {
  avatarSeed: string | null;
  displayName: string;
  fallbackColor: string;
  updateAvatarSeed: (next: string) => Promise<{ error: string | null }>;
  onEditName: () => void;
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit display name"
        onPress={onEditName}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        })}
      >
        <Text
          style={{
            fontFamily: fontFamily.medium,
            fontSize: fontSize.heading3,
            lineHeight: lineHeight.heading3,
            color: colors.textPrimary,
          }}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Ionicons
          name="pencil-outline"
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {!hintHidden ? (
        <Text
          style={{
            fontFamily: fontFamily.regular,
            fontSize: fontSize.small,
            lineHeight: lineHeight.small,
            color: colors.textSecondary,
          }}
        >
          Tap avatar to regenerate
        </Text>
      ) : null}
      {error ? (
        <Text
          style={{
            fontFamily: fontFamily.regular,
            fontSize: fontSize.small,
            lineHeight: lineHeight.small,
            color: colors.danger,
          }}
        >
          {error}
        </Text>
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
    <View style={{ marginTop: spacing.xxl }}>
      <Text
        style={{
          fontFamily: fontFamily.medium,
          fontSize: fontSize.caption,
          lineHeight: lineHeight.caption,
          letterSpacing: 1,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          paddingHorizontal: SECTION_PADDING_X,
          marginBottom: spacing.sm,
        }}
      >
        {title}
      </Text>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
        {children}
      </View>
    </View>
  );
}

function UnitsBlock(): React.JSX.Element {
  return (
    <View
      style={{
        paddingHorizontal: SECTION_PADDING_X,
        paddingTop: spacing.md,
        paddingBottom: spacing.base,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          marginBottom: spacing.sm,
        }}
      >
        <Ionicons
          name="speedometer-outline"
          size={20}
          color={colors.textSecondary}
        />
        <Text
          style={{
            fontFamily: fontFamily.regular,
            fontSize: fontSize.bodyLarge,
            lineHeight: lineHeight.bodyLarge,
            color: colors.textPrimary,
          }}
        >
          Units
        </Text>
      </View>
      <UnitToggle />
    </View>
  );
}

function BiometricRow(): React.JSX.Element {
  const { isEnabled, isLoading, setEnabled } = useBiometricLockPref();
  return (
    <ProfileRow
      icon="lock-closed-outline"
      label="Face ID Lock"
      control={
        <Switch
          value={isEnabled}
          disabled={isLoading}
          onValueChange={(next) => void setEnabled(next)}
          trackColor={{ true: '#0f766e', false: '#d1d5db' }}
          accessibilityLabel="Face ID Lock"
          accessibilityRole="switch"
        />
      }
    />
  );
}
