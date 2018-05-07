
exports.up = function(knex, Promise) {
	return knex.schema.createTable('ipds', function (table) {
		table.integer('playerID').unsigned().notNullable();
		table.integer('entityID').unsigned().notNullable();
		table.integer('distance').unsigned().notNullable();

		// index to make searching by playerID faster
		table.index('playerID');
		// index to make sorting by distance faster
		table.index('distance');
		// enforce unique-ness of (playerID, entityID) distance pairs
		table.primary(['playerID', 'entityID']);
	});
};

exports.down = function(knex, Promise) {
	return knex.schema.dropTable('ipds');
};
