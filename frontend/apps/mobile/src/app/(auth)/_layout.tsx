import { colors } from '@stackbluff/ui-native';
import { Stack } from 'expo-router';

/** Auth group — stack, no headers (frozen navigation map: auth has no tabs). */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
