/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

const { events } = require("../window/events");
const { filter } = require("../event/utils");
const { isBrowser } = require("../window/utils");

// TODO: At the moment no open windows will get through since our `isBrowser`
// predicate works only on loaded windows. Maybe that can be fixed in a future.
exports.events = filter(function({target}) isBrowser(target), events);
