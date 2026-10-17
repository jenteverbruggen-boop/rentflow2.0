// Freelancer (scope own): no money, no other-project names, no supplier names.
const { leakScan } = require("../perm-scan");
module.exports = (ctx) => leakScan(ctx, "free");
module.exports.meta = { user: "free", expectHttp: [403, 404] };
