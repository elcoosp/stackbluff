import { AppText, colors } from '@stackbluff/ui-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

/** Entry: redirects to the Lobby tab (frozen navigation map, / → lobby). */
export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/(tabs)' as never);
    }, 0);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={styles.container}>
      <AppText variant="display">StackBluff</AppText>
      <AppText variant="label">Dealing you in…</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
