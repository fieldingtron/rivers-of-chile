export default function handler(req, res) {
  const rivers = require('../../cache/data').rivers
  const results = rivers.filter(river=> river.content.toLowerCase().indexOf(req.query.q) != -1)
  const ret = JSON.stringify(results)
  res.status(200).json(ret)
}