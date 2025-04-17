module.exports = {
  // Function to convert a number to its ordinal form (1st, 2nd, 3rd, etc.)
  ordinalize: function(number) {
    const j = number % 10;
    const k = number % 100;
    
    if (j === 1 && k !== 11) {
      return number + "st";
    }
    if (j === 2 && k !== 12) {
      return number + "nd";
    }
    if (j === 3 && k !== 13) {
      return number + "rd";
    }
    
    return number + "th";
  }
};
