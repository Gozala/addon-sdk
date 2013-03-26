/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { on, emit } = require("sdk/event/core");
const { filter } = require("sdk/event/utils");

function isEven(x) !(x % 2)

exports["test filter events"] = function(assert) {
  let input = {};
  let evens = filter(isEven, input);
  let actual = [];
  on(evens, "data", function(e) actual.push(e));

  [1, 2, 3, 4, 5, 6, 7].forEach(function(x) emit(input, "data", x));

  assert.deepEqual(actual, [2, 4, 6], "only even numbers passed through");
};

require('test').run(exports);
