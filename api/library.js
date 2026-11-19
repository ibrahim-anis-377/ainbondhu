/* GET /api/library  ->  statute library, issue types, sample cases, and whether live AI is on */
const { library } = require('../lib/agents');

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(library());
};
