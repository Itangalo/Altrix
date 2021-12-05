class deck {
  // Creates a deck from an array of objects with card data.
  constructor(cardDataArray, deckId) {
    this.id = deckId;
    // Add the cards and set deck id on each card.
    this.cards = cardDataArray;
    for (let c of this.cards) {
      c.deck = this;
      c.deckId = deckId;
      if (c.params == '')
        c.params = [];
      else if (typeof(c.params) == 'string')
        c.params = c.params.split(', ');
      else
        c.params = [c.params];
    }
    this.shuffle();
  }

  // Shuffles the deck.
  shuffle() {
    shuffle(this.cards);
    this.queuedForShuffling = false;
    return this;
  }

  // Queues the deck for shuffling at a later time.
  queueShuffling() {
    this.queuedForShuffling = true;
    return this;
  }

  // Shuffles if deck is queued for shuffling.
  considerShuffling() {
    if (this.queuedForShuffling)
      this.shuffle();
      return this;
  }

  // Draws the top card.
  draw() {
    let card = this.cards.shift();
    // Take care of special cases that should lead to new cards.
    if (this.id == 'items' && card.type == 'special') {
      this.queueShuffling();
      this.addToDeck(card);
      return this.draw();
    }
    return card;
  }

  // Returns the first found card with the given name, or false if none is found.
  pick(title) {
    for (var i in this.cards) {
      if (this.cards[i].title == title) {
        let c = this.cards[i];
        this.cards.splice(i, 1);
        return c;
      }
    }
    return false;
  }

  // Draws the top card and then places it at the bottom of the deck.
  drawAndReturn() {
    var card = this.cards.shift();
    this.cards.push(card);
    return card;
  }

  // Adds a card to the bottom of the deck.
  addToDeck(card) {
    if (card.deckId != this.id) {
      throw('Deck ' + this.id + ' cannot accept card from ' + card.deckId + '. Card data: ' + JSON.stringify(card));
    }
    this.cards.push(card);
    return this;
  }
}
