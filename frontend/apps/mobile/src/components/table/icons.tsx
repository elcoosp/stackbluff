/**
 * Lucide icon set ported to react-native-svg — the exact glyphs the PWA
 * renders via lucide-react in ActionBar / PlayerSpot / dialogs.
 * All icons draw in a 24×24 viewBox with 2px round strokes, `color`
 * controls the stroke (defaults to inherited `currentColor` equivalent).
 */
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Polyline,
  Rect,
  Stop,
} from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

function IconBase({
  size = 16,
  color = '#ffffff',
  strokeWidth = 2,
  style,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {children}
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Polyline points="20 6 9 17 4 12" />
    </IconBase>
  );
}

export function XIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </IconBase>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M5 12h14" />
      <Path d="M12 5v14" />
    </IconBase>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M5 12h14" />
    </IconBase>
  );
}

export function DollarSignIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Line x1="12" x2="12" y1="2" y2="22" />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </IconBase>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" x2="9" y1="12" y2="12" />
    </IconBase>
  );
}

export function TrendingUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <Polyline points="16 7 22 7 22 13" />
    </IconBase>
  );
}

export function SwordsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <Line x1="13" x2="19" y1="19" y2="13" />
      <Line x1="16" x2="20" y1="16" y2="20" />
      <Line x1="19" x2="21" y1="21" y2="19" />
      <Polyline points="14.5 6.5 18 3 21 3 21 6 17.5 10" />
      <Line x1="5" x2="9" y1="14" y2="18" />
      <Line x1="7" x2="4" y1="17" y2="20" />
      <Line x1="3" x2="5" y1="19" y2="21" />
    </IconBase>
  );
}

export function ZapIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </IconBase>
  );
}

export function BotIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M12 8V4H8" />
      <Rect width="16" height="12" x="4" y="8" rx="2" />
      <Path d="M2 14h2" />
      <Path d="M20 14h2" />
      <Path d="M15 13v2" />
      <Path d="M9 13v2" />
    </IconBase>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <Path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <Path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </IconBase>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
    </IconBase>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </IconBase>
  );
}

export function UserXIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Line x1="17" x2="22" y1="8" y2="13" />
      <Line x1="22" x2="17" y1="8" y2="13" />
    </IconBase>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Polyline points="22 4 12 14.01 9 11.01" />
    </IconBase>
  );
}

export function CoinsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Circle cx="8" cy="8" r="6" />
      <Path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <Path d="M7 6h1v4" />
      <Path d="m16.71 13.88.7.71-2.82 2.82" />
    </IconBase>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Circle cx="12" cy="12" r="10" />
      <Circle cx="12" cy="12" r="6" />
      <Circle cx="12" cy="12" r="2" />
    </IconBase>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Rect width="18" height="18" x="3" y="4" rx="2" />
      <Path d="M3 10h18" />
    </IconBase>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="m9 18 6-6-6-6" />
    </IconBase>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <Circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconBase>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <Path d="M3 3v5h5" />
      <Path d="M12 7v5l4 2" />
    </IconBase>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <Circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function LoaderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </IconBase>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </IconBase>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2" />
      <Path d="M12 20v2" />
      <Path d="m4.93 4.93 1.41 1.41" />
      <Path d="m17.66 17.66 1.41 1.41" />
      <Path d="M2 12h2" />
      <Path d="M20 12h2" />
      <Path d="m6.34 17.66-1.41 1.41" />
      <Path d="m19.07 4.93-1.41 1.41" />
    </IconBase>
  );
}

export function BarChartIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M3 3v18h18" />
      <Path d="M18 17V9" />
      <Path d="M13 17V5" />
      <Path d="M8 17v-3" />
    </IconBase>
  );
}

export function AwardIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Circle cx="12" cy="8" r="6" />
      <Path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </IconBase>
  );
}

export function MaximizeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Polyline points="15 3 21 3 21 9" />
      <Polyline points="9 21 3 21 3 15" />
      <Line x1="21" x2="14" y1="3" y2="10" />
      <Line x1="3" x2="10" y1="21" y2="14" />
    </IconBase>
  );
}

export function MinimizeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Polyline points="4 14 10 14 10 20" />
      <Polyline points="20 10 14 10 14 4" />
      <Line x1="14" x2="21" y1="10" y2="3" />
      <Line x1="3" x2="10" y1="21" y2="14" />
    </IconBase>
  );
}

export function RotateCcwIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <Path d="M3 3v5h5" />
    </IconBase>
  );
}

/** PWA PotBadge trophy — exact 36×36 SVG from PotBadge.tsx. */
export function TrophyIcon({ size = 20, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none" style={style}>
      <Defs>
        <LinearGradient id="sbTrophyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#fcd34d" />
          <Stop offset="30%" stopColor="#fbbf24" />
          <Stop offset="70%" stopColor="#f59e0b" />
          <Stop offset="100%" stopColor="#d97706" />
        </LinearGradient>
      </Defs>
      <G transform="translate(6, 4)">
        <Path
          d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"
          stroke="url(#sbTrophyGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"
          stroke="url(#sbTrophyGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M18 9h1.5a1 1 0 0 0 0-5H18"
          stroke="url(#sbTrophyGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M4 22h16"
          stroke="url(#sbTrophyGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"
          stroke="url(#sbTrophyGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="url(#sbTrophyGrad)"
          fillOpacity="0.15"
        />
        <Path
          d="M6 9H4.5a1 1 0 0 1 0-5H6"
          stroke="url(#sbTrophyGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}
