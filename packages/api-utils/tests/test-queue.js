/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

let { isQueued, queued, enqueue, dequeue } = require("api-utils/queue");

exports['test queue methods throws'] = function(assert) {
  assert.throws(function() {
    queued({});
  }, /not implement/i, 'queued throws if not implemented');

  assert.throws(function() {
    isQueued({});
  }, /not implement/i, 'isQueued throws if `queued` is not implemented');

  assert.throws(function() {
    enqueue({});
  }, /not implement/i, 'isQueued throws if `queued` is not implemented');

  assert.throws(function() {
    dequeue({});
  }, /not implement/i, 'isQueued throws if `queued` is not implemented');
};

exports['test queue methods throws'] = function(assert) {
  var queue = { queued: [] };
  queued.implement(queue, function(queue) { return queue.queued; });

  assert.equal(isQueued(queue), false, "has no messages in a queue");
  enqueue(queue, 1);

  assert.equal(isQueued(queue), true, "has messages in a queue");

  enqueue(queue, 2);

  assert.equal(dequeue(queue), 1, "dequeues first item");
  assert.equal(isQueued(queue), true, "has messages in a queue");
  assert.equal(dequeue(queue), 2, "dequeues first item");

  assert.equal(isQueued(queue), false, "has no messages in a queue");
};



require('test').run(exports)
