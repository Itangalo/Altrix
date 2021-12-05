class character {
  // Creates a character from an object with basic character data.
  constructor(characterData, gameState) {
    // Set basic data (from sheet)
    for (let i in characterData) {
      this[i] = characterData[i];
    }
    // Set some properties used for keeping track of statistics.
    for (let p of global.characterCounters) {
      this[p] = 0;
    }

    // Build the character's path, based on listed places and paths between them.
    let destinations = this.places.split(', ');
    this.path = [destinations[0]];
    for (let j = 1; j < destinations.length; j++) {
      let label = destinations[j-1] + '-' + destinations[j];
      this.path.push(...global.paths[label]);
      this.path.push(destinations[j]);
    }
    this.space = this.path.shift();

    // Add any items to the characters.
    if (this.items) {
      let itemList = this.items.split(', ');
      this.items = [];
      for (let i of itemList) {
        let item = gameState.decks.items.pick(i);
        if (!item)
          throw('Could not pick item ' + i + ' when setting up character ' + this.name);
        this.items.push(item);
      }
    }
    else {
      this.items = [];
    }

    this.setSkillPrio();
    this.setVulnerableValues();
    this.setDestination(gameState);
  }

  // Gets the next space this character's path.
  getNextSpace() {
    return this.path[0];
  }

  // Moves the character n spaces on its path. Always stops at special locations.
  move(n) {
    if (this.getNextSpace() == global.locations.towers[global.mode])
      return;
    this.space = this.path.shift();
    for (let i = 1; i < n; i++) {
      if (!global.locations.list.includes(this.space)) {
        this.space = this.path.shift();
      }
    }
  }

  // Gives flux crystals to another character. Logs transaction (but not as loss).
  giveFluxTo(n, character) {
    if (character.name == this.name)
      return;
    if (n > this.flux)
      throw('Cannot give ' + n + ' flux crystals. Not enogh.');
    this.flux -= n;
    this.fluxGiven += n;
    character.flux += n;
    character.fluxReceived += n;
  }

  // Adds/removes n flux crystals from the character. Also logs to stats.
  changeFlux(n) {
    if (n < 0)
      this.fluxLoss -= n;
    if (n > 0)
      this.fluxGain += n;
    this.flux = Math.max(this.flux + n, 0);
  }

  // Increases/decreases HP n steps, within reasonable bounds.
  changeHP(n) {
    if (n == 0)
      return;
    if (n < 0) {
      let loss = Math.min(Math.abs(n), this.HP);
      this.HP -= loss;
      this.HPloss += loss;
    }
    if (n > 0) {
      let gain = Math.min(n, this.HPmax - this.HP);
      this.HP += gain;
      this.HPgain += gain;
    }
    this.setVulnerableValues();
    if (this.HP == 0)
      this.passOuts++;
  }

  // Increases/decreases MP n steps, within reasonable bounds.
  // Decrease below 0 spills over on HP.
  changeMP(n) {
    if (n == 0)
      return;
    if (n < 0) {
      let loss = Math.min(Math.abs(n), this.MP);
      this.MP -= loss;
      this.MPloss += loss;
      if (n + loss < 0) {
        this.changeHP(n + loss);
        this.MPspillover -= n + loss;
        return;
      }
    }
    if (n > 0) {
      let gain = Math.min(n, this.MPmax - this.MP);
      this.MP += gain;
      this.MPgain += gain;
    }
    this.setVulnerableValues();
  }

  // Adds an item to the character and updates fight values.
  receiveItem(item) {
    this.items.push(item);
    this.setFightValues();
  }

  // Gives a character a quest from here to there, if available.
  takeQuest(label, gameState) {
    if (this.quest) // Character already has a quest.
      return;
    if (gameState.quests.available.includes(label)) {
      this.quest = label;
      gameState.quests.available.splice(gameState.quests.available.indexOf(label), 1);
    }
  }
  
  // Levels up the named skill, if dice allows it. If no skill is set,
  // the most relevant skill possible will be leveled (could be none).
  // Returns a log message if level up succeeded, otherwise false.
  // Also updates the character's skill prio.
  levelUp(dice, skills = false) {
    // Randomize order to check skills to avoid bias.
    if (!skills) {
      skills = shuffle(global.skills);
    }
    else {
      skills = [skills];
    }
    for (let p = this.skillPrio.max; p >= 0; p--) {
      for (let s of skills) {
        if (this.skillPrio[s] >= p && dice.countEquals(false, this[s]) >= 3) {
          this[s]++;
          this.levelUps++;
          this.setSkillPrio();
          return this.name + ' levels up ' + s + ': ' + this[s];
        }
      }
    }
    return false;
  }

  // Sets a number of values useful in combat.
  setFightValues() {
    let values = {
      oneHandedWeapon: 0,
      twoHandedWeapon: 0,
      oneHanded: this.oneHanded,
      twoHanded: this.twoHanded,
      ranged: 0,      
    };
    // Set max fight value for close combat skills.
    // Also note if character has weapon(s) useful for higher skill level only.
    for (let i of this.items) {
      for (let s of ['oneHanded', 'twoHanded']) {
        values[s + 'Weapon'] = Math.max(values[s + 'Weapon'], i[s]);
        if (i[s] > this[s]) {
          values[s + 'OverEquipped'] = true;
          values[s] = Math.max(values[s], this[s] + 1);
        }
        else {
          values[s] = Math.max(values[s], this[s] + i[s]);
        }
      }
      if (i.type == 'ranged') {
        values.ranged = Math.max(values.ranged, i.price);
      }
    }
    if (values['twoHanded'] >= values['oneHanded']) {
      values.max = values['twoHanded'];
      values.skill = 'twoHanded';
    }
    else {
      values.max = values['oneHanded'];
      values.skill = 'oneHanded';
    }
    this.fightValues = values;
  }

  // Sets a value for how vulnerable a character is. Varies with the character's strategy.
  setVulnerableValues() {
    strategies[this.strategy].setVulnerableValues(this);
  }

  // Sets prio values leveling up skills. Varies with the character's strategy.
  // Also updates fight values, since this function is mainly called when skills change.
  setSkillPrio() {
    strategies[this.strategy].setSkillPrio(this);
    this.setFightValues();
  }

  // Considers whether to select a die in movement roll in order to level up a skill.
  // Varies with the character's strategy.
  payToLevelUpMovement(dice) {
    return strategies[this.strategy].payToLevelUpMovement(this, dice);
  }

  // Considers whether to pay to heal. 'heal' should be on the form {HP: 1, MP: 1}, specifying
  // how much is healed for each flux crystal. If omitted, ratio 1:1 is used, testing
  // both 1/0 and 0/1 to see which is best.
  // Implementation varies with the character's strategy.
  payToHeal(heal = false) {
    if (this.flux < 1)
      return false;

    // Case 1: Specified healing. Check if healing is worth paying for.
    if (heal != false) {
      if (this.evaluateHealGain(heal) < 0.999) // Silly number to duck rounding error...
        return false;
      this.changeFlux(-1);
      this.changeHP(heal.HP);
      this.changeMP(heal.MP);
      this.heals++;
      this.payToHeal(heal); // Call again, to see if it is worth healing again.
      return true;
    }

    // Case 2: Heal HP _or_ MP at ratio 1:1. Check if healing is worth paying for,
    // and if so for which stat.
    let gainHP = this.evaluateHealGain({HP: 1, MP: 0});
    let gainMP = this.evaluateHealGain({HP: 0, MP: 1});

    if (gainHP < 0.999 && gainMP < 0.999) // Neither is worth paying for.
      return false;
    // If one is worth paying for, pay and heal most prioritized. (Slight preference for HP.)
    this.changeFlux(-1);
    this.heals++;
    if (gainHP >= gainMP) {
      this.changeHP(1);
    }
    else {
      this.changeMP(1);
    }
    this.payToHeal();
    return true;
  }

  // Compares health values before and after healing with 'heal'.
  // 'heal' should be on the form {HP: 1, MP: 0}.
  // Varies with the character's strategy.
  evaluateHealGain(heal) {
    let now = strategies[this.strategy].healthPotential(this.HP, this.MP);
    let thenHP = Math.min(this.HP + heal.HP, this.HPmax);
    let thenMP = Math.min(this.MP + heal.MP, this.MPmax);
    let then = strategies[this.strategy].healthPotential(thenHP, thenMP);
    return then - now;
  }

  // Gives an estimate of how important an item is for the character.
  // Used when buying and maybe trading. Varies with the character's strategy.
  evaluateItem(item) {
    return strategies[this.strategy].evaluateItem(this, item);
  }

  // Considers paying to train a skill, including paying to re-roll.
  // Varies with the character's strategy.
  payForTraining(skill) {
    if (this.skillPrio[skill] > global.skillPrio.dontBother)
      return strategies[this.strategy].payForTraining(this, skill);
  }

  // Sets a new destination for the character, if there is none in her path.
  // Also takes a quest, if a matching one exists.
  // Varies with the character's strategy.
  setDestination(gameState) {
    // Check if character is at the end.
    if (this.space == global.locations.towers[global.mode])
      return;
    // Check if there is a special location in the path already.
    for (let i of this.path) {
      if (global.locations.list.includes(i))
        return;
    }
    let there = strategies[this.strategy].setDestination(this, gameState);
    let label = this.space + '-' + there;
    if (!global.paths[label])
      throw('Path not found: ' + label);
    this.path = this.path.concat(global.paths[label]);
    this.path.push(there);
    this.takeQuest(label, gameState);
    return there;
  }

}
