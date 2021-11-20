function atTheEnd(gameState) {
  for (let c in gameState.characters) {
    if (gameState.characters[c].getNextSpace() == global.locations.towers[global.mode] || gameState.characters[c].getNextSpace() == undefined) {
      return true;
    }
  }
  return false;
}
