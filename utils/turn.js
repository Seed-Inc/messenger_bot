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

  redo(currentTurn) {

    if (typeof currentTurn !== "string") {
			return Promise.reject(new Error('query not a string'));
		}

    return new Promise(function(resolve, reject) {

      // TODO: better way to do this would be to tag each turn with a
      // master turn and check master turn and pass it through

      switch (currentTurn) {
        case 'STEP:1_GET_STARTED_PAYLOAD':
        case 'STEP:1a_START_REPORT_PAYLOAD':
          resolve('STEP:1a_START_REPORT_PAYLOAD');
          break;

        case 'STEP:2_ASK_POSITIVE_NEGATIVE_PAYLOAD':
        case 'STEP:2a_POSITIVE_RESPONSE_PAYLOAD':
        case 'STEP:2b_NEGATIVE_RESPONSE_PAYLOAD':
          resolve('STEP:1a_START_REPORT_PAYLOAD');
          break;

        case 'STEP:3_ASK_LOCATION_PAYLOAD':
        case 'STEP:3a_ASK_LOCATION_AGAIN_PAYLOAD':
          resolve('STEP:2_ASK_POSITIVE_NEGATIVE_PAYLOAD');
          break;

        case 'STEP:4_IDENTIFYING_A_POLICE_OFFICER_PAYLOAD':
        case 'STEP:4a_IDENTIFYING_A_POLICE_OFFICER_BY_BADGE_PAYLOAD':
        case 'STEP:4b1_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_ETHNICITY_PAYLOAD':
          resolve('STEP:3_ASK_LOCATION_PAYLOAD');
          break;

        case 'STEP:4b2_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_AGE_PAYLOAD':
          resolve('STEP:4b1_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_ETHNICITY_PAYLOAD');
          break;

        case 'STEP:4b3_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_SEX_PAYLOAD':
          resolve('STEP:4b2_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_AGE_PAYLOAD');
          break;

        case 'STEP:4b4_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_PERSONAL_CHARACTERISTICS_PAYLOAD':
          resolve('STEP:4b3_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_SEX_PAYLOAD');
          break;

        case 'STEP:4X_IDENTIFYING_A_POLICE_OFFICER_DONE_PAYLOAD':
        case 'STEP:5_ASK_DATE_PAYLOAD':
          resolve('STEP:4b4_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_PERSONAL_CHARACTERISTICS_PAYLOAD');
          break;

        case 'STEP:5a_ASK_TO_USER_TO_INPUT_DATE_PAYLOAD':
          resolve('STEP:5_ASK_DATE_PAYLOAD');
          break;

        case 'STEP:6_ASK_TIME_PAYLOAD':
          resolve('STEP:5a_ASK_TO_USER_TO_INPUT_DATE_PAYLOAD');
          break;

        default:
          reject(new Error('no turn to go back too'))
      }


    });

  },

  goTo() {

  }

};
