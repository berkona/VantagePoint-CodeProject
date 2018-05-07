
// requires
var Promise = require("bluebird");
var express = require('express');
var bodyParser = require('body-parser');
// end requires

// expected error handling, just send message and code as per spec
function sendError(res, code, message) {
	res.status(code).json({ message: message });
}

// exception handling, don't bleed stack traces to outside world, but log them to console
function sendServerError(endPointName, res, err) {
	console.error(endPointName + " - unexpected exception:");
	console.error(err);
	sendError(res, 500, "Unexpected exception during query, please contact web admin.");
}

// helper fn for validating numbers
function validNaturalNumber(id, min) {
	return Number.isFinite(id) && id >= min;
}

/**
 * Creates a router which defines all of the API end-points for IPD-based queries
 * @returns an express.Router which is ready to be used
 */
function createIPDEndpoints(knex) {
	var router = express.Router();

	// constants
	var GET_DEFAULTS = {
		page: 1,
		order: "asc",
		sort: "distance",
 	};

 	var PAGE_SIZE = 200;

 	// implements end-point GET /ipd/<playerID>[?page=1&sort=distance&order=asc]
	router.get("/:playerID", function (req, res) {
		// merge defaults, query string and named URL params
		// order of sources is important here
		var params = Object.assign({}, GET_DEFAULTS, req.query, req.params);

		// coerce params types
		params.playerID = Number(params.playerID);
		params.page = Number(params.page);

		// enforce param constraints
		if (!validNaturalNumber(params.playerID, 1)) {
			return sendError(res, 400, "'playerID' must be a non-zero natural number");
		}
		else if (!validNaturalNumber(params.page, 1)) {
			return sendError(res, 400, "'page' must be a non-zero natural number");
		}
		else if (params.order != "asc" && params.order != "desc") {
			return sendError(res, 400, "'order' must be either 'asc' or 'desc'");
		}
		else if (params.sort != "distance" && params.sort != "id") {
			return sendError(res, 400, "'sort' must be either 'distance' or 'id'");
		}

		// everything is ok past here, so actually create query and hit DB
		var n_skip = (params.page-1) * PAGE_SIZE;
		var order_col = params.sort == 'id' ? 'entityID' : 'distance';

		knex('ipds')
			// this section builds the query
			.where('playerID', params.playerID)
			.select('entityID as id', 'distance as d')
			.orderBy(order_col, params.order)
			.offset(n_skip)
			.limit(PAGE_SIZE)
			// this causes query to be executed, and kicks off a promise chain to either return the data or an error message
			.map(function (row) {
				// map to a plain JS object to make sure we don't bleed unintended information to the outside world
				return {
					id: row.id,
					d: row.d,
				};
			})
			// transform to final response body format
			.then(function (rows) {
				return {
					distances: rows
				};
			})
			// actually send the response
			.then(function (body) {
				res.json(body);
			})
			.catch(function (err) {
				sendServerError("GET /ipd/<playerID>", res, err);
			});
	});
	
	// implements end-point POST /ipd/<playerID>/add
	router.post("/:playerID/add", function (req, res) {
		var row = {
			playerID: Number(req.params.playerID), 
			entityID: Number(req.body.id),
			distance: Number(req.body.d),
		};

		// enforce constraints
		if (!validNaturalNumber(row.playerID, 1)) {
			return sendError(res, 400, "'playerID' must be a non-zero natural number");
		}
		else if (!validNaturalNumber(row.entityID, 1)) {
			return sendError(res, 400, "'id' must be a non-zero natural number");
		}
		else if (!validNaturalNumber(row.distance, 0)) {
			return sendError(res, 400, "'d' must be a natural number");
		}

		knex('ipds')
			.insert(row)
			.then(function () {
				res.json();
			})
			.catch(function (err) {
				// TODO what is err.code for other backends?
				if (err.code == "SQLITE_CONSTRAINT") {
					sendError(res, 400, "Cannot add the same distance pair twice");
				} else {
					sendServerError("POST /ipd/<playerID>/add", res, err);
				}
			});
	});

	return router;
}

/**
 * Creates a router which defines all of the API end-points for insight queries
 * @returns an express.Router which is ready to be used
 */
function createInsightEndpoints(knex) {
	var router = express.Router();

	var INTIMATE = 45;
	var PERSONAL = 120;
	var SOCIAL = 360;

	// get insights based on IPD
	router.get('/ipd/:playerID', function (req, res) {
		// coerce params
		var playerID = Number(req.params.playerID);

		// enforce contraints
		if (!validNaturalNumber(playerID, 1)) {
			return sendError(res, 400, "'playerID' must be a non-zero natural number");
		}

		var stats_query = knex('ipds')
			.where('playerID', playerID)
			.min('distance as min')
			.max('distance as max')
			.avg('distance as average')
			.count('distance as count')
			.then(function (x) {
				return x[0];
			});

		function transform_rows(rows) {
			return rows.reduce(function (accum, next) {
				accum.push(next.id);
				return accum;
			}, []);
		}

		var initimate_query = knex('ipds')
			.select('entityID as id')
			.where('playerID', playerID)
			.where('distance', '<', INTIMATE)
			.then(transform_rows);
		
		var personal_query = knex('ipds')
			.select('entityID as id')
			.where('playerID', playerID)
			.where('distance', '>=', INTIMATE)
			.where('distance', '<', PERSONAL)
			.then(transform_rows);

		var social_query = knex('ipds')
			.select('entityID as id')
			.where('playerID', playerID)
			.where('distance', '>=', PERSONAL)
			.where('distance', '<', SOCIAL)
			.then(transform_rows);

		var public_query = knex('ipds')
			.select('entityID as id')
			.where('playerID', playerID)
			.where('distance', '>=', SOCIAL)
			.then(transform_rows);

		Promise.props({
			stats: stats_query,
			intimate_space: initimate_query,
			personal_space: personal_query,
			social_space: social_query,
			public_space: public_query,
		})
		.then(function (data) {
			res.json(data);
		})
		.catch(function (err) {
			sendServerError('GET /insights/ipd/:playerID', res, err);
		});
	});

	return router;
}

/**
 * Creates a router which defines all of the API end-points
 * @returns an express.Router which is ready to be used
 */
function createAPI(knex) {
	var router = express.Router();

	router.use("/ipd", createIPDEndpoints(knex));
	router.use("/insights", createInsightEndpoints(knex));

	return router;
}

/**
 * Create the express application and return it
 * @returns an express application configured for listening
 */
function createApp() {
	var environment = process.env.NODE_ENV || 'development'
	var knex_config = require('../knexfile')[environment];
	if (!knex_config)
		return console.error("Cannot find knex config for environment: " + environment);

	//create db connection
	var knex = require('knex')(knex_config);

	// setup express app
	var app = express();
	app.use(bodyParser.json());

	// create API
	var api = createAPI(knex);
	app.use(api);

	return app;
}

/**
 * Entry point for server
 */
function main() {
	app = createApp();

	// spin-up server
	var app_port = process.env.NODE_PORT || 3000;
	app.listen(app_port, function(err) {
		if (err) {
			console.error("Could not start server:" + err);
		} else {
			console.log("Server started on port " + app_port);
		}
	});
}

// either run the server or export the app depending on if we're required or called directly from CLI
if (require.main === module) {
	main();
} else {
	module.exports = exports = createApp();
}