/**
 * @file: Helper functions dealing with general JavaScript stuff.
 */

// Used for controling which log messages to display.
function log(message, type) {
  if (global.logSettings[type]) {
    Logger.log(message);
  }
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

// Used for sorting lists of objects by a sub property, such as how vulnerable characters are.
function sortBySubProperty(list, property, subProperty, ascending = true) {
  if (ascending) {
    list.sort((a, b) => a[property][subProperty] > b[property][subProperty] ? 1 : -1);
  }
  else {
    list.sort((a, b) => b[property][subProperty] > a[property][subProperty] ? 1 : -1);
  }
}

// Builds and returns an object with properties/values specified in an array of data.
// The array either contains property name and value in sub arrays, or has them combined
// in a string with a given separator. Values will be trimmed and also converted to numbers if possible.
function buildObject(data, separator = false) {
  // If we have a single array with property name and value mixed, split them up and call again.
  if (separator !== false) {
    d = [];
    for (i in data) {
      if (typeof(data[i]) == 'array') {
        data[i] = data[i][0];
      }
      t = data[i].split(separator);
      d.push([t[0], t[1]]);
    }
    return buildObject(d);
  }

  // Build an object and add the values.
  o = {};
  for (i in data) {
    property = data[i][0];
    if (typeof(property) == 'string') {
      property = property.trim();
    }
    value = data[i][1];
    if (typeof(value) == 'string') {
      value = value.trim();
    }
    if (!isNaN(value)) {
      value = parseFloat(value);
    }
    o[property] = value;
  }
  return o;
}

// Transpose an array. From https://stackoverflow.com/questions/17428587/transposing-a-2d-array-in-javascript
function transpose(arr){
  arr = arr[0].map((_, colIndex) => arr.map(row => row[colIndex]));
  return arr;
}

// Helper function, shuffling an array. Code from https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

// Function used to create a one-cell content from a list of places.
function joinPath(places) {
  arr = [];
  for (i in places) {
    if (places[i].toString().trim() != '') {
      arr.push(places[i]);
    }
  }

  return arr.join(", ");
}

// Helper function returning the average of the numbers in an array.
function average(nums) {
    return nums.reduce((a, b) => (a + b)) / nums.length;
}

// Returns the value at a given percentile in a sorted numeric array.
// "Linear interpolation between closest ranks" method
// Code from https://gist.github.com/IceCreamYou/6ffa1b18c4c8f6aeaad2
function percentile(arr, p) {
    if (arr.length === 0) return 0;
    if (typeof p !== 'number') throw new TypeError('p must be a number');
    if (p <= 0) return arr[0];
    if (p >= 1) return arr[arr.length - 1];

    var index = (arr.length - 1) * p,
        lower = Math.floor(index),
        upper = lower + 1,
        weight = index % 1;

    if (upper >= arr.length) return arr[lower];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
}
