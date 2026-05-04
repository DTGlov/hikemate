import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuthStore } from '@/stores/useAuthStore';

const signupSchema = z
  .object({
    displayName: z
      .string()
      .min(2, 'Too short — at least 2 characters')
      .max(30, 'Too long — keep it under 30 characters')
      .refine((v) => !v.includes('@'), 'Display name cannot contain @'),
    email: z.email('Enter a valid email'),
    password: z.string().min(6, 'Must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Must be at least 6 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupScreen(): React.JSX.Element {
  const signUp = useAuthStore((state) => state.signUp);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  });

  const onSubmit = async (values: SignupValues): Promise<void> => {
    setServerError(null);
    setSuccessMessage(null);
    const { error } = await signUp(values.email.trim(), values.password, {
      display_name: values.displayName.trim(),
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    setSuccessMessage(
      'Account created. If email confirmation is required, check your inbox.',
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 24,
            gap: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1">
            <Text className="text-3xl font-bold text-gray-900">
              Create your account
            </Text>
            <Text className="text-base text-gray-600">
              Start tracking your hikes with HikeMate.
            </Text>
          </View>

          {serverError ? (
            <View className="rounded-xl bg-red-50 px-4 py-3">
              <Text className="text-sm text-red-700">{serverError}</Text>
            </View>
          ) : null}
          {successMessage ? (
            <View className="rounded-xl bg-emerald-50 px-4 py-3">
              <Text className="text-sm text-emerald-800">{successMessage}</Text>
            </View>
          ) : null}

          <View className="gap-4">
            <TextField
              control={control}
              name="displayName"
              label="Display name"
              placeholder="What should we call you?"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              maxLength={30}
              errorMessage={errors.displayName?.message}
            />
            <TextField
              control={control}
              name="email"
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              errorMessage={errors.email?.message}
            />
            <TextField
              control={control}
              name="password"
              label="Password"
              placeholder="At least 6 characters"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              errorMessage={errors.password?.message}
            />
            <TextField
              control={control}
              name="confirmPassword"
              label="Confirm password"
              placeholder="Re-enter password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              errorMessage={errors.confirmPassword?.message}
            />
          </View>

          <Button
            label="Create Account"
            onPress={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
          />

          <View className="flex-row justify-center gap-1">
            <Text className="text-sm text-gray-600">
              Already have an account?
            </Text>
            <Link
              href="/(auth)/login"
              className="text-sm font-semibold text-teal-700"
            >
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
