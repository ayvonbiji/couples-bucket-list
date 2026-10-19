import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKey } from './deviceKey.js';

test('personal link keys split on the last dot', () => {
  assert.deepEqual(parseKey('ayvon.AbC-_123'), { username: 'ayvon', secret: 'AbC-_123' });
  assert.deepEqual(parseKey('Ay.von.s3cret'), { username: 'ay.von', secret: 's3cret' });
  assert.deepEqual(parseKey('aksa'), { username: 'aksa', secret: '' });
});
