'use strict'

const config = require('config')
const express = require('express')
const bodyParser = require('body-parser')
const crypto = require('crypto')
const request = require('request')
const app = express()

const content = require('./content')

const fb = require('./utils/services/fbMessengerSendApi');
const locationUtil = require('./utils/location');
const turnUtil = require('./utils/turn');

app.set('port', (process.env.PORT || 5000))
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json({ verify: verifyRequestSignature }))

// index
app.get('/', function (req, res) {
	res.send('hello world i am a secret bot')
})

/*
 * Be sure to setup your config values before running this code. You can
 * set them using environment variables or modifying the config file in /config.
 *
 */

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and
// assets located at this address.
const SERVER_URL = (process.env.SERVER_URL) ?
  (process.env.SERVER_URL) :
  config.get('serverURL');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN /*&& SERVER_URL*/)) {
  console.error("Missing config values");
  process.exit(1);
}

/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});


/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page.
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 * Not doing account linking for 1.0.0
 */
app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        // } else if (messagingEvent.account_linking) {
          // receivedAccountLink(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});


/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 */

// Save positive or negative experience, hack for now
var perceivedExperiencOfIncident = null;

// Somtimes the user doesn't write all of the things in one message,
// this is a hack to save multiple messages together without backend
var turnUserInputArray = [];


function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

	// If we receive a text message, check what turn we are on to make sure
	// we give the appropriate response
	var turn = turnUtil.get()

	// this is where we start getting back from the fb api user messages
  if (isEcho) {
    // Just logging message echoes to console
    console.log("Received echo for message %s and app %d with metadata %s",
      messageId, appId, metadata);
    return;

	// if the user sent back a quick reply
  } else if (quickReply) {

    var quickReplyPayload = quickReply.payload;

		if(quickReplyPayload) {

			console.log("Quick reply for message %s with payload %s",
			messageId, quickReplyPayload);

			if (quickReplyPayload === "UTILITIES:CONTINUE_PAYLOAD" || quickReplyPayload === "UTILITIES:REDO_PREVIOUS_QUESTION_PAYLOAD") {

				sendTextMessage(senderID, quickReplyPayload);

			} else {

				// officer description quick replies
				switch(turn) {

					// Indentifying Officer Turns
					case 'STEP:4b1_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_ETHNICITY_PAYLOAD':
						turnUtil.set('STEP:4b2_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_AGE_PAYLOAD');
						sendQuickReply(senderID, 'STEP:4b2_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_AGE_PAYLOAD');
						break;

					case 'STEP:4b2_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_AGE_PAYLOAD':
						turnUtil.set('STEP:4b3_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_SEX_PAYLOAD');
						sendQuickReply(senderID, 'STEP:4b3_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_SEX_PAYLOAD');
						break;

					case 'STEP:4b3_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_SEX_PAYLOAD':
						turnUtil.set('STEP:4b4_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_PERSONAL_CHARACTERISTICS_PAYLOAD');
						sendTextMessage(senderID, "STEP:4b4_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_PERSONAL_CHARACTERISTICS_PAYLOAD");
						break;


					default:
						sendRedundancyMessage(senderID, messageText);

				}

			}


		}

    return;
  }

	// if the user wrote a message
  if (messageText) {

    switch (turn) {
			// user inputs a location
      case 'STEP:3_ASK_LOCATION_PAYLOAD':
			case 'STEP:3a_ASK_LOCATION_AGAIN_PAYLOAD':

				// bot receives user input and checks for possible locations
				locationUtil.getPredictions(messageText).then(function(predictions) {

					if (predictions.length != 0) {

						// get generic template payload with location predictions to confirm the city
						locationUtil.createLocationPredictionsPayload(predictions).then(function(payload) {
							// send user a generic template with locations predictions
							sendGenericMessage(senderID, payload);
						})
						.catch(function(err) {
							console.error(err.message);
						});

					} else {
						sendRedundancyMessage(senderID, messageText);
					}

				})
				.catch(function(err) {
					console.error(err.message);
				});

				break;

			case 'STEP:4a_IDENTIFYING_A_POLICE_OFFICER_BY_BADGE_PAYLOAD':
				sendTextMessageWithUserInput(senderID, "Thanks, I noted down the badge number: " + messageText);

				setTimeout(function() {
					turnUtil.set('STEP:5_ASK_DATE_PAYLOAD');
					sendButtonMessage(senderID, 'STEP:5_ASK_DATE_PAYLOAD');
				}, 1000)

				break;

			case 'STEP:4b4_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_PERSONAL_CHARACTERISTICS_PAYLOAD':
				if (messageText.toLowerCase() == "no") {
					sendTextMessageWithUserInput(senderID, "Thanks, I've noted all that down about the officer.");

					setTimeout(function() {
						turnUtil.set('STEP:5_ASK_DATE_PAYLOAD');
						sendButtonMessage(senderID, 'STEP:5_ASK_DATE_PAYLOAD');
					}, 1000)

				} else {
					// add this message to an array in case the user wnats to add more
					turnUserInputArray.push(messageText);

					turnUtil.set('STEP:5b5_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_PERSONAL_CHARACTERISTICS_CONFIRMATION_PAYLOAD');
					sendTextMessageWithUserInput(senderID, 'Is that all: "' + messageText + '" You can write yes or just continue telling me.');
				}

				break;

			case 'STEP:5b5_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_PERSONAL_CHARACTERISTICS_CONFIRMATION_PAYLOAD':

				if (messageText.toLowerCase() == "yes") {

					sendTextMessage(senderID, "STEP:4X_IDENTIFYING_A_POLICE_OFFICER_DONE_PAYLOAD");

					setTimeout(function() {
						turnUtil.set('STEP:5_ASK_DATE_PAYLOAD');
						sendButtonMessage(senderID, 'STEP:5_ASK_DATE_PAYLOAD');
						turnUserInputArray = [];
					}, 1000)

				} else if (messageText.toLowerCase() == "no") {
					sendTextMessageWithUserInput(senderID, "Ok, just keep writing.");
				} else {

					turnUserInputArray.push(messageText);
					console.log(turnUserInputArray);
					if (turnUserInputArray.length > 1) {

						var allMessagesText = turnUserInputArray.join(" ");
						sendTextMessageWithUserInput(senderID, 'Is that all? "' + allMessagesText + '"');

					} else {
						//start over
						turnUtil.set('STEP:4b4_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_PERSONAL_CHARACTERISTICS_PAYLOAD');

						console.error("something went wrong in merging: turnUserInputArray");
						sendRedundancyMessage(senderID, "something went wrong, let's start this question over.");
					}

				}

				break;

			// Time and date of incident stuff
			//
			case 'STEP:5a_ASK_TO_USER_TO_INPUT_DATE_PAYLOAD':
				// ask for date in text date format
				turnUtil.set('STEP:6_ASK_TIME_PAYLOAD');
				sendTextMessage(senderID, 'STEP:6_ASK_TIME_PAYLOAD');
				break;

			case 'STEP:6_ASK_TIME_PAYLOAD':
				// ask for date in text date format

				if (perceivedExperiencOfIncident === "positive") {
					turnUtil.set('STEP:7a_ASK_ABOUT_POSITIVE_INCIDENT_PAYLOAD');
					sendTextMessage(senderID, 'STEP:7a_ASK_ABOUT_POSITIVE_INCIDENT_PAYLOAD');
				} else {
					turnUtil.set('STEP:7b_ASK_ABOUT_NEGATIVE_INCIDENT_PAYLOAD');
					sendTextMessage(senderID, 'STEP:7b_ASK_ABOUT_NEGATIVE_INCIDENT_PAYLOAD');
				}
				break;

			case 'STEP:7a_ASK_ABOUT_POSITIVE_INCIDENT_PAYLOAD':
			case 'STEP:7b_ASK_ABOUT_NEGATIVE_INCIDENT_PAYLOAD':

				// add this message to an array in case the user wnats to add more
				turnUserInputArray.push(messageText);

				turnUtil.set('STEP:7X_CONFIRM_INCIDENT_PAYLOAD');
				sendTextMessageWithUserInput(senderID, 'Is that all: "' + messageText + '" You can write yes or just continue telling me.');

				break;

			case 'STEP:7X_CONFIRM_INCIDENT_PAYLOAD':
				if (messageText.toLowerCase() == "yes") {

					sendTextMessage(senderID, "STEP:7X_CONFIRM_INCIDENT_PAYLOAD");

					setTimeout(function() {
						turnUtil.set('STEP:8_ASK_ANYTHING_ELSE_TO_ADD_PAYLOAD');
						sendTextMessage(senderID, 'STEP:8_ASK_ANYTHING_ELSE_TO_ADD_PAYLOAD');
						turnUserInputArray = [];
					}, 1000)

				} else if (messageText.toLowerCase() == "no") {
					sendTextMessageWithUserInput(senderID, "Ok, just keep writing.");
				} else {

					turnUserInputArray.push(messageText);
					console.log(turnUserInputArray);
					if (turnUserInputArray.length > 1) {

						var allMessagesText = turnUserInputArray.join(" ");
						sendTextMessageWithUserInput(senderID, 'Is that all? "' + allMessagesText + '"');

					} else {
						//start over
						if (perceivedExperiencOfIncident === "positive") {
							turnUtil.set('STEP:7a_ASK_ABOUT_POSITIVE_INCIDENT_PAYLOAD');
						} else {
							turnUtil.set('STEP:7b_ASK_ABOUT_NEGATIVE_INCIDENT_PAYLOAD');
						}

						console.error("something went wrong in merging: turnUserInputArray");
						sendRedundancyMessage(senderID, "something went wrong, let's start this question over.");
					}

				}

				break;

			case 'STEP:8_ASK_ANYTHING_ELSE_TO_ADD_PAYLOAD':
				if (messageText.toLowerCase() == "yes") {

					setTimeout(function() {
						turnUtil.set('STEP:9_SUBMIT_REPORT_PAYLOAD');
						sendButtonMessage(senderID, 'STEP:9_SUBMIT_REPORT_PAYLOAD');
						turnUserInputArray = [];
					}, 1000)

				} else if (messageText.toLowerCase() == "no") {
					sendTextMessageWithUserInput(senderID, "Ok, just keep writing.");
				} else {

					turnUserInputArray.push(messageText);
					console.log(turnUserInputArray);
					if (turnUserInputArray.length > 1) {

						var allMessagesText = turnUserInputArray.join(" ");
						sendTextMessageWithUserInput(senderID, 'Is that all? "' + allMessagesText + '"');

					} else {
						//start over
						turnUtil.set('STEP:8_ASK_ANYTHING_ELSE_TO_ADD_PAYLOAD');

						console.error("something went wrong in merging: turnUserInputArray");
						sendRedundancyMessage(senderID, "something went wrong, let's start this question over.");
					}

				}

				break;

      default:
        sendRedundancyMessage(senderID, messageText);

    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Sorry, you cannot send attachments at this time. I'm not that smart yet. Please start over.");
  }
}


/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s",
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}


/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 *
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

	// If we receive a text message, check what turn we are on to make sure
	// we give the appropriate response
	var turn = turnUtil.get()

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);


		if (payload) {

			// When a postback is called, if we receive a payload, check to see if it matches a predefined
			// payload and send back the corresponding response. Otherwise, just echo
			// the text we received.

			// if the postback payload includes data the user has confirmed
			if (payload.includes("details:", 0)) {

				var userConfirmedData = payload.substring(8);
				console.log("USERC CONFIRMED DATA: " + userConfirmedData);

				// response from positive/negative question
				if(userConfirmedData === "positive" || userConfirmedData === "negative") {

					// save type of experience for later
					perceivedExperiencOfIncident = userConfirmedData;

					// confirm response
					sendTextMessageWithUserInput(senderID, "Thanks, I've noted down that the interaction was: " + userConfirmedData);

					// send appropriate response based on if user selects negative or positive
					if(perceivedExperiencOfIncident === "positive") {

						setTimeout(function() {
							sendTextMessage(senderID, 'STEP:2a_POSITIVE_RESPONSE_PAYLOAD');
						}, 1000);

						// then go to next question
						setTimeout(function() {
							turnUtil.set('STEP:3_ASK_LOCATION_PAYLOAD');
							sendTextMessage(senderID, 'STEP:3_ASK_LOCATION_PAYLOAD');
						}, 2000)


					} else {

						setTimeout(function() {
							sendTextMessage(senderID, 'STEP:2b_NEGATIVE_RESPONSE_PAYLOAD');
						}, 1000);

						// then go to next question
						setTimeout(function() {
							turnUtil.set('STEP:3_ASK_LOCATION_PAYLOAD');
							sendTextMessage(senderID, 'STEP:3_ASK_LOCATION_PAYLOAD');
						}, 2000)

					}

				} else { // everything else could only be response from location confirmation

					// TODO: CHECK What turn we are on and then do it so we can use this function again
					sendTextMessageWithUserInput(senderID, "Thanks, I've noted down that the location is: " + userConfirmedData);

					// move to next turn and get information about the officer
					setTimeout(function() {
						turnUtil.set('STEP:4_IDENTIFYING_A_POLICE_OFFICER_PAYLOAD');
						sendButtonMessage(senderID, 'STEP:4_IDENTIFYING_A_POLICE_OFFICER_PAYLOAD');
					}, 1000)

				}

			} else {

				// Check content/index.js for button payloads
				switch (payload) {

					// FIRST TIME RESPONSE BUTTONS
					case 'STEP:1_GET_STARTED_PAYLOAD':
					case 'STEP:2_ASK_POSITIVE_NEGATIVE_PAYLOAD':
						// confirm starting new report
						turnUtil.set(payload);
						sendButtonMessage(senderID, payload);
						break;

					// START NEW REPORT RESPONSE
					case 'STEP:1a_START_REPORT_PAYLOAD':
						sendTextMessage(senderID, payload);

						setTimeout(function() {
							turnUtil.set('STEP:2_ASK_POSITIVE_NEGATIVE_PAYLOAD');
							sendButtonMessage(senderID, 'STEP:2_ASK_POSITIVE_NEGATIVE_PAYLOAD');
						}, 1000)
						break;

					// TEXT RESPONSES
					case 'STEP:3a_ASK_LOCATION_AGAIN_PAYLOAD':
					case 'STEP:4a_IDENTIFYING_A_POLICE_OFFICER_BY_BADGE_PAYLOAD':
					case 'STEP:5a_ASK_TO_USER_TO_INPUT_DATE_PAYLOAD':
					case 'STEP:6_ASK_TIME_PAYLOAD':

						turnUtil.set(payload);
						sendTextMessage(senderID, payload);
						break;

					// QUICK REPLY RESPONSES
					case 'STEP:4b1_IDENTIFYING_A_POLICE_OFFICER_BY_DESCRIPTION_ETHNICITY_PAYLOAD':

						turnUtil.set(payload);
						sendQuickReply(senderID, payload);
						break;

					// LAST MESSAGE RESPONSE
					case 'STEP:10_SUBMITTED_REPORT_PAYLOAD':
						turnUtil.set(payload);
						sendGenericMessage(senderID, content[payload]);
						break;

					// REDO TURN
					case 'UTILITIES:REDO_TURN_PAYLOAD':
						turnUtil.redo(turn).then(function(nextTurn) {

							console.log("the next turn should be: "+ nextTurn);
							// TODO: In order to do this we need to think as each action
							// as individual, need to be triggered whenever
							// each conversation elements need to be associated to a type
							// of component.

							var newPayload = {
								message : {
									text :"You sure?",
									quick_replies:[{
											content_type:"text",
											title:"Yep",
											// payload: nextTurn
											payload: "UTILITIES:REDO_PREVIOUS_QUESTION_PAYLOAD"
										},
										{
											content_type:"text",
											title:"Nah",
											payload:"UTILITIES:CONTINUE_PAYLOAD"
										}
									]
								}
					    }
							console.log(newPayload);
							sendDynamicPayloadQuickReply(senderID, newPayload);

						}).catch(function(err) {
							console.error("err.message");
						});

						break;

					// REDUNDANCY RESPONSE
					default:
						sendTextMessage(senderID, "Sorry, I did not understand. Try again or start over.");
				}
			}

		}

}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 *
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);
}

/*
* Send messages to user functions usinf the Send Api
*
*/
function sendRedundancyMessage(recipientId, messageText) {
 var messageData = {
   recipient: {
     id: recipientId
   },
   message: {
     text: "Sorry, I did not understand: " + messageText,
     metadata: "DEVELOPER_DEFINED_METADATA"
   }
 };

 fb.callSendAPI(messageData);
}

/*
* Send messages to user function using the Send Api
* These messages are based on content solely on predifined content
*/
function sendTextMessage(recipientId, payload) {
 var messageData = {
   recipient: {
     id: recipientId
   },
   message: {
     text: content[payload].message.text,
     metadata: "DEVELOPER_DEFINED_METADATA"
   }
 };

 fb.callSendAPI(messageData);
}

/*
* Send messages to user function using the Send Api
* These messages are based on content solely on predifined content
*/
function sendTextMessageWithUserInput(recipientId, payload) {
 var messageData = {
   recipient: {
     id: recipientId
   },
   message: {
     text: payload,
     metadata: "DEVELOPER_DEFINED_METADATA"
   }
 };

 fb.callSendAPI(messageData);
}

/*
* Send a button message using the Send API.
*
*/
function sendButtonMessage(recipientId, payload) {
 var messageData = {
   recipient: {
     id: recipientId
   },
   message: {
     attachment: Object.assign({
       type: "template"
     }, content[payload])
   }
 };

 fb.callSendAPI(messageData);
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId, payload) {
  var messageData = {
    recipient: {
      id: recipientId
    },
		message: {
      attachment: Object.assign({
        type: "template"
      }, payload)
    }
  };

  fb.callSendAPI(messageData);
}



/*
* Send message with Quick Reply buttons with content based payload.
*
*/
function sendQuickReply(recipientId, payload) {
 var messageData = Object.assign({
		 recipient: {
			 id: recipientId
		 }}, content[payload])

 fb.callSendAPI(messageData);
}

/*
* Send a message with Quick Reply buttons with dynamic payload
*
*/
function sendDynamicPayloadQuickReply(recipientId, payload) {
 var messageData = Object.assign({
		 recipient: {
			 id: recipientId
		 }}, payload)

 fb.callSendAPI(messageData);
}


/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}


// spin spin sugar
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})
