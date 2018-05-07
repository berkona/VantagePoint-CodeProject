
// requires
var Promise = require("bluebird");
var express = require('express');
var bodyParser = require('body-parser');
// end requires

// some shared constants
var INTIMATE_SPACE = 0;
var PERSONAL_SPACE = 1;
var SOCIAL_SPACE = 2;
var PUBLIC_SPACE = 3;

var INTIMATE_SPACE_LIM = 45;
var PERSONAL_SPACE_LIM = 120;
var SOCIAL_SPACE_LIM = 360;

var NUM_NEIGHBORS = 10;
// end constants

// helper fns

function getSpace(x) {
	if (x < INTIMATE_SPACE_LIM) {
		return INTIMATE_SPACE;
	} 
	else if (x < PERSONAL_SPACE_LIM) {
		return PERSONAL_SPACE;
	} 
	else if (x < SOCIAL_SPACE_LIM) {
		return SOCIAL_SPACE;
	} 
	else {
		return PUBLIC_SPACE;
	}
}

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

// end helper fns

// api factory fns

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
				sendServerError("POST /ipd/<playerID>/add", res, err);
			});
	});

	return router;
}

/**
 * Process a sequence of IPD's for a single entityID
 * @returns All the insights gained from this sequence of IPD's
 */
function processIPDRows(rows) {
	var min = Number.POSITIVE_INFINITY;
	var max = Number.NEGATIVE_INFINITY;
	var mean = 0;
	var mean2 = 0;
	var count = rows.length;
	var crosses = [];
	var delta, delta2, distance, space;


	for (var i = 0; i < count; i++) {
		distance = rows[i].distance;

		// simple min/max algorithm
		min = Math.min(min, distance);
		max = Math.max(max, distance);

		// welford knuth variance/mean algorithm
		delta = distance - mean;
		mean += delta / (i + 1);
		delta2 = distance - mean;
		mean2 += delta * delta2;

		// crossing algorithm
		space = getSpace(distance);
		// initialization or crossed from one space to another
		if (crosses.length == 0 || crosses[crosses.length-1].space != space) {
			crosses.push({
				length: 1,
				space: space,
			});
		}
		// increase length of cross
		else {
			crosses[crosses.length-1].length++;
		}
	}
	// variance is undefined for count == 1
	var variance = count > 1 ? mean2 / (count - 1) : Number('nan');
	return {
		min: min,
		max: max,
		mean: mean,
		count: count,
		variance: variance,
		crosses: crosses,
	};
}

/**
 * Creates a router which defines all of the API end-points for insight queries
 * @returns an express.Router which is ready to be used
 */
function createInsightEndpoints(knex) {
	var router = express.Router();

	// get insights based on IPD
	router.get('/ipd/:playerID', function (req, res) {
		// coerce params
		var playerID = Number(req.params.playerID);

		// enforce contraints
		if (!validNaturalNumber(playerID, 1)) {
			return sendError(res, 400, "'playerID' must be a non-zero natural number");
		}

		/*
		  Find the 'nearest neighbors' to playerID
		  Define the distance between two playerIDs as being the difference between their average IPD's to all entities
		  The following is based on this query:
		    
		    SELECT `playerID` as `id`, AVG(`distance`) - ( SELECT AVG(`distance`) from `ipds` WHERE `playerID` = ?) as `neighbor_dist`
		 	FROM `ipds` 
		 	WHERE NOT `playerID` = ?
		 	GROUP BY `playerID` 
		 	SORT BY `neighbor_dist`
		 	LIMIT ?

		 */
		var raw_inner = knex.raw("AVG(distance) - ( SELECT AVG(distance) from ipds WHERE `playerID` = ? ) as neighbor_dist", [ playerID ]);
		var neighbor_query = knex('ipds')
			.select('playerID as id', raw_inner)
			.groupBy('playerID')
			.orderBy('neighbor_dist')
			.whereNot('playerID', playerID)
			.limit(NUM_NEIGHBORS);

		// this query does all the statistical insights
		// we could have used a GROUP BY with an MIN/AVG/MAX/COUNT fn-s,
		// but I also wanted to determine time spent in a specific "space" and number of times crossed from space X to Y, etc.
		// see processIPDRows for details about statistics gained
		var stats_query = knex('ipds')
			.where('playerID', playerID)
			.orderBy('id', 'asc')
			.then(function (rows) {
				var aggregated = rows.reduce(function (accum, row) {
					if (!accum[row.entityID])
						accum[row.entityID] = []
					accum[row.entityID].push(row);
					return accum;
				}, {});

				var stats = {};
				for (var entityID in aggregated) {
					stats[entityID] = processIPDRows(aggregated[entityID]);
				}

				return stats;
			});

		Promise.props({
			stats: stats_query,
			neighbors: neighbor_query,
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

// end api factory fns

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