import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { toast } from '../lib/toast';
import { IconBookOpen, IconHelpCircle } from '../screens/icons';
import { Screen } from '../screens/Screen';

/**
 * Static content screens — ports of PWA routes/guide.tsx, help.tsx,
 * responsible-gaming.tsx and the legal pages (content condensed to the same
 * sections; external links open via Linking).
 */

/* ── Shared bits ────────────────────────────────────────────────────────── */

function ContentCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Surface variant="card" radius={radii.base} style={styles.contentCard}>
      <AppText variant="label">{title.toUpperCase()}</AppText>
      {children}
    </Surface>
  );
}

function BodyText({ children }: { children: ReactNode }) {
  return <Text style={styles.bodyText}>{children}</Text>;
}

function ExternalLink({ label, url }: { label: string; url: string }) {
  return (
    <PressableScale
      onPress={() => {
        void Linking.openURL(url).catch(() => toast.error('Could not open link'));
      }}
    >
      <Text style={styles.linkText}>{label}</Text>
    </PressableScale>
  );
}

/* ── Guide ──────────────────────────────────────────────────────────────── */

const GUIDE_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'The Goal',
    body: "StackBluff is No-Limit Texas Hold'em. Win chips by having the best five-card hand at showdown — or by making everyone else fold. Chips are play money; play smart.",
  },
  {
    title: 'Hand Rankings (top to bottom)',
    body: 'Royal Flush · Straight Flush · Four of a Kind · Full House · Flush · Straight · Three of a Kind · Two Pair · One Pair · High Card.',
  },
  {
    title: 'Betting Rounds',
    body: 'Preflop → Flop → Turn → River. On your turn you can Check, Call, Bet, Raise or Fold. The action bar shows pot odds and your best current hand.',
  },
  {
    title: 'Blinds & antes',
    body: 'The small blind and big blind post forced bets before each hand. Tournament play adds escalating blind levels and antes (shown on the table timer bar).',
  },
  {
    title: 'Tournaments',
    body: 'Sit & Gos start as soon as the seats fill. Multi-table tournaments (MTTs) pay out per the payout structure shown on the tournament page. Register early — seats are limited.',
  },
  {
    title: 'Clubs',
    body: 'Clubs are private communities with their own leaderboards, divisions and tournaments. Create one or join with an invite code from the Clubs tab.',
  },
];

export function GuideScreen() {
  const router = useRouter();
  return (
    <Screen
      title="Guide"
      subtitle="Everything you need to play like a pro."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <View style={styles.stack}>
        <ContentCard title="Quick Start">
          <View style={styles.iconRow}>
            <IconBookOpen size={16} color={colors.accent} />
            <BodyText>Five minutes to your first hand.</BodyText>
          </View>
        </ContentCard>
        {GUIDE_SECTIONS.map((section) => (
          <ContentCard key={section.title} title={section.title}>
            <BodyText>{section.body}</BodyText>
          </ContentCard>
        ))}
      </View>
    </Screen>
  );
}

/* ── Help ───────────────────────────────────────────────────────────────── */

const FAQ = [
  {
    q: 'How do I get more chips?',
    a: 'Visit the Shop tab for chip packs, or claim daily missions and referral bonuses. Free chips regenerate over time.',
  },
  {
    q: 'What is Season Pass?',
    a: 'Season Pass unlocks the Oracle assistant and premium features for the season duration. Manage it in Shop → Season Pass.',
  },
  {
    q: 'How do I join a club?',
    a: 'Get an invite code from a club owner, then Clubs → enter the code → Join Club.',
  },
  {
    q: 'Someone is acting suspiciously',
    a: 'Use the responsible gaming tools and report via support. Anti-cheat fingerprinting runs automatically on every table.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Settings → Privacy & Data → Delete Account. You have 30 days to cancel the request.',
  },
];

export function HelpScreen() {
  const router = useRouter();
  return (
    <Screen
      title="Help & Support"
      subtitle="Answers, contact channels and account help."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <View style={styles.stack}>
        <ContentCard title="Contact Support">
          <View style={styles.iconRow}>
            <IconHelpCircle size={16} color={colors.accent} />
            <BodyText>
              Reach the team at support@stackbluff.com or through the Telegram bot.
            </BodyText>
          </View>
          <ExternalLink label="Open support channel" url="https://t.me/StackBluffBot" />
        </ContentCard>

        {FAQ.map((item) => (
          <ContentCard key={item.q} title={item.q}>
            <BodyText>{item.a}</BodyText>
          </ContentCard>
        ))}

        <ContentCard title="More">
          <ExternalLink label="Responsible Gaming" url="stackbluff://responsible-gaming" />
        </ContentCard>
      </View>
    </Screen>
  );
}

/* ── Responsible gaming ─────────────────────────────────────────────────── */

export function ResponsibleGamingScreen() {
  const router = useRouter();
  return (
    <Screen
      title="Responsible Gaming"
      subtitle="Play for fun. Stay in control."
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <View style={styles.stack}>
        <ContentCard title="Play Money Only">
          <BodyText>
            StackBluff chips are play money with no cash value. The game is for entertainment —
            never treat it as income or a way to make money.
          </BodyText>
        </ContentCard>
        <ContentCard title="Stay in Control">
          <BodyText>
            Set time limits before you play, take regular breaks, and never chase losses. If gaming
            stops being fun, step away.
          </BodyText>
        </ContentCard>
        <ContentCard title="Set Your Limits">
          <BodyText>
            Deposit and session limits are managed by your device's app store controls and our
            responsible gaming settings. Contact support to set hard account limits.
          </BodyText>
        </ContentCard>
        <ContentCard title="Need Help?">
          <BodyText>
            If gambling has become a problem for you or someone close to you, confidential help is
            available.
          </BodyText>
          <ExternalLink
            label="National Problem Gambling Helpline — 1-800-522-4700"
            url="tel:18005224700"
          />
          <ExternalLink label="Gamblers Anonymous" url="https://www.gamblersanonymous.org" />
        </ContentCard>
        <ContentCard title="Self-Exclusion">
          <BodyText>
            Request account closure or a cool-off period any time via Settings → Privacy & Data, or
            by contacting support.
          </BodyText>
        </ContentCard>
      </View>
    </Screen>
  );
}

/* ── Legal ──────────────────────────────────────────────────────────────── */

export function LegalScreen({ page }: { page: 'privacy' | 'terms' }) {
  const router = useRouter();
  const isPrivacy = page === 'privacy';

  const sections: { title: string; body: string }[] = isPrivacy
    ? [
        {
          title: 'What We Collect',
          body: 'Account data (username, email), gameplay data (hands, statistics), device identifiers for anti-cheat and push notifications, and purchase receipts processed by our payment provider.',
        },
        {
          title: 'How We Use It',
          body: 'To operate the game, calculate statistics and leaderboards, prevent fraud and collusion, process purchases, and send service notifications you opt into.',
        },
        {
          title: 'What We Share',
          body: 'We never sell personal data. Payment processing is handled by Stripe / RevenueCat under their privacy policies. Everything else stays on StackBluff servers.',
        },
        {
          title: 'Your Rights (GDPR)',
          body: 'Export your data any time from Settings → Privacy & Data. You can request correction or deletion of your account and data; deletion completes after a 30-day window.',
        },
        {
          title: 'Data Retention',
          body: 'Gameplay history is retained while your account is active. Deleted accounts are purged after the 30-day grace period, except records we must keep for legal or anti-fraud purposes.',
        },
        {
          title: 'Contact',
          body: 'Privacy questions: privacy@stackbluff.com.',
        },
      ]
    : [
        {
          title: '1. The Service',
          body: 'StackBluff provides a free, play-money social poker platform. Chips have no monetary value and cannot be purchased, sold, or exchanged for anything of value outside the game.',
        },
        {
          title: '2. Eligibility',
          body: 'You must be at least 18 years old (or the age of majority in your jurisdiction) to create an account. One account per person.',
        },
        {
          title: '3. Acceptable Use',
          body: 'No cheating, collusion, botting, scraping, or exploiting bugs. We enforce fair play with automated fingerprinting and manual review; violations end in suspension.',
        },
        {
          title: '4. Purchases',
          body: 'Optional in-app purchases (chip packs, Season Pass, Club Pro) are processed by Apple / Google / RevenueCat. Purchases are consumable or subscription-based per the store terms; restore is available on the payments screen.',
        },
        {
          title: '5. Virtual Goods',
          body: 'Chips and entitlements are licensed, not sold. They may be adjusted for fraud, bugs, or abuse, and have no cash refund value.',
        },
        {
          title: '6. Termination',
          body: 'You can delete your account at any time. We may suspend accounts that violate these terms. Sections 3–5 survive termination.',
        },
        {
          title: '7. Liability',
          body: 'The service is provided "as is". To the maximum extent permitted by law, StackBluff is not liable for indirect or consequential damages arising from use of the service.',
        },
      ];

  return (
    <Screen
      title={isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
      subtitle="Last updated: 2025"
      onBack={() => router.back()}
      safeEdges={['top']}
    >
      <View style={styles.stack}>
        {sections.map((section) => (
          <ContentCard key={section.title} title={section.title}>
            <BodyText>{section.body}</BodyText>
          </ContentCard>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10, paddingBottom: 24 },
  contentCard: { padding: 16, gap: 8 },
  bodyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  linkText: {
    fontFamily: fonts.data,
    fontSize: 12,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
});
