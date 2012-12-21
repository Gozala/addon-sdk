/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};


let { Class } = require("./heritage");
let { on, off } = require('../system/events');
let unloadSubject = require('@loader/unload');

let disposables = WeakMap();

function initialize(instance) {
  // Create an event handler that will dispose instance on unload.
  function handler(event) {
    if (event.subject.wrappedJSObject === unloadSubject) {
      dispose(instance);
      instance.dispose();
    }
  }

  // Save instance to handler association in the weak map and register
  // listener for unload event via weak reference, this will make sure
  // that disposables with no refecences will be GC-ed and no disposal
  // will be initiated at unload.
  disposables.set(instance, handler);
  on("sdk:loader:destroy", handler);
}
exports.initialize = initialize;

function dispose(instance) {
  // Disposes given instance by removing it from weak map so that handler can
  // be GC-ed even if references to instance are kept. Also unregister unload
  // handler.

  let handler = disposables.get(instance);
  if (handler) off("sdk:loader:destroy", handler);
  disposables.delete(instance);
}
exports.dispose = dispose;

// Base type that takes care of disposing it's instances on add-on unload.
// Also makes sure to remove unload listener if it's already being disposed.
let Disposable = Class({
  initialize: function setupDisposable() {
    this.setup.apply(this, arguments);
    initialize(this);
  },
  setup: function setup() {
    // Implement your initialize logic here.
  },
  dispose: function dispose() {
    // Implement your cleanup logic here.
  },

  destroy: function destroy() {
    // Destroying disposable removes unload handler so that attempt to dispose
    // won't be made at unload & delegates to dispose.
    dispose(this);
    this.dispose();
  }
});

exports.Disposable = Disposable;
