
/**
 * Defines inter-personal distance between two players as the euclidian distance rounded to the nearest centimeter
 * @param a 3-vector (i.e., an object with 'x', 'y', and 'z' fields) which is the first person's position in world space in centimeters
 * @param b 3-vector (i.e., an object with 'x', 'y', and 'z' fields) which is the second person's position in world space in centimeters
 * @returns natural number the inter-personal distance between a and b rounded to the nearest centimeter
 * @throws if a or b cannot be used as a vector (is undefined, null, or doesn't have fields as defined above)
 */
module.exports = exports = function (a, b) {
	if (!a || a.x === undefined || a.y === undefined || a.z === undefined)
		throw new Error("parameter 'a' must be an object with fields 'x', 'y', and 'z'");

	if (!b || b.x === undefined || b.y === undefined || b.z === undefined)
		throw new Error("parameter 'b' must be an object with fields 'x', 'y', and 'z'");

	// euclidian distance
	var dX = a.x - b.x;
	var dY = a.y - b.y;
	var dZ = a.z - b.z;
	return Math.round(Math.sqrt(dX * dX + dY * dY + dZ * dZ));
};