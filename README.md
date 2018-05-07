# Requirements
- Node &gt;= 6 (tested w/ 6.10.0)
- Bash (to run scripts)
- Mocha (to run unit tests)

# Installation
1) Clone project / Download zip
2) "cd" into root directory
3) run "./scripts/install" to install.

# Running Server
1) "cd" into root directory
2) run "./scripts/run" to run server

# Running Tests
1) "cd" into root directory
2) run "./scripts/test"

# Remarks
I chose to use centimeters as the unit for distance since it allows the underlying database implementation to use integer storage rather than float storage.  Additionally, I chose centimeters rather than meters or decimeters since it gives a good amount of resolution across the expected input space (i.e., [0, 760]).  Obviously, most implementations of integers in SQL DBs will not be able to store distances above 2^32 cm (~43,000 km), which is most likely acceptable for this application.

I chose to use SQLite3 as the database for the backend in order to reduce external software required to run the code for QA, but the query builder framework used (KnexJS) is capable of supporting a wide variety of RDB's (see http://knexjs.org/ for details).

I assumed in designing the API that single-writes will be more common than bulk-writes.  I also assumed that IPD's were immutable.  Finally, I assumed that entries for a single playerID would be relatively small (i.e., tested with up to 10,000 pairs).  The API included could be easily modified to accomodate relaxation of any of these constraints.

The definition of "Personal space", etc. is based on the work done by Edward T. Hall and his definition of interpersonal space.  The insights engine retrieves the following information:
- A list of the ten "nearest neighbor" main players to the player in question.  This definition of similar is based on the idea that you can infer someone's concept of a "normal" IPD based on the average of all their (player, entity) distance pairs.  It follows that people with the same concept of "normal" IPD can be considered similar.
- Statistics about the player in question behavior as an individual.  For each entity which there is a set of (player, entity) pairs, we calculate standard statistics (min, max, average, variance, count) as well as segment the time series into "crosses".  Each cross is a segment of the time series in which the main player is in a certain "space" as defined by Hall's work.  This gives allows us to infer a lot of derived information from this segmentation.  For example: how long did the player spend in "intimate" or "personal" space of a given entity?  How many times did get cross from "social" space to "personal" space? Did he cross into "personal" space and then relatively quickly go back to "social" space? etc.  N.B., it is assumed that distance pairs are added in the order they occured in terms of time.

# Endpoints

## GET /ipd/&lt;playerID&gt;[?page=1&sort=distance&order=asc]
Get a paginated list of all IPDs between &lt;playerID&gt; and other entities

### Params
- playerID: Required, a unique integer ID for the pair (&lt;playerID&gt;, X) for all X in DB
- page: Optional, defaults to 1, which page to retrieve as a natural number, non-zero
- order: Optional, defaults to "asc", whether to order by ascending: "asc" or descending: "desc"
- sort: Optional, defaults to "distance", what field to sort on.  One of "distance" or "id"

### Returns
An object with the following fields:
- distances: &lt;array of distances&gt; each item will be an object with the fields:
	- id: &lt;integer&gt; unique ID of the other half of this pair
	- d:  &lt;natural number&gt; how far (IPD) "id" was from &lt;PlayerID&gt; in cm

### Errors
400: If any of the params are out of domain as defined above


## POST /ipd/&lt;playerID&gt;/add
Append a distance to the list of IPDs for &lt;playerID&gt;

### Params
- playerID: Required, a unique integer ID for the pair (&lt;playerID&gt;, X) for all X

### Body
Body of the POST should be a JSON object with following fields:
- id: &lt;integer&gt; unique ID of the other half of this pair
- d:	&lt;natural number&gt; how far (IPD) "id" was from &lt;playerID&gt; in cm

### Returns
No body on success, error message on error

### Errors
400: if the distance pair (&lt;playerID&gt;, id) already exists, playerID/id is out of domain, etc.

## GET /insights/ipd/&lt;playerID&gt;
Get all insights gained from &lt;playerID&gt; based on IPD.  Semantic definitions based on Edward T. Hall's work on IPD.

### Params
- playerID: Required, a unique integer ID for the pair (&lt;playerID&gt;, X) for all X in DB

### Returns
An object with the following fields:
- stats: &lt;map of entity id to object&gt; each sub-object has all the fields:
	- min: &lt;number&gt; minimum IPD of player to all entities
	- max: &lt;number&gt; maximum IPD of player to all entities
	- mean: &lt;number&gt; average IPD of player to all entities
	- count: &lt;natural number&gt; number of IPD pairs
	- variance: &lt;number&gt; variance of the IPD 
	- crosses: &lt;array of objects&gt; each sub-object has fields:
		- length &lt;natural number&gt; how long in this segment?
		- space &lt;natural number&gt; ID of space (0 == INTIMATE, 1 = PERSONAL, 2 = SOCIAL, 3 = PUBLIC)

Definitions of 'space' based on Hall's work:
- Intimate Space (space == 0): [0, 45) cm
- Personal Space (space == 1): [45, 120) cm
- Social Space (space == 2): [120, 360) cm
- Public Space (space == 3): [360, inf) cm

### Errors
400: If any of the params are out of domain as defined above