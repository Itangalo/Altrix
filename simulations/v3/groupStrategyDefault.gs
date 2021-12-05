groupStrategies.default = {
  /**
   * Returns object on the form {character: c, item: i}, or false if no buy should be made.
   * May give flux crystals between characters in the group. May also refresh the Store.
   * Does not carry out the actual purchase.
   */
  preparePurchase: function(characters, gameState, availableItems = false) {
    // Pools flux crystals if necessary.
    // Lets each character individually assess available items within economic range.
    // Buyer is randomly chosen among highest assessments.
    // If no useful item is found, the Store is refreshed if it leaves every character
    // in the group with one flux crystal AND three more to spare.

    // Sum up the available flux crystals.
    let totalFlux = 0;
    for (let c of characters) {
      totalFlux += c.flux;
    }

    let assessments = {};
    let allowRefresh = true;
    assessments[global.itemPrio.useful] = [];
    assessments[global.itemPrio.important] = [];
    if (!availableItems) {
      availableItems = gameState.store;
    }
    else {
      allowRefresh = false;
    }
    for (let i of availableItems) {
      if (i.price <= totalFlux) {
        for (let c of characters) {
          let p = c.evaluateItem(i);
          if (p)
            assessments[p].push({character: c, item: i});
        }
      }
    }

    let purchase = false;
    if (assessments[global.itemPrio.important].length) {
      shuffle(assessments[global.itemPrio.important]);
      purchase = assessments[global.itemPrio.important].shift();
    }
    else if (assessments[global.itemPrio.useful].length) {
      shuffle(assessments[global.itemPrio.useful]);
      purchase = assessments[global.itemPrio.useful].shift();
    }

    // If nothing interesting is found, let the richest character pay for refreshing the Store,
    // if the group has enough flux crystals. (But only shopping is done at the store.)
    if (allowRefresh) {
      sortBy(characters, 'flux', false);
      if (!purchase) {
        if (totalFlux > 3 + characters.length) {
          locationResolvers.home.refreshStore(characters[0], gameState);
          return groupStrategies[global.groupStrategy].preparePurchase(characters, gameState);
        }
        else {
          return false;
        }
      }
    }
    if (!purchase)
      return false;

    // Other players draw lots for givng flux crystals to the buyer until she
    // can pay for the item. (If at all needed.)
    while (purchase.character.flux < purchase.item.price) {
      let giver = Math.floor(Math.random()*characters.length);
      if (characters[giver].flux > 0 && characters[giver].name != purchase.character.name) {
        characters[giver].giveFluxTo(1, purchase.character);
      }
    }
    return purchase;
  },
};
