
exports.up = function(knex) {
	return knex.schema.createTable("ipds", function (table) {
		table.increments();
		table.integer("playerID").unsigned().notNullable();
		table.integer("entityID").unsigned().notNullable();
		table.integer("distance").unsigned().notNullable();

		// index to make searching by playerID faster
		table.index("playerID");
		// index to make sorting by distance faster
		table.index("distance");
	});
};

exports.down = function(knex) {
	return knex.schema.dropTable("ipds");
};
