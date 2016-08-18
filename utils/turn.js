'use strict'

const allTurns = require('../content').CONVERSATION_TURNS_LIST;
let currentTurn = allTurns[0].name;


/*
 * Collection of methods related to identifying where the user 'is' in the
 * flow of conversation with the bot
 */
module.exports = {

  set(turn) {
    currentTurn = turn;
    console.log("THE CURRENT TURN IS: " + currentTurn)
  },

  get() {
    console.log("THE CURRENT TURN IS: " + currentTurn)
    return currentTurn;
  },

  goTo() {

  }

};
