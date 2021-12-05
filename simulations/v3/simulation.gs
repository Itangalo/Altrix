// Some global variables.
var global = {
  allowedModes: ['long', 'medium', 'short', 'small'],
  defaultCharacterSheet: 'characters',
  defaultCharacterRange: 'J1:P21',
};
var initialGameState = {};
var strategies = {};
var groupStrategies = {};
var cardResolvers = {};
var locationResolvers = {};

function tmp() {
  simulate(200);
}

function simulate(iterations, mode) {
  /**
   * Part 1: Build global data and initial game state.
   */
  if (!global.allowedModes.includes[mode]) {
    mode = global.allowedModes[0];
  }
  global.mode = mode;
  setUpData();

  /**
   * Part 2a: Loop through games.
   */
  if (!iterations)
    iterations = global.fallbackIterations;

  let results = []; // Game results are stored here.
  for (let iteration = 0; iteration < iterations; iteration++) {
    log('## Game number ' + iteration, 'iteration');

    /**
     * Part 2b: Set up this particular game session.
     */
    // The stats variable are used to track things to dump in the results array.
    let stats = {
      days: 0,
      CS: 0,
      completedQuests: 0,
    }

    // Make a copy of the data for the initial game state.
    let gs = JSON.parse(JSON.stringify(initialGameState));
    // Use special classes for characters and decks.
    for (let id in gs.decks) {
      gs.decks[id] = new deck(gs.decks[id], id);
    }
    for (let name in gs.characters) {
      gs.characters[name] = new character(gs.characters[name], gs);
    }

    // Allow players to buy from first 8 cards in the items deck.
    // @TODO: Mock that each players has a discount of 1 to use once.
    let initialItems = [];
    for (let i = 0; i < 8; i++) {
      initialItems.push(gs.decks.items.draw());
    }
    let group = [];
    for (let i in gs.characters) {
      if (gs.characters[i].space == 'Home')
        group.push(gs.characters[i]);
    }
    considerBuy(group, gs, initialItems);
    locationResolvers.home.replenish(gs);

    /**
     * Part 3: Play through the game.
     */
    while (!atTheEnd(gs)) {
      stats.days++;
      log('-- Day ' + stats.days + ' --', 'days');
      gs.days = stats.days;
      /**
       * Part 3a: Roll and move.
       */
      let groups = {};
      for (let j in gs.characters) {
        let char = gs.characters[j];
        let dice = new diceRoll(char);
        char.payToLevelUpMovement(dice);
        if (dice.countEquals(true) >= 3) {
          message = char.levelUp(dice);
          log('Movement: ' + message, 'levelUp');
        }

        // Synchronize groups that move together.
        // Movement is synched if characters share group name and either id of the current space.
        // @TODO: Consider forming or disbanding groups.
        //let nextSpace = char.getNextSpace();
        let groupId = char.group + char.space;
        if (!groups[groupId]) {
          groups[groupId] = {members: [j]};
          groups[groupId].moves = dice.countEquals();
        }
        else {
          groups[groupId].moves = Math.min(groups[groupId].moves, dice.countEquals());
          groups[groupId].members.push(j);
        }
      }
      // Move one group at a time.
      for (let j in groups) {
        for (let k of groups[j].members) {
          gs.characters[k].move(groups[j].moves);
        }
      }
      // @TODO: Consider giving flux crystals and items between characters.

      /**
       * Part 3b: Draw and resolve cards.
       */
      // We group characters by their spaces, since cards are shared by characters on a space.
      groups = {};
      for (let i in gs.characters) {
        if (!global.locations.list.includes(gs.characters[i].space) && gs.characters[i].space != undefined) {
          if (!groups[gs.characters[i].space]) {
            groups[gs.characters[i].space] = [];
          }
          groups[gs.characters[i].space].push(gs.characters[i]);
        }
      }
      // Draw a card for each non-special place with characters.
      for (let i in groups) {
        let card = gs.decks[global.spaces[i]].drawAndReturn();

        // Checks that the card has a valid resolver and then calls it.
        if (card.resolver) {
          if (!cardResolvers[card.resolver])
            throw('Card resolver ' + card.resolver + ' does not exist.');
          let message = cardResolvers[card.resolver](card, groups[i], gs);
          log(card.title + ' (' + groups[i].length + ' characters at place ' + i + '): ' + message, 'cardResult');
        }

        // Command spell is an extra event, not the main card resolver.
        if (card.CS) {
          stats.CS++;
          let message = cardResolvers.commandSpell(card, groups[i], gs);
          log('Command spell: ' + message, 'commandSpell');
        }
      }

      /**
       * Part 3c: Take actions at special places.
       */
      // Some actions (going to the shop) is relevant to do as a group.
      // So we loop through locations and form groups, rather than only looping through characters.
      for (let location of global.locations.list) {
        // Form the groups.
        let group = [];
        let present = [];
        for (let c in gs.characters) {
          if (gs.characters[c].space == location) {
            group.push(gs.characters[c]);
            present.push(c);
          }
        }
        if (group.length == 0) {
          continue;
        }
        if (group.length)
          log('Day ' + stats.days + ', at ' + location + ': ' + present.join(', '), 'atLocation');


        // Cache in quest rewards and return them.
        for (let c of group) {
          if (c.quest && c.quest.split('-').pop() == location) {
            stats.completedQuests++;
            c.changeFlux(gs.quests.rewards[c.quest]);
            gs.quests.available.push(c.quest);
            c.quest = false;
            log('Reward for finished quest: ' + c.name, 'quest');
          }
        }

        // Go shopping, if relevant.
        if (location == 'Home') {
          let buy = groupStrategies[global.groupStrategy].preparePurchase(group, gs);
          // Buying goes on until the group strategy says no.
          while (buy) {
            locationResolvers.home.buyItem(buy.item, buy.character, gs);
            buy = groupStrategies[global.groupStrategy].preparePurchase(group, gs);
          }
        }

        // Give opportunity for training, if relevant.
        if (global.locations[location].training) {
          for (let c of group) {
            let skill = global.locations[location].training[0];
            // Take care of special case where you can train two different skills.
            // Note: Strategy to never train skill at 4 or higher is hard-coded here.
            if (global.locations[location].training[1] && c[global.locations[location].training[1]] < 4 && c.skillPrio[global.locations[location].training[1]] > c.skillPrio[global.locations[location].training[0]])
              skill = global.locations[location].training[1];
            let message = c.payForTraining(skill);
            log(c.name + ' considers training: ' + message, 'considerTraining');
          }
        }

        // Pay for healing, if relevant.
        if (global.locations[location].healing) {
          for (let c of group) {
            let message = c.payToHeal(global.locations[location].healing);
            if (message)
              log(i + ' payed for healing at ' + location + '.', 'payForHealing');
          }
        }

        // Set next destination based on skills and available quests.
        // Shuffle order to give equal chances to find good quests.
        shuffle(group);
        for (let c of group) {
          let message = c.setDestination(gs);
          log(c.name + ' decides to go to ' + message, 'selectDestination');
        }
      }

      /**
       * Part 3d: Pay to heal at sunset, if deemed necessary.
       */
      // @TODO: Consider giving flux crystals and items between characters.
      for (let i in gs.characters) {
        let message = gs.characters[i].payToHeal();
        if (message)
          log(i + ' payed for healing at sunset.', 'payForHealing');
      }

      /**
       * Part 3e: Shuffle any decks queued for shuffling.
       */
      for (let d in gs.decks) {
        gs.decks[d].considerShuffling();
      }
    }

    /**
     * Part 4: Process and store some stats for the game.
     */
    // @TODO: Make this code much prettier and less repetitive.
    let sums = ['passOuts'];
    let mins = ['CS', 'fightValues.max'];
    let maxes = ['CS', 'fightValues.max', 'path.length', 'goDarkDay'];
    let average = ['heals', 'MPspillover', 'flux'];
    let specials = ['honourAndGlory'];
    stats.stepsLeft = 0;
    stats.minCS = 100;
    stats.maxCS = 0;
    stats.hog = 0;
    stats.minFight = 100;
    stats.maxFight = 0;
    stats.passOuts = 0;
    stats.heals = 0;
    stats.HPloss = 0;
    stats.spilloverPerCharacter = 0;
    stats.flux = 0;
    stats.goDarkDay = 0;
    let numberOfCharacters = 0;
    for (let i in gs.characters) {
      numberOfCharacters++;
      stats.minCS = Math.min(gs.characters[i].CS, stats.minCS);
      stats.maxCS = Math.max(gs.characters[i].CS, stats.maxCS);
      stats.minFight = Math.min(gs.characters[i].fightValues.max, stats.minFight);
      stats.maxFight = Math.max(gs.characters[i].fightValues.max, stats.maxFight);
      stats.stepsLeft = Math.max(gs.characters[i].path.length, stats.stepsLeft);
      stats.passOuts += gs.characters[i].passOuts;
      stats.heals += gs.characters[i].heals;
      stats.spilloverPerCharacter += gs.characters[i].MPspillover;
      stats.flux += gs.characters[i].flux;
      stats.hog += honourAndGlory(gs.characters[i]);
      stats.goDarkDay = Math.max(gs.characters[i].goDarkDay, stats.goDarkDay);
    }
    stats.heals = stats.heals / numberOfCharacters;
    stats.spilloverPerCharacter = stats.spilloverPerCharacter / numberOfCharacters;
    stats.fluxPerCharacterDay = stats.flux / numberOfCharacters / stats.days;
    results.push(stats);
  }

  /**
   * Part 5: Build output and return it.
   */
  // Sort results. (Needed for percentiles.)
  var sortedResults = {};
  for (var i in results[0]) {
    sortedResults[i] = [];
  }
  for (var i in results) {
    for (var j in results[i]) {
      sortedResults[j].push(results[i][j]);
    }
  }
  for (var i in sortedResults) {
    sortedResults[i].sort(function(a, b) {
      return a - b;
    });
  }

  // Build output array.
  var output = [['']];
  for (var i in sortedResults) {
    output[0].push(i);
  }
  output.push(['Average']);
  for (var i in sortedResults) {
    output[1].push(average(sortedResults[i]));
  }
  for (p = 0; p <= 100; p = p + 5) {
    var line = ['percentile ' + p];
    for (var i in sortedResults) {
      line.push(percentile(sortedResults[i], p/100));
    }
    output.push(line);
  }
  return output;
}
