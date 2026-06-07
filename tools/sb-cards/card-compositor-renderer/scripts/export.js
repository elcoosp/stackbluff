import puppeteer from 'puppeteer';
import { decks } from '../src/utils/deckConfig.js';
import { resolveAssetPath } from '../src/utils/assetLoader.js';

const DECK_NAME = 'poison-gardenia';
const deck = decks[DECK_NAME];
const baseDir = deck.baseDir;
const suffix = deck.suffix;

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const FACE_RANKS = ['J', 'Q', 'K'];

async function exportCard(page, rank, suit, isBack, layoutType, outputFilename, customArtPath = null) {
  const url = `http://localhost:3000/card?rank=${rank}&suit=${suit}&layout=${layoutType}&back=${isBack}`;
  await page.goto(url);
  const element = await page.$('.card');
  if (element) {
    const outDir = `${deck.baseDir}/3-game-cards`;
    const klingDir = `${deck.baseDir}/1-raw/kling-input`;
    await element.screenshot({ path: `${outDir}/${outputFilename}` });
    await element.screenshot({ path: `${klingDir}/${outputFilename}` });
  }
}

async function exportDeck() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1400 });

  // Card back
  await exportCard(page, '', '', true, 'standard', 'back.png');

  // Aces
  for (const suit of SUITS) {
    await exportCard(page, 'A', suit, false, 'standard', `ace-${suit}.png`);
  }

  // Face cards
  for (const suit of SUITS) {
    for (const rank of FACE_RANKS) {
      const rankMap = { J: 'jack', Q: 'queen', K: 'king' };
      const filename = `${rankMap[rank]}-${suit}${suffix}.png`;
      const artPath = resolveAssetPath(baseDir, filename, suffix);
      await exportCard(page, rank, suit, false, 'reversible', `${rank.toLowerCase()}-${suit}.png`, artPath);
    }
  }

  // Number cards
  for (const suit of SUITS) {
    for (const rank of RANKS.slice(0, 9)) {
      await exportCard(page, rank, suit, false, 'standard', `${rank}-${suit}.png`);
    }
  }

  // Jokers
  for (let i = 1; i <= 2; i++) {
    const artPath = resolveAssetPath(baseDir, `joker-${i}${suffix}.png`, suffix);
    await exportCard(page, 'JOKER', '', false, 'standard', `joker-${i}.png`, artPath);
  }

  await browser.close();
}

exportDeck().catch(console.error);
