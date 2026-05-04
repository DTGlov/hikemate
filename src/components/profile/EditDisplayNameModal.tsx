import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useOfflineStore } from '@/stores/useOfflineStore';
import { useProfileStore } from '@/stores/useProfileStore';

const MAX_NAME_LENGTH = 30;

export type EditDisplayNameModalHandle = {
  present: () => void;
};

function validate(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Name cannot be empty';
  // The TextInput maxLength enforces 30, but defend against paste bypasses.
  if (trimmed.length > MAX_NAME_LENGTH)
    return `Max ${MAX_NAME_LENGTH} characters`;
  return null;
}

export const EditDisplayNameModal = forwardRef<EditDisplayNameModalHandle>(
  (_, ref): React.JSX.Element => {
    const sheetRef = useRef<BottomSheetModal>(null);
    const profile = useProfileStore((s) => s.profile);
    const updateDisplayName = useProfileStore((s) => s.updateDisplayName);
    const isOnline = useOfflineStore((s) => s.isOnline);

    const [draft, setDraft] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const snapPoints = useMemo(() => ['40%'], []);

    useImperativeHandle(
      ref,
      () => ({
        present: (): void => {
          setDraft(profile?.display_name ?? '');
          setError(null);
          setIsSaving(false);
          sheetRef.current?.present();
        },
      }),
      [profile?.display_name],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps): React.JSX.Element => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
          opacity={0.4}
        />
      ),
      [],
    );

    const onCancel = useCallback((): void => {
      Keyboard.dismiss();
      sheetRef.current?.dismiss();
    }, []);

    const onSave = useCallback(async (): Promise<void> => {
      const localError = validate(draft);
      if (localError) {
        setError(localError);
        return;
      }
      if (!isOnline) {
        setError('Connect to the internet to update your name.');
        return;
      }
      setIsSaving(true);
      setError(null);
      const { error: updateError } = await updateDisplayName(draft.trim());
      setIsSaving(false);
      if (updateError) {
        setError('Could not update name. Try again?');
        return;
      }
      Keyboard.dismiss();
      sheetRef.current?.dismiss();
    }, [draft, isOnline, updateDisplayName]);

    const isSaveDisabled =
      isSaving ||
      draft.trim().length === 0 ||
      draft.trim() === (profile?.display_name ?? '').trim();

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView
          style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: '#111827',
              marginBottom: 16,
            }}
          >
            Edit Display Name
          </Text>

          <BottomSheetTextInput
            value={draft}
            onChangeText={(next) => {
              setDraft(next);
              if (error) setError(null);
            }}
            placeholder="Your name"
            placeholderTextColor="#9ca3af"
            autoFocus
            autoCapitalize="words"
            maxLength={MAX_NAME_LENGTH}
            style={{
              height: 48,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              borderRadius: 12,
              paddingHorizontal: 14,
              fontSize: 16,
              color: '#111827',
              backgroundColor: '#ffffff',
            }}
          />

          {error ? (
            <Text style={{ marginTop: 8, fontSize: 13, color: '#dc2626' }}>
              {error}
            </Text>
          ) : !isOnline ? (
            <Text style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
              Connect to the internet to update your name.
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{ fontSize: 16, color: '#374151', fontWeight: '500' }}
              >
                Cancel
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Button
                label="Save"
                onPress={() => void onSave()}
                isLoading={isSaving}
                disabled={isSaveDisabled || !isOnline}
              />
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

EditDisplayNameModal.displayName = 'EditDisplayNameModal';
