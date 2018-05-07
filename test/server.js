
var chai = require("chai");
var chaiHttp = require("chai-http");
var expect = chai.expect;

chai.use(chaiHttp);

function expectError(app, code, endpoint) {
	return chai.request(app).get(endpoint).then(function (res) {
		expect(res).to.have.status(code);
		expect(res).to.be.json;
		expect(res).to.have.property("body");
		expect(res.body).to.have.property("message");
	});
}

function expectPostError(app, code, endpoint, data) {
	return chai.request(app).post(endpoint).send(data).then(function (res) {
		expect(res).to.have.status(code);
		expect(res).to.be.json;
		expect(res).to.have.property("body");
		expect(res.body).to.have.property("message");
	});
}

function createDB() {
	var environment = "development";
	var knex_config = require("../knexfile")[environment];
	if (!knex_config)
		throw new Error("Cannot find knex config for environment: " + environment);

	//create db connection
	var knex = require("knex")(knex_config);
	return knex;
}

describe("server.js", function () {
	var app = require("../src/server");

	describe("GET /ipd/<playerId>", function() {
		before(function () {
			return createDB().seed.run();
		});

		after(function () {
			return createDB().table("ipds").del();
		});

		it("should return the correct data for a given ID", function() {
			// this is a good sanity check for all the features of the end-point in one go (obviously not exhaustive)
			return chai.request(app)
				.get("/ipd/1?page=1&sort=id&order=asc")
				.then(function (res) {
					expect(res).to.have.status(200);
					expect(res).to.be.json;
					expect(res).to.have.property("body");
					expect(res.body).to.have.property("distances");
					expect(res.body.distances).to.be.an("array");
					expect(res.body.distances).to.have.lengthOf(200);
					for (var i = 0; i < res.body.distances; i += 2) {
						var pair = res.body.distances[i];
						expect(pair).to.have.property("id");
						expect(pair).to.have.property("d");
						expect(pair.d).to.equal(10);
						expect(pair.id).to.equal(i+1);
					}
				});
		});

		// some fail condition checking (again not exhaustive)
		it("should fail if playerID is not an int", function() {
			return expectError(app, 400, "/ipd/foo");
		});

		it("should fail if playerID is zero", function() {
			return expectError(app, 400, "/ipd/0");
		});

		it("should fail if playerID is < zero", function() {
			return expectError(app, 400, "/ipd/-1");
		});

		it("should fail if page is not an int", function() {
			return expectError(app, 400, "/ipd/1?page=foo");
		});

		it("should fail if page is zero", function() {
			return expectError(app, 400, "/ipd/1?page=0");
		});

		it("should fail if page is < zero", function() {
			return expectError(app, 400, "/ipd/1?page=-1");
		});

		it("should fail if sort is invalid", function() {
			return expectError(app, 400, "/ipd/1?sort=foo");
		});

		it("should fail if order is invalid", function() {
			return expectError(app, 400, "/ipd/1?order=foo");
		});
	});

	describe("POST /ipd/<playerId>/add", function() {
		beforeEach(function () {
			return createDB().table("ipds").del();
		});

		it("should be able to add a pair", function() {
			return chai.request(app)
				.post("/ipd/1/add")
				.send({ id: 1, d: 0 })
				.then(function (res) {
					expect(res).to.have.status(200);
				});
		});

		// some fail condition checking (again not exhaustive)
		it("should fail if playerID is not an int", function() {
			return expectPostError(app, 400, "/ipd/foo/add", { id: 1, d: 0 });
		});

		it("should fail if playerID is zero", function() {
			return expectPostError(app, 400, "/ipd/0/add", { id: 1, d: 0 });
		});

		it("should fail if playerID is < zero", function() {
			return expectPostError(app, 400, "/ipd/-1/add", { id: 1, d: 0 });
		});

		it("should fail if entityID is not an int", function() {
			return expectPostError(app, 400, "/ipd/1/add", { id: "foo", d: 0 });
		});

		it("should fail if entityID is zero", function() {
			return expectPostError(app, 400, "/ipd/1/add", { id: 0, d: 0 });
		});

		it("should fail if entityID is < zero", function() {
			return expectPostError(app, 400, "/ipd/1/add", { id: -1, d: 1 });
		});

		it("should fail if distance is not an int", function() {
			return expectPostError(app, 400, "/ipd/1/add", { id: 1, d: "foo" });
		});

		it("should fail if distance is < zero", function() {
			return expectPostError(app, 400, "/ipd/1/add", { id: 1, d: -1 });
		});

	});

	describe("GET /insights/ipd/<playerID>", function () {
		before(function () {
			return createDB().seed.run();
		});

		after(function () {
			return createDB().table("ipds").del();
		});

		it("should return insights on valid query", function () {
			return chai.request(app)
				.get("/insights/ipd/1")
				.then(function (res) {
					expect(res).to.have.status(200);
					expect(res).to.be.json;
					expect(res).to.have.property("body");

					expect(res.body).to.have.property("stats");
					expect(res.body.stats).to.be.an("object");
					
					for (var entityID in res.body.stats) {
						var stat = res.body.stats[entityID];
						expect(stat).to.have.property("min");
						expect(stat).to.have.property("max");
						expect(stat).to.have.property("mean");
						expect(stat).to.have.property("count");
						expect(stat).to.have.property("variance");

						expect(stat.min).to.equal(10);
						expect(stat.max).to.equal(10);
						expect(stat.mean).to.equal(10);
						expect(stat.count).to.equal(2);
						expect(stat.variance).to.equal(0);
					}
				});
		});

		// some fail condition checking (again not exhaustive)
		it("should fail if playerID is not an int", function() {
			return expectError(app, 400, "/insights/ipd/foo");
		});

		it("should fail if playerID is zero", function() {
			return expectError(app, 400, "/insights/ipd/0");
		});

		it("should fail if playerID is < zero", function() {
			return expectError(app, 400, "/insights/ipd/-1");
		});
	});
});