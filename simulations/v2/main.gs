// Simulation-specific data
var characterDataRange = 'J1:P22';

// Simulation-independent data
var safeDieCost = 5; // The number of fluxcrystals paid to select outcome of die instead of re-roll.
var fallbackIterations = 1;
var pathsDataRange = 'A1:AP20';
var specialPlaces = ['Hembyn', 'Universitetet', 'Soldatskolan', 'Akademin', 'Dvärgavalvet', 'Lorien', 'Tornet1', 'Tornet2', 'Tornet3'];
var spacesRange = 'A2:B62';
var cardDataRange = 'A2:P169';
var cardColumns = {
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
var itemDataRange = 'A2:G60';
var itemColumns = {
  title: 1,
  type: 2,
  price: 3,
  Enhands: 4,
  'Tvåhands': 5,
  HP: 6,
  MP: 7,
};
var paths = {};
var quests = ['Hembyn-Universitetet', 'Hembyn-Akademin', 'Hembyn-Soldatskolan', 'Universitetet-Hembyn', 'Universitetet-Akademin', 'Universitetet-Soldatskolan', 'Akademin-Hembyn', 'Akademin-Universitetet', 'Akademin-Soldatskolan', 'Soldatskolan-Hembyn', 'Soldatskolan-Universitetet', 'Soldatskolan-Akademin'];
var specialPlaceHealing = {
  'Hembyn': [1, 1],
  'Universitetet': [0, 2],
  'Soldatskolan': [2, 0],
  'Akademin': [1, 1],
  'Dvärgavalvet': [2, 1],
  'Lorien': [1, 2]
}
var specialPlaceTraining = {
  'Universitetet': ['Besvärjelser'],
  'Soldatskolan': ['Tvåhands', 'Avstånds'],
  'Akademin': ['Enhands'],
};

function simulate(iterations) {
  if (!iterations)
    iterations = fallbackIterations;
  /**
   * Part 1: Set up initial game data.
   */

  // Get character initial data from the spreadsheet and populate the characters object.
  var characterData = transpose(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('characters').getRange(characterDataRange).getValues());
  var characters = {};
  var numberOfCharacters = 0;
  for (i in characterData) {
    data = buildObject(characterData[i], ":");
    if (data['Grupp']) {
      characters[data['Karaktär']] = data;
      numberOfCharacters++;
    }
  }
  debugger

  // Build the paths to each character's destinations.
  var allPaths = transpose(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('paths').getRange(pathsDataRange).getValues());
  //paths = {};
  for (var i in allPaths) {
    var label = allPaths[i].shift();
    paths[label] = allPaths[i].filter(n => n)
  }

  for (var i in characters) {
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
      chars[j].space = chars[j].path.shift();
      setDestination(chars[j]);
    }
    var stats = {
      days: 0,
      allFlux: 0,
      fluxLoss: 0,
      allLevelUp: 0,
      healings: 0,
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
      for (var j in chars) {
        var char = chars[j];
        var dice = roll();
        if (char.vulnerableHP || char.vulnerableMP)
          Logger.log(char['Karaktär'] + ' low: ' + char.HP + '/' + char.MP);
        checkFlowRoll(dice, char, stats);
        payToLevelUpMovement(dice, char); // Potentially pay fluxcrystals to turn pairs into three-of-a-kind to level up.
        if (countEquals(dice, true) >= 3)
          levelUp(dice, char, stats);

        // Synchronize groups that move together.
        // Movement is synched if characters share group name and id of next space on their path.
        char.space = char.path.shift();
        var groupId = char.Grupp + char.space;
        if (!groups[groupId]) {
          groups[groupId] = {members: [j]};
          groups[groupId].additionalMoves = countEquals(dice) - 1;
        }
        else {
          groups[groupId].additionalMoves = Math.min(groups[groupId].additionalMoves, countEquals(dice) - 1);
          groups[groupId].members.push(j);
        }
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
      var groups = {};
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
      for (var j in chars) {
        var char = chars[j];
        if (specialPlaces.includes(char.space)) {
          var space = char.space;
          Logger.log('Day ' + stats.days + ': ' + char['Karaktär'] + ' is at ' + space);

          // Cache in quest reward and return it.
          if (char.quest) {
            var reward = 3;
            if (['Soldatskolan-Akademin', 'Akademin-Soldatskolan'].includes(char.quest))
              reward = 4;
            char.Flux += reward;
            stats.allFlux += reward;
            quests.push(char.quest);
            char.quest = false;
          }

          // Pay for healing, if relevant.
          if (specialPlaceHealing[space]) {
            payToHeal(char, stats, specialPlaceHealing[space][0], specialPlaceHealing[space][1]);
          }

          // Attempt to level up, including re-rolls if relevant.
          if (specialPlaceTraining[space]) {
            var skill = specialPlaceTraining[space][0];
            // Take care of special case where you can train two different skills.
            if (specialPlaceTraining[space][1] && char.skillPrio[specialPlaceTraining[space][1]] > char.skillPrio[specialPlaceTraining[space][0]])
              skill = specialPlaceTraining[space][1];
            var cost = {
              0: 3,
              1: 3,
              2: 4,
              3: 4,
              4: 5,
              5: 8
            }
            if (char.Flux >= cost[char[skill]]) {
              dice = roll(3 * cost[char[skill]]);
              char.Flux -= cost[char[skill]];
              stats.fluxLoss += cost[char[skill]];
              Logger.log(char['Karaktär'] + ' considers training ' + skill + ' (' + 3*cost[char[skill]] + ' dice)');
              payToLevelUpTraining(dice, char, skill, stats);
              if (countEquals(dice, false, char[skill]) >= 3) {
                char[skill]++;
                stats.allLevelUp++;
                Logger.log(skill + ' level up: ' + char[skill]);
              }
            }
          }

          // Set next destination based on skills and available quests.
          setDestination(char);
        }
      }

      /**
       * Part 3d: Pay to heal, if deemed necessary.
       */
      for (j in chars) {
        payToHeal(chars[j], stats);
      }
    }

    /**
     * Part 4: Process and store some stats for the game.
     */
    //for (j in chars) {
    //  stats.allFlux += chars[j].Flux;
    //  stats.allLevelUp += chars[j]['Level up'];
    //}
    stats.levelUpPerCharacter = stats.allLevelUp / numberOfCharacters;
    stats.netFlux = stats.allFlux - stats.fluxLoss;
    stats.fluxPerCharacterDay = stats.netFlux / numberOfCharacters / stats.days;
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

// Returns true if one or more characters has reached the Evil Sorceress, otherwise false.
function atTheEnd(chars) {
  for (i in chars) {
    if (['Tornet1', 'Tornet2', 'Tornet3'].includes(chars[i].space))
      return true;
  }
  return false;
}

// Selects destination for character based on prio skills and available quests.
// Also takes a new quest, if appropriate and possible.
// If path to a new destination is already set, no new is added (but quests are considered).
function setDestination(char) {
  var here = char.space;
  var there = false;
  // Check if there is already a destination in the path.
  for (var i = 1; i < char.path.length; i++) {
    if (specialPlaces.includes(char.path[i])) {
      there = char.path[i];
      takeQuest(char, here, there);
      return;
    }
  }

  // Check if player is ready for end fight.
  if (['Lorien', 'Dvärgavalvet', 'Tornet1', 'Tornet2', 'Tornet3'].includes(here)) {
    there = 'Tornet3';
    buildPath(char, here, there);
    return;
  }
  if (char.skillPrio.max.value < 4) {
    there = 'Dvärgavalvet';
    if (here == 'Akademin')
      there = 'Lorien';
    buildPath(char, here, there);
    return;
  }

  // Look for destinations matching the highly prioritized skills, where quests are available.
  // Shuffle to avoid systematic bias.
  var skills = shuffle(['Enhands', 'Tvåhands', 'Avstånds', 'Besvärjelser']);
  for (var p of [4, 3, 2, 1, 0]) {
    for (var s of skills) {
      for (var d in specialPlaceTraining) {
        if (d != here && char.skillPrio[s] == p && specialPlaceTraining[d].includes(s) && quests.includes(here + '-' + d)) {
          there = d;
          buildPath(char, here, there);
          takeQuest(char, here, there);
          return;
        }
      }
    }
  }

  // If no destination is found, there is no matching quest. Go for the highest prioritized skill.
  // @TODO: Add Hembyn to possible destinations, though no training can be done there.
  for (var p of [4, 3, 2, 1, 0]) {
    for (var s of skills) {
      for (var d in specialPlaceTraining) {
        if (d != here && char.skillPrio[s] == p && specialPlaceTraining[d].includes(s)) {
          there = d;
          buildPath(char, here, there);
          return;
        }
      }
    }
  }
}

// Adds a path from here to there for a character.
function buildPath(char, here, there) {
  if (!paths[here + '-' + there])
    return;
  char.path.push(...paths[here + '-' + there]);
  char.path.push(there);
}

// Gives a character a quest from here to there, if available.
function takeQuest(char, here, there) {
  var label = here + '-' + there;
  if (quests.includes(label)) {
    char.quest = label;
    quests.splice(quests.indexOf(label), 1);
  }
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
  // If no fighting skill has reached level 4, leveling up is very important.
  if (char.Enhands < 4 && char['Tvåhands'] < 4) {
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
  // @TODO: Refactor to remove the array with skills. It is not used, so max should be stored flat.
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
  var skills = shuffle(['Smyga', 'Enhands', 'Tvåhands', 'Avstånds', 'Besvärjelser']);
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
function payToHeal(char, stats, HP = -1, MP = -1) {
  // Check if the character can heal relevant stats or indeed needs healing at all.
  if (char.Flux == 0 || char.vulnerableValue == 0) // No can or no need.
    return;
  if (char.vulnerableHP * HP == 0 && char.vulnerableMP * MP == 0) // Relevant stat cannot be healed.
    return;
  if (char.Flux == 1 && char.vulnerableValue < 3) // If flux is low, only heal for critical cases.
    return;
  
  // Heal most needed stat first, then check other stat.
  char.Flux--;
  stats.fluxLoss++;
  stats.healings++;
  Logger.log(char['Karaktär'] + ' pays to heal (is at ' + char.HP + '/' + char.MP + ')');

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
  payToHeal(char, stats, HP, MP);
}

// Decides whether a character should pay to turn a pair into three-of-a-kind
// in the movement roll in order to level up and, if so, does it.
// Actual leveling up is done outside this function.
function payToLevelUpMovement(dice, char) {
  // Check two necessary basic conditions.
  if (char.Flux < safeDieCost || countEquals(dice, true) != 2)
    return;

  // Shuffle to avoid bias.
  var skills = shuffle(['Smyga', 'Enhands', 'Tvåhands', 'Avstånds', 'Besvärjelser']);
  
  // Set thresholds for how many fluxcrystals the character should have left in order
  // to pay for leveling up, depending on prio of skill.
  var threshold = {
    4: safeDieCost,
    3: safeDieCost,
    2: safeDieCost + 2,
    1: safeDieCost + 4,
  };
  // Check skills in decending order of priority.
  for (var p of [4, 3, 2, 1]) {
    for (var s of skills) {
      // Note that dice[1] will always show the value of the pair.
      // First condition is to make sure that only skills of given priority is checked against.
      if (char.skillPrio[s] == p && dice[1] > char[s] && char.Flux >= threshold[char.skillPrio[s]]) {
        dice[0] = dice[1];
        dice[2] = dice[1];
        char.Flux -= safeDieCost;
        Logger.log(char['Karaktär'] + ' paid to level up ' + s + '. Flux is at ' + char.Flux);
        return;
      }
    }
  }
}

// Decides whether a character should pay to reroll a die to perhaps get three-of-a-kind
// in a training roll in order to level up and, if so, does it.
// If a die is re-rolled, the function is called again.
// Actual leveling up is done outside this function.
function payToLevelUpTraining(dice, char, skill, stats) {
  // First check if there are fluxcrystals and if there is at most a pair above the skill value.
  if (char.Flux < 1 || countEquals(dice, false, char[skill]) != 2)
    return;
  
  // Only reroll if there are enough fluxcrystals, based on prio of skill.
  var threshold = {
    4: 1,
    3: 1,
    2: 3,
  };
  if (char.Flux >= threshold[char.skillPrio[skill]]) {
    // Select a die to reroll. First try finding dice lower than the skill value.
    for (var i in dice) {
      if (dice[i] < char[skill]) {
        char.Flux--;
        dice[i] = Math.floor(Math.random()*6+1);
        // If own dice is re-rolled, check for flow.
        if (i < 3)
          checkFlowRoll(dice, char, stats);
        if (countEquals(dice, false, char[skill]) >= 3) {
          return;
        }
        else {
          payToLevelUpTraining(dice, char, skill, stats);
          return;
        }
      }
    }
    // If no lower-than-skill die is found, look for singlet dice.
    // Never re-rolling dice from pairs is sub-optimal, but good enough.
    for (var i in dice) {
      if (dice[i] >= char[skill] && countOccurances(dice, dice[i]) == 1) {
        char.Flux--;
        dice[i] = Math.floor(Math.random()*6+1);
        // If own dice is re-rolled, check for flow.
        if (i < 3)
          checkFlowRoll(dice, char, stats);
        if (countEquals(dice, false, char[skill]) >= 3) {
          return;
        }
        else {
          payToLevelUpTraining(dice, char, skill, stats);
          return;
        }
      }
    }
  }
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

function myFunction() {
  var char = {
    Flux: 13,
    HP: 1,
    MP: 1,
    'HP max': 4,
    'MP max': 4,
    'Smyga': 2,
    'Enhands': 2,
    'Tvåhands': 1,
    'Avstånds': 2,
    'Besvärjelser': 1,
  }
  setSkillPrio(char);
  var dice = [1, 3, 3, 2, 4, 4];
  var stats = {allFlux: 0};
  payToLevelUpTraining(dice, char, 'Enhands', stats);
  debugger
}
