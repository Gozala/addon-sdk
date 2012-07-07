/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var Method = require("./method");

// Method is supported to implemented to take advantage of
// other queue related methods.
var queued = Method();
exports.queued = queued;

// Method returns `true` if given `queue` has queued messages.
var isQueued = Method(function(queue) {
  var messages = queued(queue);
  return messages && messages.length > 0;
});
exports.isQueued = isQueued;

// Method enqueues given `message` into `queue`.
var enqueue = Method(function(queue, message) {
  queued(queue).push(message);
});
exports.enqueue = enqueue;

// Method dequeues and returns `message` that was first queued.
// Once message is dequeued it will no longer be in the queue.
var dequeue = Method(function(queue) {
  return queued(queue).shift();
});
exports.dequeue = dequeue;
