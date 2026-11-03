import { colors } from '@stackbluff/ui-native';
import type { ComponentType, ReactNode } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

/**
 * Minimal SVG icon set (Task 3-b).
 *
 * `lucide-react-native` is not in the dependency set, so these are hand-drawn
 * 24×24 line icons mirroring the lucide glyphs the PWA screens use
 * (stroke-based, round caps). All icons accept { size, color } and default
 * to 20 / onBackground.
 */

export interface IconProps {
  size?: number;
  color?: string;
}

type IconComponent = ComponentType<IconProps>;

function makeIcon(children: ReactNode, viewBox = '0 0 24 24'): IconComponent {
  function Icon({ size = 20, color = colors.onBackground }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox={viewBox} fill="none">
        <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
          {children}
        </G>
      </Svg>
    );
  }
  Icon.displayName = 'Icon';
  return Icon;
}

export const IconGrid = makeIcon(
  <>
    <Rect x="3" y="3" width="7" height="7" rx="1" />
    <Rect x="14" y="3" width="7" height="7" rx="1" />
    <Rect x="3" y="14" width="7" height="7" rx="1" />
    <Rect x="14" y="14" width="7" height="7" rx="1" />
  </>,
);

export const IconTrophy = makeIcon(
  <>
    <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <Path d="M4 22h16" />
    <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </>,
);

export const IconUsers = makeIcon(
  <>
    <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <Circle cx="9" cy="7" r="4" />
    <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
);

export const IconShoppingBag = makeIcon(
  <>
    <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <Path d="M3 6h18" />
    <Path d="M16 10a4 4 0 0 1-8 0" />
  </>,
);

export const IconUser = makeIcon(
  <>
    <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
  </>,
);

export const IconPlus = makeIcon(
  <>
    <Path d="M5 12h14" />
    <Path d="M12 5v14" />
  </>,
);

export const IconChevronRight = makeIcon(<Path d="m9 18 6-6-6-6" />);
export const IconChevronLeft = makeIcon(<Path d="m15 18-6-6 6-6" />);
export const IconChevronDown = makeIcon(<Path d="m6 9 6 6 6-6" />);
export const IconArrowLeft = makeIcon(
  <>
    <Path d="m12 19-7-7 7-7" />
    <Path d="M19 12H5" />
  </>,
);

export const IconSettings = makeIcon(
  <>
    <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <Circle cx="12" cy="12" r="3" />
  </>,
);

export const IconBell = makeIcon(
  <>
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>,
);

export const IconPalette = makeIcon(
  <>
    <Circle cx="13.5" cy="6.5" r=".5" />
    <Circle cx="17.5" cy="10.5" r=".5" />
    <Circle cx="8.5" cy="7.5" r=".5" />
    <Circle cx="6.5" cy="12.5" r=".5" />
    <Path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </>,
);

export const IconVolume = makeIcon(
  <>
    <Path d="M11 5 6 9H2v6h4l5 4V5Z" />
    <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </>,
);

export const IconShield = makeIcon(
  <Path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />,
);

export const IconCreditCard = makeIcon(
  <>
    <Rect x="2" y="5" width="20" height="14" rx="2" />
    <Path d="M2 10h20" />
  </>,
);

export const IconSend = makeIcon(<Path d="m22 2-7 20-4-9-9-4Z" />);

export const IconCrown = makeIcon(
  <>
    <Path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.735L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
    <Path d="M5 21h14" />
  </>,
);

export const IconCoins = makeIcon(
  <>
    <Circle cx="8" cy="8" r="6" />
    <Path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <Path d="M7 6h1v4" />
  </>,
);

export const IconHistory = makeIcon(
  <>
    <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <Path d="M3 3v5h5" />
    <Path d="M12 7v5l4 2" />
  </>,
);

export const IconFilm = makeIcon(
  <>
    <Rect x="2" y="4" width="20" height="16" rx="2" />
    <Path d="M7 4v16" />
    <Path d="M17 4v16" />
    <Path d="M2 9h5" />
    <Path d="M2 15h5" />
    <Path d="M17 9h5" />
    <Path d="M17 15h5" />
  </>,
);

export const IconTarget = makeIcon(
  <>
    <Circle cx="12" cy="12" r="10" />
    <Circle cx="12" cy="12" r="6" />
    <Circle cx="12" cy="12" r="2" />
  </>,
);

export const IconShare = makeIcon(
  <>
    <Circle cx="18" cy="5" r="3" />
    <Circle cx="6" cy="12" r="3" />
    <Circle cx="18" cy="19" r="3" />
    <Path d="m8.59 13.51 6.83 3.98" />
    <Path d="m15.41 6.51-6.82 3.98" />
  </>,
);

export const IconBookOpen = makeIcon(
  <>
    <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </>,
);

export const IconHelpCircle = makeIcon(
  <>
    <Circle cx="12" cy="12" r="10" />
    <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <Path d="M12 17h.01" />
  </>,
);

export const IconLogOut = makeIcon(
  <>
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <Path d="m16 17 5-5-5-5" />
    <Path d="M21 12H9" />
  </>,
);

export const IconEdit = makeIcon(
  <>
    <Path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <Path d="m15 5 4 4" />
  </>,
);

export const IconLock = makeIcon(
  <>
    <Rect x="3" y="11" width="18" height="11" rx="2" />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>,
);

export const IconMail = makeIcon(
  <>
    <Rect x="2" y="4" width="20" height="16" rx="2" />
    <Path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>,
);

export const IconEye = makeIcon(
  <>
    <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <Circle cx="12" cy="12" r="3" />
  </>,
);

export const IconCheck = makeIcon(<Path d="M20 6 9 17l-5-5" />);
export const IconX = makeIcon(<Path d="M18 6 6 18M6 6l12 12" />);
export const IconCheckCircle = makeIcon(
  <>
    <Circle cx="12" cy="12" r="10" />
    <Path d="m9 12 2 2 4-4" />
  </>,
);
export const IconXCircle = makeIcon(
  <>
    <Circle cx="12" cy="12" r="10" />
    <Path d="m15 9-6 6" />
    <Path d="m9 9 6 6" />
  </>,
);

export const IconRefresh = makeIcon(
  <>
    <Path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <Path d="M21 3v5h-5" />
    <Path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <Path d="M8 16H3v5" />
  </>,
);

export const IconCalendar = makeIcon(
  <>
    <Rect x="3" y="4" width="18" height="18" rx="2" />
    <Path d="M16 2v4" />
    <Path d="M8 2v4" />
    <Path d="M3 10h18" />
  </>,
);

export const IconTrendingUp = makeIcon(
  <>
    <Path d="m22 7-8.5 8.5-5-5L2 17" />
    <Path d="M16 7h6v6" />
  </>,
);

export const IconMedal = makeIcon(
  <>
    <Path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />
    <Path d="M11 12 5.12 2.2" />
    <Path d="m13 12 5.88-9.8" />
    <Path d="M8 7h8" />
    <Circle cx="12" cy="17" r="5" />
    <Path d="M12 18v-2h-.5" />
  </>,
);

export const IconPlay = makeIcon(<Path d="m6 3 14 9-14 9V3Z" />);
export const IconWallet = makeIcon(
  <>
    <Path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <Path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </>,
);

export const IconZap = makeIcon(
  <Path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />,
);
export const IconGem = makeIcon(<Path d="M6 3h12l4 6-10 13L2 9Z" />);
export const IconSwords = makeIcon(
  <>
    <Path d="m14.5 17.5 3-3L22 19l-3 3z" />
    <Path d="m2 2 7.586 7.586" />
    <Path d="m11 11 3 3" />
    <Path d="m16.5 6.5 4-4" />
    <Path d="m5 8 6.5-6.5" />
    <Circle cx="8" cy="8" r="2" />
  </>,
);
export const IconAward = makeIcon(
  <>
    <Circle cx="12" cy="8" r="6" />
    <Path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </>,
);
export const IconBuilding = makeIcon(
  <>
    <Rect x="4" y="2" width="16" height="20" rx="2" />
    <Path d="M9 22v-4h6v4" />
    <Path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
  </>,
);
export const IconDownload = makeIcon(
  <>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Path d="m7 10 5 5 5-5" />
    <Path d="M12 15V3" />
  </>,
);
export const IconTrash = makeIcon(
  <>
    <Path d="M3 6h18" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>,
);
export const IconAlertTriangle = makeIcon(
  <>
    <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <Path d="M12 9v4" />
    <Path d="M12 17h.01" />
  </>,
);
export const IconLoader = makeIcon(<Path d="M21 12a9 9 0 1 1-6.219-8.56" />);
export const IconFileText = makeIcon(
  <>
    <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <Path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <Path d="M10 9H8" />
    <Path d="M16 13H8" />
    <Path d="M16 17H8" />
  </>,
);
export const IconGlobe = makeIcon(
  <>
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <Path d="M2 12h20" />
  </>,
);
export const IconClock = makeIcon(
  <>
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 6v6l4 2" />
  </>,
);
