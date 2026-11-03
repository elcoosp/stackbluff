import { colors, fonts } from '@stackbluff/ui-native';
import { Tabs } from 'expo-router';
import type { ComponentType } from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  IconGrid,
  type IconProps,
  IconShoppingBag,
  IconTrophy,
  IconUser,
  IconUsers,
} from '../../screens/icons';

/**
 * Tabs group (frozen navigation map): Lobby (index), Tournaments, Clubs,
 * Shop, Profile. Dark tab bar: bg #131313, active #4edea3, JetBrains Mono
 * caps 12 labels.
 */

const TAB_ICONS: Record<string, ComponentType<IconProps>> = {
  index: IconGrid,
  tournaments: IconTrophy,
  clubs: IconUsers,
  shop: IconShoppingBag,
  profile: IconUser,
};

const TAB_LABELS: Record<string, string> = {
  index: 'Lobby',
  tournaments: 'Tournaments',
  clubs: 'Clubs',
  shop: 'Shop',
  profile: 'Profile',
};

const TAB_ORDER = ['index', 'tournaments', 'clubs', 'shop', 'profile'] as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedForeground,
      }}
    >
      {TAB_ORDER.map((name) => {
        const Icon = TAB_ICONS[name];
        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: TAB_LABELS[name],
              tabBarLabel: ({ color, focused }) => (
                <Text
                  style={[
                    styles.tabLabel,
                    { color, fontFamily: focused ? fonts.labelCaps : fonts.data },
                  ]}
                >
                  {TAB_LABELS[name].toUpperCase()}
                </Text>
              ),
              tabBarIcon: ({ color }) => (
                // Tab-bar tint is ColorValue (null-safe); our SVG icons take hex strings.
                <Icon size={20} color={typeof color === 'string' ? color : undefined} />
              ),
            }}
          />
        );
      })}
      {/* /lobby alias (frozen map) renders the Lobby tab but stays out of the bar. */}
      <Tabs.Screen name="lobby" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
