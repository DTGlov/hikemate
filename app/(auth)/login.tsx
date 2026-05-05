import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuthStore } from '@/stores/useAuthStore';

const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(6, 'Must be at least 6 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginScreen(): React.JSX.Element {
  const signIn = useAuthStore((state) => state.signIn);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: LoginValues): Promise<void> => {
    setServerError(null);
    const { error } = await signIn(values.email.trim(), values.password);
    if (error) setServerError(error.message);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-center gap-6 px-6">
          <View className="gap-1">
            <Text className="font-bold text-3xl text-gray-900">
              Welcome back
            </Text>
            <Text className="text-base text-gray-600">
              Sign in to your HikeMate account.
            </Text>
          </View>

          {serverError ? (
            <View className="rounded-xl bg-red-50 px-4 py-3">
              <Text className="text-sm text-red-700">{serverError}</Text>
            </View>
          ) : null}

          <View className="gap-4">
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
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              errorMessage={errors.password?.message}
            />
          </View>

          <Button
            label="Sign In"
            onPress={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
          />

          <View className="flex-row justify-center gap-1">
            <Text className="text-sm text-gray-600">
              Don&apos;t have an account?
            </Text>
            <Link
              href="/(auth)/signup"
              className="text-sm font-semibold text-teal-700"
            >
              Sign up
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
