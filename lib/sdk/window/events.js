/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Ci } = require("chrome");
const events = require("../system/events");
const { on, off, emit } = require("../event/core");
const { windows } = require("../window/utils");

// Defining event channels on which appropriate events will be dispatched.
const channel = {};
exports.events = channel;

const topics = {
  domwindowopened: "open",
  domwindowclosed: "close",
}

function nsIDOMWindow($) $.QueryInterface(Ci.nsIDOMWindow);

// called every time window is opened. Function registers other event
// observers and also forwards open event to a channel.
function onOpen(event) {
  observe(nsIDOMWindow(event.subject));
  dispatch(event);
}

// Function registers single shot event listeners for relevant window events
// in order to forward them to a channel.
function observe(window) {
  function listener(event) {
    if (event.target === window.document) {
      window.removeEventListener(event.type, listener, true);
      emit(channel, "data", { type: event.type, target: window });
    }
  }
  window.addEventListener("DOMContentLoaded", listener, true);
  window.addEventListener("load", listener, true);
}

// Utility function that takes system notification and forwards it to a
// channel.
function dispatch({ type, subject }) {
  emit(channel, "data", {
    topic: type,
    type: topics[type],
    target: nsIDOMWindow(subject)
  });
}

// Observe all windows that are already opened.
let opened = windows(null, { includePrivate: true });
opened.forEach(observe);

// Forward events that platform emits.
events.on("domwindowopened", onOpen);
events.on("domwindowclosed", dispatch);
