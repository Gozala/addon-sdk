/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

let { emit, on, off } = require("./core");

// This module provides set of high order function for working with event
// streams (streams in a NodeJS style that dispatch data, end and error
// events).

// High order event transformation function that takes `input` event channel
// and returns transformation containing only events on which `p` predicate
// returns `true`.
function filter(p, input) {
  let output = {};
  on(input, "error", function(error) emit(output, "error", error));
  on(input, "end", function() emit(output, "end"));
  on(input, "data", function($) p($) ? emit(output, "data", $) : null);
  return output;
}
exports.filter = filter;
