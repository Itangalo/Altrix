/**
 * Copies default strategy, but has goes towards the Tower when someone is Hero.
 */
strategies.hero = Object.assign({}, strategies.default);

  /**
   * Selects and returns a destination for the character.
   * Building the path is managed by the calling character object
   * (as is picking any quest).
   */
strategies.hero.setDestination = function(character, gameState) {
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
  if (isHero(character)) {
    goDark = true;
    character.goDarkDay = gameState.days;
  }
  if (goDark) {
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
};
