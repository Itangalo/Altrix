/**
 * @file: Helper functions dealing with in-game decisions.
 */

/**
 * Used for allowing characters to buy from an array of items.
 * Not used for the Store, where items are replenished during buys.
 * Returns unbought items to the deck.
 * Varies with group strategy.
 */
function considerBuy(group, gameState, items) {
  let buy = groupStrategies[global.groupStrategy].preparePurchase(group, gameState, items);
  // Buying goes on until the group strategy says no.
  while (buy) {
    let c = buy.character;
    let item = buy.item;
    c.changeFlux(-1*item.price);
    c.receiveItem(item);
    log(c.name + ' buys ' + item.title, 'buy');
    for (let i in items) {
      if (items[i].title == item.title) {
        items.splice(i, 1);
        continue; // We need the 'continue' since there may be two items with the same title.
      }
    }
    buy = groupStrategies[global.groupStrategy].preparePurchase(group, gameState, items);
  }

  // Return unbought items to the deck.
  for (let i of items) {
    i.deck.addToDeck(i);
  }
}

function isHero(character) {
  let fourCounter = 0;
  for (let s of global.skills) {
    if (character[s] >= 5)
      return true;
    else if (character[s] == 4)
      fourCounter++;
  }
  if (fourCounter >= 2)
    return true;
  return false;
}

function atTheEnd(gameState) {
  for (let c in gameState.characters) {
    if (gameState.characters[c].getNextSpace() != global.locations.towers[global.mode] && gameState.characters[c].getNextSpace() != undefined) {
      return false;
    }
  }
  return true;
}

function honourAndGlory(character) {
  let hog = 0;
  for (let s of global.skills) {
    if (character[s] >= 4)
      hog += 2;
    if (character[s] >= 5)
      hog += 2;
    if (character[s] >= 6)
      hog += 3;
  }
  hog += character.flux / 3;
  for (let t of global.thresholdsCS[global.mode]) {
    if (character.CS >= t)
      hog -= 2;
  }
  return hog;
}
