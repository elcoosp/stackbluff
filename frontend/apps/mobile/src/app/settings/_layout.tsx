import { colors } from '@stackbluff/ui-native';
import { Stack } from 'expo-router';

/**
 * Settings stack (frozen navigation map): index + 7 sub-pages
 * (account | appearance | audio | notifications | payments | privacy |
 * telegram). No native headers — every screen draws its own back header.
 */
export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
