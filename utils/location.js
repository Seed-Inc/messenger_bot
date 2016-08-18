'use strict'

const config = require('config')
const request = require('request')
const content = require('../content')
const googlePlacesApi = require('./services/googlePlacesApi')
/*
 * Collection of methods related to getting the users location
 *
 */
module.exports = {

	/*
	 * Create a generic template from an array of location predictions
	 * https://developers.facebook.com/docs/messenger-platform/send-api-reference/generic-template
	 */
	createLocationPredictionsPayload(predictions) {

		if (!Array.isArray(predictions)) {
			return Promise.reject(new Error('not array'));
		}

		return new Promise(function(resolve, reject) {

			/*
			 * Loop through the predictions array and add the prediction description
			 * as the title for each template so the user can choose
			 * If elements exists, add them to a generic payload
			 * and if there is only one result send a single generic template with
			 * a confirm or try again option.
			 * If there are multiple results send generic template with multiple
			 * elements and add a last element to try again.
			 *
			 */

			var elements = []

			// create generic element templates and add to elements array
			if (predictions.length === 1) {

				console.log(predictions[0].description);
				// only one prediction received
				var element = {
					title: predictions[0].description,
					buttons: [{
						type: "postback",
						title: "Confirm",
						payload: "details:"+predictions[0].description,
					},
					{
						type: "postback",
						title: "Try Again",
						payload: "STEP:3a_ASK_LOCATION_AGAIN_PAYLOAD",
					}]
				}
				elements.push(element)

			} else {

				// multiple predictions received
				for (var i = 0; i < predictions.length; i++) {

					var element = {
						title: predictions[i].description,
						buttons: [{
							type: "postback",
							title: "Confirm",
							payload: "details:"+predictions[i].description,
						}]
					}
					elements.push(element)

				}

			}


			// add generic element templates to payload
			if (elements.length === 1) {

				var elementsData = {
					elements: elements
				};

				var payloadTemplate = {
		      payload: Object.assign({
						template_type: "generic"
					}, elementsData)
				};

				resolve(payloadTemplate);

			} else if (elements.length > 1) {

				// add a redundancy element, so user can be more precise
				var redundancyElement = {
					title: "Not here? Try and be more precise.",
					buttons: [{
						type: "postback",
						title: "Try Again",
						payload: "STEP:3a_ASK_LOCATION_AGAIN_PAYLOAD",
					}]
				}
				elements.push(redundancyElement);

				var elementsData = {
					elements: elements
				};

				var payloadTemplate = {
		      payload: Object.assign({
						template_type: "generic"
					}, elementsData)
				};

				resolve(payloadTemplate);

			} else {
				reject(new Error('something went wrong creating predictions payload'))
			}

		});

	},

	getPredictions(query) {
		return googlePlacesApi.callPlaceAutocompleteService(query);
	}
};
