const sum = require('../utils/sum');
// https://jestjs.io/docs/expect#tomatchobjectobject
test('adds 1 + 2 to equal 3', () => {
  expect(sum(1, 2)).toBe(3);
});