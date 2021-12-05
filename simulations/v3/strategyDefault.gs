strategies.default = {
  /**
   * Set the vulnerability for a character, for HP, MP and total. Scale described by global.vulnerability.
   */ 
  setVulnerableValues: function(character) {
    // 3 HP and 2 MP is deemed enough.
    let HP = Math.min(3, character.HP);
    let MP = Math.min(2, character.MP);
    let v = global.vulnerability;
    let vulnerableMatrix = [
      [v.passedOut, v.critical, v.veryWeak, v.wounded],
      [v.passedOut, v.veryWeak, v.weak,     v.ok],
      [v.passedOut, v.veryWeak, v.wounded,  v.safe],
    ];
    let vulnerableHP = [v.passedOut, v.critical, v.weak, v.safe][HP];
    let vulnerableMP = [v.critical, v.weak, v.safe][MP];

    character.vulnerable = {
      HP: vulnerableHP,
      MP: vulnerableMP,
      value: vulnerableMatrix[MP][HP],
    };
  },

  /**
   * Used to determine whether to pay to heal or not. If difference between two
   * states is at least 1, character will pay to heal. If more than one healing
   * option is available, the greatest difference will be used.
   */
  healthPotential: function(HP, MP) {
    HP = Math.min(HP, 5);
    MP = Math.min(MP, 5);
    healthMatrix = [
      [-10, -5.0, -3.9, -3.2, -2.7, -2.3],
      [-10, -4.0, -2.9, -2.2, -1.7, -1.3],
      [-10, -3.0, -1.9, -1.2, -0.8, -0.4],
      [-10, -2.9, -1.6, -0.9, -0.5, -0.3],
      [-10, -2.8, -1.5, -0.8, -0.4, -0.2],
      [-10, -2.7, -1.4, -0.7, -0.3, -0.1],
    ];
    return healthMatrix[MP][HP];
  },

  /**
   * Sets a level up prio for a character. Scale described by global.skillPrio.
   */
  setSkillPrio: function(character) {
    // High prio on leveling up one fighting skill, no prio on the other.
    // Slight preference for two handed weapons.
    // Leveling up to get glory points is always useful. Otherwise, see baseline below.

    // Set baseline prio.
    let skillPrio = {
      sneak: global.skillPrio.dontBother,
      oneHanded: global.skillPrio.important,
      twoHanded: global.skillPrio.important,
      ranged: global.skillPrio.good,
      spells: global.skillPrio.useful,
    };

    // If no fighting skill has reached level 4, leveling up is necessary/very important.
    if (character.oneHanded < 4 && character.twoHanded < 4) {
      skillPrio.oneHanded = global.skillPrio.necessary;
      skillPrio.twoHanded = global.skillPrio.necessary;
    }
    // Prefer two handed weapons if equal, ditch the less important melee skill.
    if (character.twoHanded >= character.oneHanded)
      skillPrio.oneHanded = 0;
    if (character.twoHanded < character.oneHanded)
      skillPrio.twoHanded = 0;

    // Some final adjustments to skill prios.
    for (let i in skillPrio) {
      // If level up gives more glory points, level up is at least useful.
      if (character[i] > 2 && character[i] < 6)
        skillPrio[i] = Math.max(skillPrio[i], global.skillPrio.useful);
      // If maxed out, no need to level up more.
      if (character[i] > 5)
        skillPrio[i] = global.skillPrio.dontBother;
    }

    skillPrio.max = 0;
    for (let i in skillPrio) {
      skillPrio.max = Math.max(skillPrio.max, skillPrio[i]);
    }
    character.skillPrio = skillPrio;
  },

  /**
   * Considers whether to select a die in movement roll in order to level up a skill.
   */
  payToLevelUpMovement: function(character, dice) {
    // Necessary level up: pay if possible.
    // Important level up: pay if one flux crystal will be left over.
    // Otherwise don't pay.

    // Check for two trivial cases.
    if (character.flux < global.safeDieCost || dice.countEquals(true) != 2)
      return false;

    // Shuffle to avoid bias.
    let skills = shuffle(global.skills);
  
    // Set thresholds for how many flux crystals the character should have left in order
    // to pay for leveling up, depending on prio of skill.
    let threshold = {};
    threshold[global.skillPrio.necessary] = global.safeDieCost;
    threshold[global.skillPrio.important] = global.safeDieCost + 1;

    // Check skills in decending order of priority.
    for (let p = global.skillPrio.necessary; p >= global.skillPrio.important; p--) {
      for (let s of skills) {
        // Note that dice.ownDice[1] will always show the value of the pair.
        // First condition is to make sure that only skills of given priority is checked against.
        if (character.skillPrio[s] == p && dice.ownDice[1] > character[s] && character.flux >= threshold[character.skillPrio[s]]) {
          dice.ownDice[0] = dice.ownDice[1];
          dice.ownDice[2] = dice.ownDice[1];
          character.changeFlux(-1 * global.safeDieCost);
          log(character.name + ' paid to level up ' + s + ' in a movement roll. Flux is at ' + character.flux, 'reRollToLevelUp');
          return true;
        }
      }
    }
    return false;
  },

  /**
   * Considers whether to pay for training, and if so how much. Pays for
   * training (if deemed useful) and rolls dice, including any re-rolls.
   * Handles the actual leveling up by calling character.levelUp().
   */
  payForTraining: function(character, skill) {
    // Attempts to level up the skill if this is good or above.
    // Pays at a level that gives lowest expected cost per level up.
    // Does not attempt to level up to level 5 or 6 by training.
    if (character[skill] > 3)
      return 'Skill too high for training.';
    if (character.skillPrio[skill] < global.skillPrio.good)
      return skill + ' not important enough for training.';
    let cost = [3, 3, 4, 4][character[skill]];
    if (character.flux < cost) 
      return 'Cannot afford effective training.';

    character.changeFlux(-1*cost);
    let dice = new diceRoll(character, 3*cost);
    strategies[character.strategy].considerRerollTraining(character, skill, dice);
    return character.levelUp(dice, skill);
  },

  /**
   * Considers whether to reroll any dice in a training roll.
   * Note that dice may already contain a valid triplet.
   */
  considerRerollTraining: function(character, skill, dice) {
    // Rerolls if there are two high pairs in the dice. (Which is probably optimal.)

    // Check if there are flux no crystals or there already is a valid triplet.
    if (character.flux < 1 || dice.countEquals(false, character[skill]) >= 3)
      return;

    // Check if we have at least 2 pairs.
    let pairs = 0;
    for (let i = 6; i > character[skill]; i--) {
      if (dice.countOccurances(i) == 2)
        pairs++;
    }
    if (pairs < 2)
      return;
    
    // First try to re-roll own dice, since they can give flux crystals.
    // Select dice not higher than skill value, if any exist.
    let foundReroll = false;
    if (dice.ownDice[0] <= character[skill]) {
      character.changeFlux(-1);
      dice.ownDice[0] = dice.rollSingle();
      dice.ownDice.sort(function(a, b) {return a - b;});
      dice.checkFlow(character);
      foundReroll = true;
    }
    else if (dice.otherDice[0] <= character[skill]) {
      character.changeFlux(-1);
      dice.otherDice[0] = dice.rollSingle();
      dice.otherDice.sort(function(a, b) {return a - b;});
      foundReroll = true;
    }
    else {
      // If no dice lower than or equal to skill value is found, go for singlets.
      for (let i in dice.ownDice) {
        if (dice.countOccurances(dice.ownDice[i]) == 1) {
          character.changeFlux(-1);
          dice.ownDice[i] = dice.rollSingle();
          dice.ownDice.sort(function(a, b) {return a - b;});
          dice.checkFlow(character);
          foundReroll = true;
        }
      }
      if (!foundReroll) {
        for (let i in dice.otherDice) {
          if (dice.countOccurances(dice.otherDice[i]) == 1) {
            character.changeFlux(-1);
            dice.otherDice[i] = dice.rollSingle();
            dice.ownDice.sort(function(a, b) {return a - b;});
            foundReroll = true;
          }
        }
      }
    }
    // If a re-roll was made, call again to see if another re-roll should be made.
    if (foundReroll) {
      log('Paying to re-roll.', 'reRollToLevelUp');
      strategies[character.strategy].considerRerollTraining(character, skill, dice);
    }
    
  },

  /**
   * Selects and returns a destination for the character.
   * Building the path is managed by the calling character object
   * (as is picking any quest).
   */
  setDestination: function(character, gameState) {
    // Only skills up to level 3 are leveled up by training in this strategy.
    // Destination is set to
    // (1) go to the dark side if fight value is high enough or someone else is going there, otherwise
    // (2) get a weapon from Home if there is good reason for it, otherwise
    // (3) level up an important skill if it matches with a quest, otherwise
    // (4) pick a destination with a quest, otherwise
    // (5) level up an important skill even if it does not match with a quest, otherwise
    // (6) just go somewhere on the light side of Altrix.

    /**
     * Step 0: Check if character should copy destination from someone else in the same group.
     */
    // Check if anyone in the same group is on the same space, with a path set.
    for (let i in gameState.characters) {
      let c = gameState.characters[i];
      if (c.name != character.name && c.group == character.group && c.space == character.space && c.path.length > 0) {
        for (let s of c.path) {
          if (global.locations.list.includes(s))
            return s;
        }
      }
    }


    /**
     * Step 1: Check if it is time to go to the dark side.
     */
    // First check if the character already is on the dark side.
    if (['Dwarrow', 'Lorien'].includes(character.space)) {
      return global.locations.towers[global.mode];
    }
    let goDark = false;
    for (let i in gameState.characters) {
      let c = gameState.characters[i];
      if (i != character.name && c.path && global.locations.darkList.includes(c.path[c.path.length - 1])) {
        goDark = true;
      }
    }
    // Character is deemed ready for the dark side if fight value is 6, or 5 + a ranged weapon wih skill 2 or higher.
    if (character.fightValues.max >= 6)
      goDark = true;
    else if (character.fightValues.max >= 5 && character.fightValues.ranged && character['ranged'] >= 2)
      goDark = true;
    if (goDark) {
      character.goDarkDay = gameState.days;
      if (global.mode == 'short')
        return 'Tower1';
      // Prefer going through the Mountains, unless the Deep Forest is closer.
      if (character.space == 'Swordmaster')
        return 'Lorien';
      else
        return 'Dwarrow';
    };

    let locationPrio = {
      Home: 0,
      University: 0,
      Soldier: 0,
      Swordmaster: 0,
    };

    // Finding a weapon matching prioritized fighting skill is most important.
    let selectedSkill = character.fightValues.skill;
    if (!character.fightValues[selectedSkill + 'Weapon'] < 3)
      locationPrio.Home += 8;

    // Second place is finding a matching quest.
    for (let l in locationPrio) {
      if (gameState.quests.available.includes(character.space + '-'  + l))
        locationPrio[l] += 4;
    }

    // Third place is a location useful for leveling up.
    let skillsToConsider = [];
    for (let s of global.skills) {
      if (character.skillPrio[s] > global.skillPrio.useful && character[s] < 4) {
        skillsToConsider.push({skill: s, prio: character.skillPrio[s]});
      }
    }
    for (let s of skillsToConsider) {
      for (let l of global.locations.trainingList) {
        if (global.locations[l].training.includes(s.skill)) {
          locationPrio[l] += s.prio;
        }
      }
    }
    // Going to the current place isn't an option.
    if (locationPrio[character.space])
      delete locationPrio[character.space];

    // Find highest prio location and return it.
    let max = 0;
    let candidates = [];
    for (let l in locationPrio) {
      max = Math.max(max, locationPrio[l]);
    }
    for (let l in locationPrio) {
      if (locationPrio[l] == max)
        candidates.push(l);
    }
    shuffle(candidates);
    return candidates[0];
  },

  /**
   * Evaluates how important an item is for the character.
   * Returns a value on the scale global.itemPrio.
   */
  evaluateItem: function(character, item) {
    // Only cares for weapons matching the character's chosen skill, plus ranged weapons.
    if (item.type == 'ranged' && !character.fightValues.ranged)
      return global.itemPrio.useful;
    let fSkill = character.fightValues.skill;
    if (item[fSkill]) {
      let nowBonus = character.fightValues[fSkill] - character[fSkill];
      // If character already has at least this bonus, don't bother.
      if (item[fSkill] <= nowBonus)
        return global.itemPrio.dontBother;
      // If weapon is above character's level...
      if (item[fSkill] > character[fSkill]){
        // ...don't bother if character already is overequipped...
        if (character.fightValues[fSkill + 'OverEquipped'])
          return global.itemPrio.dontBother;
        // ...otherwise item is useful.
        return global.itemPrio.useful;
      }
      // If item is at or just under character's skill level (or max 4), weapon is important.
      if (Math.min(character[fSkill], 4) - item[fSkill] <= 1)
        return global.itemPrio.important;
      // Otherwise useful.
      return global.itemPrio.useful;
    }

    // Nothing else is useful according to this strategy.
    return global.itemPrio.dontBother;
  },
};
