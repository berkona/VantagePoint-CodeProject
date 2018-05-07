# Requirements
- Node >= 6 (tested w/ 6.10.0)

# Installation
"cd" into root directory, run "./scripts/install" to install.

# Running Server
"cd" into root directory, run "./scripts/run" to run server

# Remarks
I chose to use centimeters as the unit for distance since it allows the underlying database implementation to use integer storage rather than float storage.  Additionally, I chose centimeters rather than meters or decimeters since it gives a good amount of resolution across the expected input space (i.e., [0, 760]).  Obviously, most implementations of integers in SQL DBs will not be able to store distances above 2^32 cm (~43,000 km), which is most likely acceptable for this application.

I chose to use SQLite3 as the database for the backend in order to reduce external software required to run the code for QA, but the query builder framework used (KnexJS) is capable of supporting a wide variety of RDB's (see http://knexjs.org/ for details).

I assumed in designing the API that single-writes will be more common than bulk-writes.  I also assumed that IPD's were immutable.  Finally, I assumed that entries for a single playerID would be relatively small (i.e., tested with up to 10,000 pairs).  The API included could be easily modified to accomodate relaxation of any of these constraints.

The definition of "Personal space", etc. is based on the work done by Edward T. Hall and his definition of interpersonal space.  The insights engine retrieves the following information:
- A list of the ten "nearest neighbor" main players to the player in question.  This definition of similar is based on the idea that you can infer someone's concept of a "normal" IPD based on the average of all their (player, entity) distance pairs.  It follows that people with the same concept of "normal" IPD can be considered similar.
- Statistics about the player in question behavior as an individual.  For each entity which there is a set of (player, entity) pairs, we calculate standard statistics (min, max, average, variance, count) as well as segment the time series into "crosses".  Each cross is a segment of the time series in which the main player is in a certain "space" as defined by Hall's work.  This gives allows us to infer a lot of derived information from this segmentation.  For example: how long did the player spend in "intimate" or "personal" space of a given entity?  How many times did get cross from "social" space to "personal" space? Did he cross into "personal" space and then relatively quickly go back to "social" space? etc.  N.B., it is assumed that distance pairs are added in the order they occured in terms of time.

# Endpoints

## GET /ipd/<playerID>[?page=1&sort=distance&order=asc]
Get a paginated list of all IPDs between <playerID> and other entities

### Params
- playerID: Required, a unique integer ID for the pair (<playerID>, X) for all X in DB
- page: Optional, defaults to 1, which page to retrieve as a natural number, non-zero
- order: Optional, defaults to "asc", whether to order by ascending: "asc" or descending: "desc"
- sort: Optional, defaults to "distance", what field to sort on.  One of "distance" or "id"

### Returns
An object with the following fields:
- distances: <array of distances> each item will be an object with the fields:
	- id: <integer> unique ID of the other half of this pair
	- d:  <natural number> how far (IPD) "id" was from <PlayerID> in cm

### Errors
400: If any of the params are out of domain as defined above


## POST /ipd/<playerID>/add
Append a distance to the list of IPDs for <playerID>

### Params
- playerID: Required, a unique integer ID for the pair (<playerID>, X) for all X

### Body
Body of the POST should be a JSON object with following fields:
- id: <integer> unique ID of the other half of this pair
- d:	<natural number> how far (IPD) "id" was from <playerID> in cm

### Returns
No body on success, error message on error

### Errors
400: if the distance pair (<playerID>, id) already exists, playerID/id is out of domain, etc.

## GET /insights/ipd/<playerID>
Get all insights gained from <playerID> based on IPD.  Semantic definitions based on Edward T. Hall's work on IPD.

### Params
- playerID: Required, a unique integer ID for the pair (<playerID>, X) for all X in DB

### Returns
An object with the following fields:
- stats: <map of entity id to object> each sub-object has all the fields:
	- min: <number> minimum IPD of player to all entities
	- max: <number> maximum IPD of player to all entities
	- mean: <number> average IPD of player to all entities
	- count: <natural number> number of IPD pairs
	- variance: <number> variance of the IPD 
	- crosses: <array of objects> each sub-object has fields:
		- length <natural number> how long in this segment?
		- space <natural number> ID of space (0 == INTIMATE, 1 = PERSONAL, 2 = SOCIAL, 3 = PUBLIC)

	Definitions of 'space' based on Hall's work:
		Intimate Space: [0, 45) cm
		Personal Space: [45, 120) cm
		Social Space: [120, 360) cm
		Public Space: [360, inf) cm

### Errors
400: If any of the params are out of domain as defined above