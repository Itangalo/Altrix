locationResolvers.home = {
  // Fills the store with four items.
  // If there's a character refilling the store, pass a character object.
  // If any items should be kept in the store, pass an array currentItems.
  replenish: function(gameState, character = false, currentItems = false) {
    if (!currentItems)
      gameState.store = [];
    for (let i = gameState.store.length; i < 4; i++) {
      let card = gameState.decks.items.draw();
      if (card.type == 'special') {
        card.deck.addToDeck(card);
        if (character) {
          character.changeFlux(1);
        }
        card.deck.queueShuffling();
      }
      else {
        gameState.store.push(card);
      }
    }
  },

  // Used when a character pays a flux crystal to change all items in the store.
  refreshStore: function(character, gameState) {
    if (character.flux < 1) {
      log(character.name + ' cannot refresh the store. Not enough flux crystals.', 'error');
      return;
    }

    character.changeFlux(-1);
    log(character.name + ' refreshes all items in the Store.', 'store');
    for (let i of gameState.store) {
      i.deck.addToDeck(i);
    }
    locationResolvers.home.replenish(gameState, character);
  },

  // Used when a character buys something from the store.
  buyItem(card, character, gameState) {
    if (character.flux < card.price) {
      log(character.name + ' cannot buy ' + card.title + '. Not enough flux crystals: ' + character.flux, 'error');
      return;
    }
    else {
      let i = gameState.store.indexOf(card);
      if (i > -1) {
        gameState.store.splice(i, 1);
        character.changeFlux(-1*card.price);
        character.receiveItem(card);
        log(character.name + ' buys ' + card.title + ' in the Store.', 'store');
        locationResolvers.home.replenish(gameState, character, gameState.store);
      }
      else {
        log('Cannot remove ' + card.title + ' from store. It is not there.', 'error');
      }
    }
  }
};
