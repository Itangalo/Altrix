cardResolvers.commandSpell = function(card, characters, gameState) {
  return 'CommandSpell card resolver not implemented.';
}

cardResolvers.shuffle = function(card, characters, gameState) {
  return 'Shuffle card resolver not implemented.';
}

cardResolvers.valuableFind = function(card, characters, gameState) {
  sortBySubProperty(characters, 'vulnerable', 'value');
  let c = characters[0];
  let dice = new diceRoll(c);

  let sum = dice.ownDice.reduce((a, b) => a + b);
  if (sum >= card.params[2])
    log('Magic items not implemented.', 'implementationMissing'); // @TODO: Implement magic items.
  if (sum >= card.params[1]) {
    let card = gameState.decks.items.draw();
    // @TODO: Find a smarter solution for special cards, also for finding magic items.
    while (card.type == 'special') {
      card.deck.addToDeck(card);
      card.deck.queueShuffling();
      c.changeFlux(1);
      card = gameState.decks.items.draw();
    }
    c.receiveItem(card);
    return 'item';
  }
  if (sum >= card.params[0]) {
    c.changeFlux(2);
    return '2 flux crystals';
  }
  if (sum >= card.success) {
    c.changeFlux(1);
    return '1 flux crystal';
  }
}

cardResolvers.training = function(card, characters, gameState) {
  return 'Training card resolver not implemented.';
}

cardResolvers.gain = function(card, characters, gameState) {
  return 'Gain card resolver not implemented.';
}

cardResolvers.penalty = function(card, characters, gameState) {
  return 'Penalty card resolver not implemented.';
}

cardResolvers.fight = function(card, characters, gameState) {
  return 'Fight card resolver not implemented.';
}

cardResolvers.ghost = function(card, characters, gameState) {
  return 'Ghost card resolver not implemented.';
}

cardResolvers.buy = function(card, characters, gameState) {
  return 'Buy card resolver not implemented.';
}

cardResolvers.obstacle = function(card, characters, gameState) {
  return 'Obstacle card resolver not implemented.';
}

cardResolvers.spell = function(card, characters, gameState) {
  return 'Annatar card resolver not implemented.';
}

cardResolvers.annatar = function(card, characters, gameState) {
  return 'Annatar card resolver not implemented.';
}
