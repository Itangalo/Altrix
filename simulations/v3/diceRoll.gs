class diceRoll {
  // Rolls n dice for a character, with a minimum of 3 dice.
  // Also adds a flux crystal to the character if dice give flow.
  constructor(character, n = 3) {
    // The three first dice are the playes' own and may be consiedered separately.
    this.ownDice = [];
    for (let i = 0; i < 3; i++) {
      this.ownDice.push(this.rollSingle());
    }
    this.ownDice.sort(function(a, b) {return a - b;});
    this.checkFlow(character);

    this.otherDice = [];
    for (let i = 3; i < n; i++) {
      this.otherDice.push(Math.floor(Math.random()*global.dieSides+1));
    }
    this.otherDice.sort(function(a, b) {return a - b;});
  }

  // Rolls a single die. Typically used for re-rolls.
  // Caller function is responsible for sorting the resulting dice.
  rollSingle() {
    return Math.floor(Math.random()*global.dieSides+1)
  }

  // Checks for flow (straight) in the player's own dice.
  checkFlow(character) {
    if (this.ownDice[0] + 1 == this.ownDice[1] &&
        this.ownDice[1] + 1 == this.ownDice[2])
      character.changeFlux(1);
      return true;
    return false;
  }

  // Returns the number of equal dice with value above 'threshold'.
  // Only looks at player's own dice if 'onlyOwn' is set to true.
  countEquals(onlyOwn = false, threshold = 0) {
    let dice;
    if (onlyOwn)
      dice = this.ownDice;
    else
      dice = [...this.ownDice, ...this.otherDice];

    let counts = Array(global.dieSides);
    counts.fill(0);
    for (let i = 0; i < dice.length; i++) {
      if (dice[i] > threshold) {
        counts[dice[i]-1]++;
      }
    }
    return Math.max(...counts);
  }

  // Returns the number of times 'value' occurs in all dice.
  countOccurances(value) {
    let occurances = 0;
    for (let d of [...this.ownDice, ...this.otherDice]) {
      if (d == value)
        occurances++;
    }
    return occurances;
  }

  // Return 2 if result matches exactly, 1 if above, negative difference if below.
  skillcheck(value, modifier = 0) {
    let sum = this.ownDice.reduce((a, b) => a + b) + modifier;
    if (sum == value)
      return 2;
    if (sum > value)
      return 1;
    return value - sum;
  }
}
