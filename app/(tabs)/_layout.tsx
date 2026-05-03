import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { BiometricGate } from '@/components/BiometricGate';

export default function TabsLayout(): React.JSX.Element {
  return (
    <BiometricGate>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#0f766e',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="hikes"
          options={{
            title: 'Hikes',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trail-sign-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="person-circle-outline"
                color={color}
                size={size}
              />
            ),
          }}
        />
      </Tabs>
    </BiometricGate>
  );
}
