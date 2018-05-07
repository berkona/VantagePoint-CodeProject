
exports.seed = function(knex, Promise) {
  // Deletes ALL existing entries
  return knex('ipds').del()
    .then(function () {
      var data = [];
      
      // create a person who is really close to some of entities
      for (var i = 1; i <= 200; i++) {
        data.push({
          playerID: 1,
          entityID: i,
          distance: 10,
        });
      }

      // create a person who has a linear distance to entities
      for (var i = 1; i <= 200; i++) {
        data.push({
          playerID: 2,
          entityID: i,
          distance: 10 * i,
        });
      }

      // create a person who has a a bunch distance pairs to entities
      for (var i = 1; i <= 10000; i++) {
        data.push({
          playerID: 3,
          entityID: i,
          distance: 10 * i,
        });
      }

      return knex.batchInsert('ipds', data, 200);
    });
};
