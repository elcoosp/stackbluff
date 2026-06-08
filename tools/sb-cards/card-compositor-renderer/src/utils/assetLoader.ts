export function resolveAssetPath(deckName: string, filename: string, suffix: string): string {
  const cleanName = filename.replace(/^.*[\\/]/, '');
  if (cleanName.match(/^(back|ace|jack|queen|king|number-template|corner-plaque|border|center-band|joker-)/)) {
    return `/decks/${deckName}/art/${cleanName}`;
  } else {
    return `/decks/${deckName}/pips/${cleanName}`;
  }
}
