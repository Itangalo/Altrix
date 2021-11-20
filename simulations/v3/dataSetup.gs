/**
 * Data used before running the first game simulation.
 */

function setUpData() {
  /**
   * Part 1: Simulation-specific data
   */
  let characterDataRange = 'J1:P21'; let charactersSheet = 'characters';
  global.mode = 'long';
  global.logSettings = {
    iteration: true,
    days: false,
    levelUp: true,
    reRollToLevelUp: false,
    commandSpell: false,
    atLocation: true,
    considerTraining: false,
    store: true,
    cardResult: false,
    payForHealing: false,
    selectDestination: true,
    implementationMissing: false,
    error: true,
  };

  /**
   * Part 2: Simulation-independent data
   */
  global.fallbackIterations = 2;
  global.dieSides = 6;
  global.safeDieCost = 6; // The number of fluxcrystals paid to select outcome of die instead of re-roll.
  global.locations = {
    list: ['Home', 'University', 'Soldier', 'Swordmaster', 'Dwarrow', 'Lorien', 'Tower1', 'Tower2', 'Tower3'],
    trainingList: ['University', 'Soldier', 'Swordmaster'],
    lightList: ['Dwarrow', 'Lorien', 'Tower1', 'Tower2', 'Tower3'],
    darkList: ['Dwarrow', 'Lorien', 'Tower1', 'Tower2', 'Tower3'],
    towers: {short: 'Tower1', medium: 'Tower2', long: 'Tower3'},
    questList: ['Home', 'University', 'Soldier', 'Swordmaster'],
    Home: {healing: {HP: 1, MP: 1}},
    University: {healing: {HP: 0, MP: 2}, training: ['spells']},
    Soldier: {healing: {HP: 2, MP: 0}, training: ['twoHanded', 'ranged']},
    Swordmaster: {healing: {HP: 1, MP: 1}, training: ['oneHanded']},
    Dwarrow: {healing: {HP: 2, MP: 1}},
    Lorien: {healing: {HP: 1, MP: 2}},
  }
  global.skills = ['sneak', 'oneHanded', 'twoHanded', 'ranged', 'spells'];
  global.characterCounters = ['fluxGain', 'fluxLoss', 'CS', 'levelUps', 'HPloss', 'HPgain', 'MPloss', 'MPgain', 'MPspillover'];

  // Places to read data from in the spreadsheet.
  let pathsDataRange = 'A1:AP20'; let pathsSheet = 'paths';
  let spacesRange = 'A2:B62'; let spacesSheet = 'spaces';
  let cardsDataRange = 'A2:T169'; let cardsSheet = 'cards';
  let cardsColumns = {
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
    HP: 17,
    MP: 18,
    params: 19,
    resolver: 20,
  };
  let itemsDataRange = 'A2:I60'; let itemsSheet = 'items';
  let itemsColumns = {
    title: 1,
    type: 2,
    price: 3,
    oneHanded: 4,
    twoHanded: 5,
    HP: 6,
    MP: 7,
    flux: 8,
    params: 9,
  };

  // Some constants used for comparing in-game alternatives.
  global.skillPrio = {
    necessary: 4,
    important: 3,
    good: 2,
    useful: 1,
    dontBother: 0
  };
  global.vulnerability = {
    safe: 0,
    ok: 1,
    wounded: 2,
    weak: 3,
    veryWeak: 4,
    critical: 5,
    passedOut: 6,
  };


  /**
   * Part 3: Build global game data.
   */
  // Build quests and add to the game state.
  // @TODO: Consider using the deck class for the quests.
  initialGameState.quests = {available: [], rewards: {}};
  for (let i of global.locations.questList) {
    for (let j of global.locations.questList) {
      if (i != j) {
        initialGameState.quests.available.push(i + '-' + j);
        initialGameState.quests.rewards[i + '-' + j] = 3;
      }
    }
  }
  initialGameState.quests.rewards['Soldier-Swordmaster'] = 4;
  initialGameState.quests.rewards['Swordmaster-Soldier'] = 4;

  // Build paths between special places.
  global.paths = {};
  var allPaths = transpose(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(pathsSheet).getRange(pathsDataRange).getValues());
  for (var i in allPaths) {
    var label = allPaths[i].shift();
    global.paths[label] = allPaths[i].filter(n => n)
  }

  // Get character initial data from the spreadsheet and populate the characters object.
  let characterData = transpose(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(charactersSheet).getRange(characterDataRange).getValues());
  initialGameState.characters = {};
  initialGameState.numberOfCharacters = 0;
  for (let i in characterData) {
    let data = buildObject(characterData[i], ":");
    if (data.group) {
      initialGameState.characters[data.name] = data;
      initialGameState.numberOfCharacters++;
    }
  }

  // Get data about regions for each space on the board.
  global.spaces = buildObject(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(spacesSheet).getRange(spacesRange).getValues());

  // Build adventure card data, sort into decks.
  let cardData = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cardsSheet).getRange(cardsDataRange).getValues();
  initialGameState.decks = {};
  for (let c of cardData) {
    let deck = c[cardsColumns.deck-1];
    if (initialGameState.decks[deck] == undefined) {
      initialGameState.decks[deck] = [];
    }
    let card = {};
    for (let i in cardsColumns) {
      card[i] = c[cardsColumns[i]-1];
    }
    initialGameState.decks[deck].push(card);
  }

  // Build the items deck.
  let itemsData = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(itemsSheet).getRange(itemsDataRange).getValues();
  initialGameState.decks.items = [];
  for (let i in itemsData) {
    let itemData = itemsData[i];
    let item = {};
    for (let p in itemsColumns) {
      item[p] = itemData[itemsColumns[p] - 1];

    }
    initialGameState.decks.items.push(item);
  }

  /**
   * Part 4: Set up strategy parameters.
   */
}
