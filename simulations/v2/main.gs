// Simulation-specific data
var characterDataRange = 'J1:P22';
var usedCharacters = ['Riddare', 'Krigare'];

// Simulation-independent data
safeDieCost = 5; // The number of fluxcrystals paid to select outcome of die instead of re-roll.
fallbackIterations = 1;
pathsDataRange = 'A1:AP20';
specialPlaces = ['Hembyn', 'Universitetet', 'Soldatskolan', 'Akademin', 'Dvärgavalvet', 'Lorien', 'Tornet1', 'Tornet2', 'Tornet3'];
spacesRange = 'A2:B62';
cardDataRange = 'A2:P169';
cardColumns = {
  deck: 1,
  type: 2,
  title: 3,
  fight: 5,
  flight: 6,
  success: 7,
  perfect: 8,
  shared: 9,
  fluxRolls: 10,
  trait: 11,
  CS: 16,
};
itemDataRange = 'A2:G60';
itemColumns = {
  title: 1,
  type: 2,
  price: 3,
  Enhands: 4,
  'Tvåhands': 5,
  HP: 6,
  MP: 7,
};
quests = ['Hembyn-Universitetet', 'Hembyn-Akadmin', 'Hembyn-Soldatskolan', 'Universitetet-Hembyn', 'Universitetet-Akadmin', 'Universitetet-Soldatskolan', 'Akademin-Hembyn', 'Akademin-Universitetet', 'Akademin-Soldatskolan', 'Soldatskolan-Hembyn', 'Soldatskolan-Universitetet', 'Soldatskolan-Akademin'];

function simulate(iterations) {
  if (!iterations)
    iterations = fallbackIterations;
  /**
   * Part 1: Set up initial game data.
   */

  // Get character initial data from the spreadsheet and populate the characters object.
  characterData = transpose(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('characters').getRange(characterDataRange).getValues());
  characters = {};
  for (i in characterData) {
    data = buildObject(characterData[i], ":");
    if (usedCharacters.includes(data['Karaktär'])) {
      characters[data['Karaktär']] = data;
    }
  }

  // Build the paths to each character's destinations.
  allPaths = transpose(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('paths').getRange(pathsDataRange).getValues());
  paths = {};
  for (i in allPaths) {
    label = allPaths[i].shift();
    paths[label] = allPaths[i].filter(n => n)
  }

  for (i in characters) {
    var c = characters[i];
    var destinations = c['Platser'].split(', ');
    c.path = [destinations[0]];
    for (j = 1; j < destinations.length; j++) {
      var label = destinations[j-1] + '-' + destinations[j];
      c.path.push(...paths[label]);
      c.path.push(destinations[j]);
    }
  }

  // Get data about regions for each space on the board.
  var regions = buildObject(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('spaces').getRange(spacesRange).getValues());

  // Build card data, sort into decks.
  var cardData = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('cards').getRange(cardDataRange).getValues();
  var decks = {};
  for (var c of cardData) {
    var deck = c[cardColumns.deck-1];
    if (decks[deck] == undefined) {
      decks[deck] = [];
    }
    var card = {};
    for (var i in cardColumns) {
      card[i] = c[cardColumns[i]-1];
    }
    decks[deck].push(card);
  }

  /**
   * Part 2a: Loop through games.
   */
  var results = [];
  for (var i = 0; i < iterations; i++) {
    /**
     * Part 2b: Set up this particular deck.
     */
    // Shuffle the decks.
    for (d in decks) {
      shuffle(decks[d]);
    }

    // Set characters in initial state.
    var chars = JSON.parse(JSON.stringify(characters));
    for (var j in chars) {
      setVulnerableValues(chars[j]);
      setSkillPrio(chars[j]);
    }
    var stats = {
      days: 0,
      allFlux: 0,
      fluxLoss: 0,
      allLevelUp: 0,
      CS: 0,
    }

    /**
     * Part 3: Play through the game.
     */
    while (!atTheEnd(chars)) {
      stats.days++;
      /**
       * Part 3a: Roll and move.
       */
      var groups = {};
      for (j in chars) {
        var char = chars[j];
        var dice = roll();
        checkFlowRoll(dice, char, stats);
        // @TODO: Potentially pay fluxcrystals to turn pairs into three-of-a-kind to level up.
        if (countEquals(dice, true) >= 3)
          levelUp(dice, char, stats)

        // Synchronize groups that move together.
        // Movement is synched if characters share group name and id of next space on their path.
        char.space = char.path.shift();
        var groupId = char.Grupp + char.space;
        if (!groups[groupId]) {
          groups[groupId] = {members: []};
          groups[groupId].additionalMoves = countEquals(dice) - 1;
        }
        groups[groupId].members.push(j);
        groups[groupId].additionalMoves = Math.min(groups[groupId].additionalMoves, countEquals(dice) - 1);
      }
      // Move one group at a time.
      for (var j in groups) {
        var group = groups[j];
        for (var k of group.members) {
          for (var l = 0; l < group.additionalMoves; l++) {
            // Don't go past special places.
            if (!specialPlaces.includes(chars[k].space)) {
              chars[k].space = chars[k].path.shift();
            }
          }
        }
      }

      /**
       * Part 3b: Draw and resolve cards.
       */
      // We group characters by their spaces, since cards are shared by characters on a space.
      groups = {};
      for (var j in chars) {
        if (!groups[chars[j].space]) {
          groups[chars[j].space] = {members: []};
        }
        groups[chars[j].space].members.push(chars[j]);
      }
      // Draw a card for each non-special place with characters on them.
      for (var j in groups) {
        if (!specialPlaces.includes(j)) {
          var card = decks[regions[j]].shift();
          decks[regions[j]].push(card);

          // Resolve card.
          if (card.type == 'Händelse') {
            if (card.title == 'Värdefullt fynd') {
              crValuableFinding(card, groups[j].members, stats);
            }
          }
          if (card.type == 'Ande') {
            crGhost(card, groups[j].members, stats);
          }
          if (card.type == 'Fiende') {
            crFight(card, groups[j].members, stats);
          }
          //Logger.log(stats.days + ': ' + j + ': ' + Object.keys(groups[j].members) + ': ' + card.title);

          if (card.CS) {
            crCommandSpell(card, groups[j].members, stats);
          }
        }
      }




      /**
       * Part 3c: Take actions at special places.
       */
      for (j in chars) {
        var char = chars[j];
        if (specialPlaces.includes(char.space)) {
          char.Flux += 3;
          stats.allFlux += 3;
          //Logger.log(char['Karaktär'] + ': ' + char.space);
        }
      }
      // @TODO:
      // Cache in quest reward and return it.
      // Check how much as most to spend on attempting to level up.
      // Attempt to level up, including re-rolls if relevant.
      // Pay for healing, if relevant.
      // Determine new destination, based on prioritized skills and available quests.
      // (Destination could be on the dark side.)
      // Build path to new destination.

      /**
       * Part 3d: Pay to heal, if deemed necessary.
       */
      for (j in chars) {
        payToHeal(chars[j]);
      }
    }

    /**
     * Part 4: Process and store some stats for the game.
     */
    //for (j in chars) {
    //  stats.allFlux += chars[j].Flux;
    //  stats.allLevelUp += chars[j]['Level up'];
    //}
    stats.levelUpPerCharacter = stats.allLevelUp / usedCharacters.length;
    stats.netFlux = stats.allFlux - stats.fluxLoss;
    stats.fluxPerCharacterDay = stats.netFlux / usedCharacters.length / stats.days;
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

/**
 * Functions helping with in-game decisions.
 */

// Returns true if one or more characters has reached the end space, otherwise false.
function atTheEnd(chars) {
  for (i in chars) {
    if (chars[i].path.length < 2) {
      return true;
    }
  }
  return false;
}

// Sets a level up prio for a character.
// 4 means that level up is very good and should happen before end game.
// 3 means that level up is very good.
// 2 means that level up is good.
// 1 means that level up is useful.
// 0 means that level up does not really matter.
function setSkillPrio(char) {
  // Set baseline prio.
  var skillPrio = {
    Smyga: 0,
    Enhands: 3,
    'Tvåhands': 3,
    'Avstånds': 2,
    'Besvärjelser': 1
  };
  for (var i in skillPrio) {
    // If level up gives more glory points, level up is always useful.
    if (char[i] > 2 && char[i] < 6)
      skillPrio[i] = Math.max(skillPrio[i], 1);
    // If maxed out, no need to level up more.
    if (char[i] > 5)
      skillPrio[i] = 0;
  }
  // If no fighting skill has reached level 4, leveling up is important.
  if (char.Enhands > 4 && char['Tvåhands'] < 4) {
    skillPrio.Enhands = 4;
    skillPrio['Tvåhands'] = 4;
  }
  // If one fighting skill is ahead of the other, ditch the other.
  if (char['Tvåhands'] > char.Enhands)
    skillPrio.Enhands = 0 + (char.Enhands > 2 && char.Enhands < 6) * 1;
  if (char['Tvåhands'] < char.Enhands)
    skillPrio['Tvåhands'] = 0 + (char['Tvåhands'] > 2 && char['Tvåhands'] < 6) * 1;
  var max = 0;
  for (var i in skillPrio) {
    max = Math.max(max, skillPrio[i]);
  }
  skillPrio.max = {
    value: max,
    skills: []
  };
  for (var i in skillPrio) {
    if (skillPrio[i] == max)
      skillPrio.max.skills.push(i);
  }
  char.skillPrio = skillPrio;
}

// Levels up the most relevant skill possible.
// Returns true if level up, otherwise false.
function levelUp(dice, char, stats) {
  // Randomize order to check skills to avoid prioritizing based on alphabetical order or so.
  var skills = ['Smyga', 'Enhands', 'Tvåhands', 'Avstånds', 'Besvärjelser'];
  shuffle(skills);
  for (var v = char.skillPrio.max.value; v >= 0; v--) {
    for (var s of skills) {
      if (char.skillPrio[s] >= v && char[s] < dice[0]) {
        char[s]++;
        char['Level up']++;
        stats.allLevelUp++;
        Logger.log(s + ' level up: ' + char[s]);
        setSkillPrio(char);
        return true;
      }
    }
  }
  return false;
}

// Sets a value for how vulnerable a character is. 0 for both HP and MP above 2.
function setVulnerableValues(char) {
  if (char.HP > 2) {
    char.vulnerableHP = 0;
  }
  else {
    char.vulnerableHP = Math.max(3 - char.HP, 0);
  }
  if (char.MP > 2) {
    char.vulnerableMP = 0;
  }
  else {
    char.vulnerableMP = Math.max(3 - char.MP, 0);
  }

  char.vulnerableValue = char.vulnerableHP + char.vulnerableMP;
  // Modify total vulnerable value for some special cases, for a better scale.
  if ((char.HP > 2 && char.MP == 1) || (char.HP == 1 && char.MP > 2))
    char.vulnerableValue = 3;
  if (char.HP + char.MP == 3)
    char.vulnerableValue = 4;
  if (char.HP + char.MP == 2)
    char.vulnerableValue = 5;
  
  if (char.HP > char.MP) {
    char.vulnerableStat = 'MP';
  }
  else {
    char.vulnerableStat = 'HP';
  }
}

// Decides whether the character should pay to heal and, if so, does it.
// If more than 1 HP or MP can be restored per paid unit, set the parameters.
// Function is called recursively, until character can't or shouldn't be healed more.
function payToHeal(char, HP = -1, MP = -1) {
  // Check if the character can heal relevant stats or indeed needs healing at all.
  if (char.Flux == 0 || char.vulnerableValue == 0) // No can or no need.
    return;
  if (char.vulnerableHP * HP == 0 && char.vulnerableMP * MP == 0) // Relevant stat cannot be healed.
    return;
  if (char.Flux == 1 && char.vulnerableValue < 3) // If flux is low, only heal for critical cases.
    return;
  
  // Heal most needed stat first, then check other stat.
  char.Flux--;
  if (char.vulnerableStat == 'HP') {
    if (HP) {
      char.HP += Math.abs(HP);
      if (MP > 0)
        char.MP += MP;
    }
    else {
      char.MP += Math.abs(MP);
      if (HP > 0)
        char.HP += HP;
    }
  }
  else {
    if (MP) {
      char.MP += Math.abs(MP);
      if (HP > 0)
        char.HP += HP;
    }
    else {
      char.HP += Math.abs(HP);
      if (MP > 0)
        char.MP += MP;
    }
  }
  char.HP = Math.min(char.HP, char['HP max']);
  char.MP = Math.min(char.MP, char['MP max']);
  setVulnerableValues(char);
  payToHeal(char, HP, MP);
}

// Shorthand function for checking and resolving flow rolls.
function checkFlowRoll(dice, char, stats) {
  if (checkStraight(dice)) {
    char.Flux++;
    stats.allFlux++
  }
}

// Returns 'Enhands' or 'Tvåhands' depending on prefered fighting skill.
function getPrimarySkill(char) {
  if (char.Enhands > char['Tvåhands'])
    return 'Enhands';
  return 'Tvåhands';
}

// Used for sorting lists of objects by a property, such as how vulnerable characters are.
function sortBy(list, property, ascending = true) {
  if (ascending) {
    list.sort((a, b) => a[property] > b[property] ? 1 : -1);
  }
  else {
    list.sort((a, b) => b[property] > a[property] ? 1 : -1);
  }
}

function myFunction() {
  char1 = {
    Flux: 13,
    HP: 1,
    MP: 1,
    'HP max': 4,
    'MP max': 4,
  }
  char2 = {
    Flux: 12,
    HP: 3,
    MP: 1,
    'HP max': 4,
    'MP max': 4,
  }
  list = [char1, char2];
  sortBy(list, 'HP', false);
  Logger.log(list);
}
