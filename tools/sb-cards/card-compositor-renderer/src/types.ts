export interface CardData {
  rank: string;
  suit: string;
  artPath: string;
  isBack?: boolean;
  layoutType: 'standard' | 'reversible';
}

export interface DeckConfig {
  name: string;
  baseDir: string;
  suffix: string;
  cornerPlaquePath?: string;
  borderPath?: string;
  centerBandPath?: string;
  numberTemplatePath?: string;
  customNumberArtPaths?: Record<string, string>;
}

export type PipPosition = { col: 0 | 1 | 2; row: 0 | 1 | 2 | 3 | 4 };
export type PipLayouts = Record<string, PipPosition[]>;
