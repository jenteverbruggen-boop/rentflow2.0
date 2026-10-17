// Planner without money access: no purchase prices / margins anywhere.
const { leakScan } = require("../perm-scan");
module.exports = (ctx) => leakScan(ctx, "plan");
module.exports.meta = { user: "plan", expectHttp: [403, 404] };
