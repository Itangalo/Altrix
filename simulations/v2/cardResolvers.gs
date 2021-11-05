function crValuableFinding(card, chars, stats) {
  sortBy(chars, 'vulnerableValue');
  var char = chars[0];
  if (card.title == 'Värdefullt fynd') {
    var dice = roll();
    checkFlowRoll(dice, char, stats);
    var target1 = 7;
    var target2 = 12;
    if (card.deck == 'Fälten') {
      target1 = 10;
      target2 = 13;
    }
    if (card.deck == 'Staden') {
      target1 = 3;
      target2 = 7;
    }
    if (skillCheck(dice, target1)) {
      char.Flux++;
      stats.allFlux++
    }
    if (skillCheck(dice, target2)) {
      char.Flux++;
      stats.allFlux++
    }
  }
}

function crFight(card, chars, stats) {
  for (var i of chars) {
    i.fightValue = Math.max(i.Enhands, i['Tvåhands']) + i.HP * .1
  }
  sortBy(chars, 'fightValue');
  var success = false;
  var ranged = 0;
  for (var c of chars) {
    if (c['Har avståndsvapen']) {
      var dice = roll();
      checkFlowRoll(dice, c, stats);
      var result = skillCheck(dice, 13, c['Avstånds']);
      if (result)
        ranged++;
    }
  }
  for (var c of chars) {
    if (!success) {
      var dice = roll();
      checkFlowRoll(dice, c, stats);
      // Assume weapon one step below skill level, and at least 1.
      var weapon = Math.max(c.Enhands - 1, c['Tvåhands'] - 1, 1);
      var result = skillCheck(dice, card.fight, Math.max(c.Enhands, c['Tvåhands']) + weapon + ranged);
      if (result > 0) {
        success = true;
        Logger.log('Vinst: ' + card.title);
      }
      else {
        c.HP = Math.max(0, c.HP - 1);
        setVulnerableValues(c);
        Logger.log('Förlust: ' + card.title);
      }
      if (result == 2) {
        c.Flux += 3;
        stats.allFlux += 3;
      }
    }
  }
}

function crGhost(card, chars, stats) {
  sortBy(chars, 'MP', false);
  var success = false;
  for (var i in chars) {
    if (!success) {
      var dice = roll();
      checkFlowRoll(dice, chars[i], stats);
      var result = skillCheck(dice, card.success, chars[i].MAG);
      if (result > 0) {
        success = true;
        Logger.log('Vinst: ' + card.title);
      }
      else {
        var loss = 2;
        if (['Lyktgubbe', 'Skuggbest', 'Dråpare'].includes(card.title)) {
          loss = 1;
        }
        chars[i].MP = Math.max(0, chars[i].MP - loss);
        setVulnerableValues(chars[i]);
        Logger.log('Förlust: ' + card.title);
      }
      if (result == 2) {
        chars[i].Flux += 3;
        stats.allFlux += 3;
      }
    }
  }
}

function crCommandSpell(card, chars, stats) {
  sortBy(chars, 'CS');
  chars[0].CS++;
  stats.CS++;
  var fluxLoss = chars.length;
  // Try taking one flux from each character.
  for (c of chars) {
    if (c.Flux > 0) {
      c.Flux--;
      fluxLoss--;
      stats.fluxLoss++;
    }
  }
  // If there are flux left to deduce, do it.
  sortBy(chars, 'Flux', false);
  for (c of chars) {
    while (c.Flux > 0 && fluxLoss > 0) {
      c.Flux--;
      fluxLoss--;
      stats.fluxLoss++;
    }
  }
}
