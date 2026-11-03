import '../global.css';

import { Inter_400Regular, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { colors } from '@stackbluff/ui-native';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Providers } from '../providers';
import { useDeepLinkHandler } from '../services/native';

// Keep the native splash up while the webfonts load.
void SplashScreen.preventAutoHideAsync();

const stackBluffTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.surfaceContainer,
    text: colors.onBackground,
    border: colors.border,
    notification: colors.accent,
  },
};

export const unstable_settings = {
  // Deep-link cold starts should land in the tabs group, not a dead leaf.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_700Bold,
    PlayfairDisplay_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // stackbluff:// deep links (mirrors the frozen navigation map).
  useDeepLinkHandler();

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Providers>
      <ThemeProvider value={stackBluffTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="table/[tableId]" />
        </Stack>
      </ThemeProvider>
    </Providers>
  );
}
