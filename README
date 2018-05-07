# Requirements
- Node (tested w/ 6.10.0)

# Installation
"cd" into root directory, run "./scripts/install" to install.

# Running Server
"cd" into root directory, run "./scripts/run" to run server

# Remarks
I chose to use centimeters as the unit for distance since it allows the underlying database implementation to use integer storage rather than float storage.  Additionally, I chose centimeters rather than meters or decimeters since it gives a good amount of resolution across the expected input space (i.e., [0, 760]).  Obviously, most implementations of integers in SQL DBs will not be able to store distances above 2^32 cm (~43,000 km), which is most likely acceptable for this application.

I chose to use SQLite3 as the database for the backend in order to reduce external software required to run the code for QA, but the query builder framework used (KnexJS) is capable of supporting a wide variety of RDB's (see http://knexjs.org/ for details).

I assumed in designing the API that single-writes will be more common than bulk-writes.  I also assumed that IPD's were immutable and unique for a given pair (playerID, entityID).  The API included could be easily modified to accomodate relaxation of any of these constraints.  Finally, I assumed that entries for a single playerID would be relatively small (i.e., tested with up to 10,000 pairs).

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
	distances: <array of distances> each item will be an object with the fields:
		id: <integer> unique ID of the other half of this pair
		d:  <natural number> how far (IPD) "id" was from <PlayerID> in cm

### Errors
400: If any of the params are out of domain as defined above


## POST /ipd/<playerID>/add
Append a distance to the list of IPDs for <playerID>

### Params
- playerID: Required, a unique integer ID for the pair (<playerID>, X) for all X

### Body
Body of the POST should be a JSON object with following fields:
		id: <integer> unique ID of the other half of this pair
		d:	<natural number> how far (IPD) "id" was from <playerID> in cm

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
	stats: <object> has all the fields:
		average: <natural number> average IPD of player to all entities
		min: <natural number> minimum IPD of player to all entities
		max: <natural number> maximum IPD of player to all entities
		count: <natural number> number of IPD pairs
	intimate_space: <array, id> entity ids which player was within the 'intimate space' of entity ( i.e., [0, 45) )
	personal_space: <array, id> entity ids which player was within the 'personal space' of entity ( i.e., [45, 120) )
	social_space: <array, id> entity ids which player was within the 'social space' of entity ( i.e., [120, 360) )
	public_space: <array, id> entity ids which player was within the 'public space' of entity ( i.e., [360, inf] )

### Errors
400: If any of the params are out of domain as defined above