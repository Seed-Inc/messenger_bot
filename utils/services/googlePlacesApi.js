'use strict'

const config = require('config')
const request = require('request')
const content = require('../../content')

// Google places api key
// https://developers.google.com/places/web-service/get-api-key
const GOOGLE_PLACES_API_KEY = (process.env.GOOGLE_PLACES_API_KEY) ?
  process.env.GOOGLE_PLACES_API_KEY :
  config.get('googlePlacesApiKey');

module.exports = {

  /*
   * Call google place autocomplete api and return an array of location
   * predictions. Predictions results are resticted to cities & regions in the US.
   * https://developers.google.com/places/web-service/autocomplete
   */
	callPlaceAutocompleteService(query) {

		if (typeof query !== "string") {
			return Promise.reject(new Error('query not a string'));
		}

		return new Promise(function(resolve, reject) {

      request({
        uri: 'https://maps.googleapis.com/maps/api/place/autocomplete/json?',
        qs: {
          input: query,
          types: '(regions)',
          components: 'country:us',
          key: GOOGLE_PLACES_API_KEY
        },
        method: 'POST'

      }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          var status = JSON.parse(body).status
          var predictions = JSON.parse(body).predictions

          if (status == "OK") {
            resolve(predictions)
          } else if (status == "ZERO_RESULTS") {
            resolve([])
          } else {
            reject(new Error('error fetching fetching location prediction results: ' + status))
          }
        } else {
          console.error(response.error);
          reject(new Error('server error: ' + response.error))
        }
      });
    });

	}

};
