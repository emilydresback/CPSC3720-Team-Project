/**
 * numberWords.js
 * Convert simple number words ("one", "two", ...) to integers
 */
const MAP = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10
  };
  
  export function wordToNumber(token) {
    const t = (token || '').toLowerCase();
    return MAP[t] || null;
  }
  