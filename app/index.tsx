import { Redirect } from 'expo-router';

import { useAuthStore } from '@/stores/useAuthStore';

export default function Index(): React.JSX.Element {
  const session = useAuthStore((state) => state.session);
  return <Redirect href={session ? '/(tabs)' : '/(auth)/login'} />;
}
