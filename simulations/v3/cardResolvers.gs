cardResolvers.commandSpell = function(card, characters, gameState) {
  // Take of flux crystal from each character, if possible.
  let fluxToPay = characters.length;
  for (let c of characters) {
    if (c.flux > 1) {
      c.changeFlux(-1);
      fluxToPay--;
    }
  }
  // If there are still flux crystals to pay, take from the richest.
  sortBy(characters, 'flux', false);
  for (let c of characters) {
    while (fluxToPay && c.flux > 0) {
      c.changeFlux(-1);
      fluxToPay--;
    }
  }

  // Apply Spell of Command to the character least affected.
  sortBy(characters, 'CS');
  characters[0].CS++;
  log(characters[0].name + ' was smitten by the Spell of Command.', 'CS');
  return characters[0].name + ' was smitten by the Spell of Command.';
}

cardResolvers.shuffle = function(card, characters, gameState) {
  card.deck.queueShuffling();
  sortBy(characters, 'flux');
  characters[0].changeFlux(1);
  return 'Stars are right: ' + characters[0].name + 'gets 1 fluxcrystal and ' + card.deck.id + ' will be shuffled.';
}

cardResolvers.fight = function(card, characters, gameState) {
  // Character with highest fight value will fight first.
  // @TODO: Improve ranged weapon modelling.
  // @TODO: Consider flight over fight sometimes.
  // @TODO: Implement extra damage.
  
  // Shoot the arrows!
  let bonus = 0;
  let bowThresholds = [14, 17]; // Modelled on 3-cost bow.
  for (let c of characters) {
    if (c.fightValues.ranged) {
      let dice = new diceRoll(c);
      for (let i of bowThresholds) {
        if (dice.skillcheck(i, c.ranged) > 0)
          bonus++;
      }
      if (c.levelUp(dice, 'ranged'))
        log(c.name + ' levels up in ranged weapons during fight (now ' + c.ranged + ').', 'levelUp');
    }
  }
  // Close combat!
  sortBySubProperty(characters, 'fightValues', 'max', false);
  for (let c of characters) {
    let dice = new diceRoll(c);
    let result = dice.skillcheck(card.fight, c.fightValues.max + bonus);
    if (c.levelUp(dice, c.fightValues.skill))
      log(c.name + ' levels up in ' + c.fightValues.skill + ' during fight (now ' + c[c.fightValues.skill] + ').', 'levelUp');
    if (result == 2) {
      c.changeFlux(3);
      return c.name + ' beats ' + card.title + ' with a perfect strike.';
    }
    else if (result > 0) {
      return c.name + ' beats ' + card.title + '.';
    }
    else {
      c.changeHP(-1);
    }
  }
  return card.title + ' beat all characters.';
}

cardResolvers.ghost = function(card, characters, gameState) {
  // Character with highest perception value will face the ghost first.
  // @TODO: Implement extra damage.

  sortBy(characters, 'PER', false);
  for (let c of characters) {
    let dice = new diceRoll(c);
    let result = dice.skillcheck(card.success, c.PER);
    if (result == 2) {
      c.changeFlux(3);
      return c.name + ' beats ' + card.title + ' with a perfect roll.';
    }
    else if (result > 0) {
      return c.name + ' beats ' + card.title + '.';
    }
    else {
      c.changeMP(-2);
    }
  }
  return card.title + ' beat all characters.';
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
  // The character with lowest skill value will train.
  let skill = card.trait;
  sortBy(characters, skill);
  let c = characters[0];
  let dice = new diceRoll(c, 5);
  let message = c.levelUp(dice, skill);
  return c.name + ' meets ' + card.title + ': ' + message;
}

cardResolvers.gain = function(card, characters, gameState) {
  return 'Gain card resolver not implemented.';
}

cardResolvers.penalty = function(card, characters, gameState) {
  return 'Penalty card resolver not implemented.';
}

cardResolvers.buy = function(card, characters, gameState) {
  let items = [
    gameState.decks.items.draw(),
    gameState.decks.items.draw(),
    gameState.decks.items.draw(),
  ];
  return considerBuy(characters, gameState, items);
}

cardResolvers.obstacle = function(card, characters, gameState) {
  return 'Obstacle card resolver not implemented.';
}

cardResolvers.spell = function(card, characters, gameState) {
  return 'Spell card resolver not implemented.';
}

cardResolvers.annatar = function(card, characters, gameState) {
  return 'Annatar card resolver not implemented.';
}
