/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Base } = require('../base');
const { EventTarget } = require('../event/target');
const { EventPort } = require('../event/port');
const { ns } = require('../namespace');
const { emit, on, off } = require('../event/core');
const { sandbox, evaluate, load } = require("../sandbox");
const { Ci, Cu, Cc } = require('chrome');
const { setTimeout, setInterval, clearTimeout, clearInterval } = require('../timer');
const { getInnerId } = require('../window-utils');
const { getTabForWindow } = require("../tabs/tab");
const { URL } = require('../url');
const { when: unload } = require('../unload');
const { guid } = require('../guid');
const { merge } = require('../utils/object');
const observers = require('../observer-service');
const self = require("self");

const CONTENT_PROXY_URL = self.data.url("content-proxy.js");
const WEB_CONTENT_DOC = "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>";

const ERR_DESTROYED =
  "The page has been destroyed and can no longer be used.";

let port = ns({
  target: null,
  port: null,
  onMessage: null,
  state: 0
});
let workerScope = ns({
  timers: null,
  window: null,
  sandbox: null
});
let worker = ns({
  state: 0,
  contentScriptFile: null,
  contentScript: null,
  expose_key: null,
  windowID: null
  window: null,
  content: null
});


/**
 * This key is not exported and should only be used for proxy tests.
 * The following `PRIVATE_KEY` is used in addon module scope in order to tell
 * Worker API to expose `UNWRAP_ACCESS_KEY` in content script.
 * This key allows test-content-proxy.js to unwrap proxy with valueOf:
 *   let xpcWrapper = proxyWrapper.valueOf(UNWRAP_ACCESS_KEY);
 */
const PRIVATE_KEY = {};

const EMBRION = 0;
const ALIVE = 1;
const message = 'message-' + guid();

// This is an exemplar implementing post message interface exposed by the
// worker instances.
const Port = EventTarget.extend({
  initialize: function initialize(target) {
    // Store port target into internal property as we still going to access
    // it from the different method.
    port(this).target = target;
    // Create an event port and store it into internal property that will
    // be exposed by public getter.
    port(this).port = EventPort.new(target);

    // Set up a message event listener that will delegate to internal
    // `onMessage` property that can be set via public `onMessage` setter.
    this.on(message, function onMessage(data) {
      let { onMessage } = port(this);
      onMessage.call(this, data);
    });

    // Finally we mark this port as alive, so that public methods / getters /
    // setters will behave accordingly.
    port(this).state ++;
  },
  /*
   * EventEmitter, that behaves (calls listeners) asynchronously.
   * A way to send customized messages to / from the worker.
   * Events from in the worker can be observed / emitted via self.on / self.emit 
   */
  get port() port(this).port,
  /**
   * Legacy message passing API that allows setting a `message` event listener
   * via property set.
   */
  get onMessage() port(this).onMessage,
  set onMessage(onMessage) port(this).onMessage = onMessage,
  /**
   * Sends a message to the worker's global scope. Method takes single
   * argument, which represents data to be sent to the worker. The data may
   * be any primitive type value or `JSON`. Call of this method asynchronously
   * emits `message` event with data value in the global scope of this
   * symbiont.
   *
   * `message` event listeners can be set either by calling
   * `self.on` with a first argument string `"message"` or by
   * implementing `onMessage` function in the global scope of this worker.
   * @param {Number|String|JSON} data
   */
  postMessage: function postMessage(data) {
    if (port(this).state !== ALIVE)
      throw new Error(ERR_DESTROYED);
    else
      port(this).port.emit('message', data);
  }
});

function execute(f, self, params) {
  try {
    f.apply(self, params);
  }
  catch (error) {
    emit(self, 'error', error);
  }

/**
 * Exemplar implementing a workers global scope interface.
 * @see http://www.w3.org/TR/workers/#workerglobalscope
 */
const WorkerScope = Base.extend(EventTarget, Port, {
  // Since `WorkerScope.new` does not actually returns sandboxes instead of
  // `WorkerScope` we override default behavior of `new` with that.
  new: function(options) {
    let window = options.window;
    let proxy = null;
    // Build content proxies if the document has a non-system principal (If
    // window has `wrappedJSObject` it has non-system principal & it was
    // wrapped).
    if (window.wrappedJSObject) {
      // Instantiate the proxy code in another Sandbox in order to prevent
      // content script from polluting globals used by proxy code
      proxy = sandbox(window, { wantXrays: true });
      // Define console for a `content-proxy` debugging purposes.
      proxy.console = console;
      // Execute the proxy code
      load(proxy, CONTENT_PROXY_URL);
    }

    // Create the sandbox with an original `window` in it's prototype chain
    // to provide access to standard globals (window, document, ...).
    let instance = sandbox(window, {
      sandboxPrototype: proxy ? proxy.create(window) : window
      wantXrays: true
    });

    merge(instance, this, {
      new: undefined,
      initialize: undefined
    });

    this.initialize.call(instance, options, proxy);
    return instance;
  },
  initialize: function initialize({ target, window }, proxy) {
    let scope = workerScope(this);

    // Internal alive timers map.
    scope.timers = {};
    // Unwrapped window, with a raw JS access.
    scope.window = window;

    Port.initialize.call(this, target);

    // Internal feature that is only used by SDK tests:
    // Expose unlock key to content script context.
    // See `PRIVATE_KEY` definition for more information.
    if (proxy && worker(target).expose_key)
      this.UNWRAP_ACCESS_KEY = proxy.UNWRAP_ACCESS_KEY;

    // Temporary fix for test-widget, that pass self.postMessage to proxy code
    // that first try to access to `___proxy` and then call it through `apply`.
    // We need to move function given to content script to a sandbox
    // with same principal than the content script.
    // In the meantime, we need to allow such access explicitly
    // by using `__exposedProps__` property, documented here:
    // https://developer.mozilla.org/en/XPConnect_wrappers
    this.postMessage = Object.defineProperties(this.postMessage.bind(this), {
      __exposedProps__: { value: { ___proxy: 'rw', apply: 'rw' } }
    });

    // Inject `addon` global into target document if document is trusted,
    // `addon` in document is equivalent to `self` in content script.
    if (worker._injectInDocument) {
      Object.defineProperty(window.wrappedJSObject || window, "addon", {
        get: function addon() this
      });
    }

    // The order of `contentScriptFile` and `contentScript` evaluation is
    // intentional, so programs can load libraries like jQuery from script URLs
    // and use them in scripts.
    let contentScriptFile = ('contentScriptFile' in worker) ? worker.contentScriptFile
          : null,
        contentScript = ('contentScript' in worker) ? worker.contentScript : null;

    if (contentScriptFile) {
      if (Array.isArray(contentScriptFile))
        this._importScripts.apply(this, contentScriptFile);
      else
        this._importScripts(contentScriptFile);
    }
    if (contentScript) {
      this._evaluate(
        Array.isArray(contentScript) ? contentScript.join(';\n') : contentScript
      );
    }
  },

  /**
   * Alias to the global scope in the context of worker. Similar to
   * `window` concept.
   */
  get self() this,
  // We need "this === window === top" to be true in toplevel scope:
  get window() this,
  get top() this,
  // Use the Greasemonkey naming convention to provide access to the
  // unwrapped window object so the content script can access document
  // JavaScript values.
  // NOTE: this functionality is experimental and may change or go away
  // at any time!
  get unsafeWindow() workerScope(this).window.wrappedJSObject,

  console: console,

  // Override few deprecated methods to log appropriate warnings.
  set onMessage(value) {
    console.warn("The global `onMessage` function in content scripts " +
                 "is deprecated in favor of the `self.on()` function. " +
                 "Replace `onMessage = function (data){}` definitions " +
                 "with calls to `self.on('message', function (data){})`. " +
                 "For more info on `self.on`, see " + WEB_CONTENT_DOC_LINK);
    port(this).onMessage = onMessage;
  },
  // Deprecated use of on/postMessage from globals
  postMessage: function postMessage() {
    console.warn("The global `postMessage()` function in content " +
                 "scripts is deprecated in favor of the " +
                 "`self.postMessage()` function, which works the same. " +
                 "Replace calls to `postMessage()` with calls to " +
                 "`self.postMessage()`." +
                 "For more info on `self.on`, see " + WEB_CONTENT_DOC_LINK);
    Port.postMessage.apply(this, arguments);
  },
  on: function on() {
    console.warn("The global `on()` function in content scripts is " +
                 "deprecated in favor of the `self.on()` function, " +
                 "which works the same. Replace calls to `on()` with " +
                 "calls to `self.on()`" +
                 "For more info on `self.on`, see " + WEB_CONTENT_DOC_LINK);
    Port.on.apply(this, arguments);
  },

  // wrapped functions from `'timer'` module.
  // Wrapper adds `try catch` blocks to the callbacks in order to
  // emit `error` event on a symbiont if exception is thrown in
  // the Worker global scope.
  // @see http://www.w3.org/TR/workers/#workerutils
  setTimeout: function(callback, delay) {
    let { timers } = worker(this);
    let rest = Array.slice(arguments, 2);
    let id = setTimeout(function(self) {
      try {
        delete timers[id];
        callback.apply(null, rest);
      } catch(error) {
        setTimeout(emits, 0, self, 'error', error);
      }
    }, delay, this);
    timers[id] = true;
    return id;
  },
  clearTimeout: function(id){
    delete worker(this).timers[id];
    return clearTimeout(id);
  },
  setInterval: function(callback, delay) {
    let { timers } = worker(this);
    let rest = Array.slice(arguments, 2);
    let id = setInterval(function(self) {
      try {
        callback.apply(null, params); 
      } catch(e) {
        setTimeout(emit, 0, self, 'error', error);
      }
    }, delay, this);
    timers[id] = true;
    return id;
  },
  clearInterval: function clearInterval(id) {
    delete worker(this).timers[id];
    return clearInterval(id);
  },

  _destructor: function _destructor() {
    this._removeAllListeners();
    // Unregister all setTimeout/setInterval
    // We can use `clearTimeout` for both setTimeout/setInterval
    // as internal implementation of timer module use same method for both.
    for (let id in this._timers)
      timer.clearTimeout(id);
    this._sandbox = null;
    this._addonWorker = null;
    this.__onMessage = undefined;
  }
});

/**
 * Message-passing facility for communication between code running
 * in the content and add-on process.
 * @see https://jetpack.mozillalabs.com/sdk/latest/docs/#module/api-utils/content/worker
 */
const Worker = Port.extend({
  initialize: function initialize(options) {
    let model = worker(this);
    // copy window, contentScriptFile, contentScript into model.
    merge(model, options);
    // Set up an event listeners for `onError, onMessage, onDetach`.
    EventTarget.initialize.call(this, options);

    model.expose_key = ('exposeUnlockKey' in options &&
                        options.exposeUnlockKey === PRIVATE_KEY);

    // Track document unload to destroy this worker.
    // We can't watch for unload event on page's window object as it 
    // prevents bfcache from working: 
    // https://developer.mozilla.org/En/Working_with_BFCache
    model.windowID = getInnerId(worker(this).window);

    once(destroy, model.windowID, this.detach.bind(this));

    unload(worker.destroy.bind(worker));

    let content = WorkerScope.new({ target: this, window: window });
    Port.initialize.call(this, content);

    // Connect port to the worker scopes 
    pipe(this.port, content.port);
    open(content.port);
    open(this.port);
  },
  // TODO: should we throw if content is destroyed ?

  get url() {
    let { window } = worker(this);
    return window ? window.document.location.href : null;
  },
  get tab() {
    let { window } = worker(this);
    return window ? getTabForWindow(window) : null;
  },

  /**
   * Tells content worker to unload itself and 
   * removes all the references from itself.
   */
  destroy: function destroy() {
    off(this); // should this be a `EventTarget.destroy` ?
    off(this.port);
    this._workerCleanup();
  },

  /**
   *
   */
  detach: function detach() {
    let model = worker(this);
    // Remove port to the content and flush all the pending events.
    pipe(this.port, null);
    flush(this.port);

    // Clean up all the properties.
    worker.content = null;
    worker.window = null;
    worker.windowID = null;
    emit(this, 'detach');
  },

  /**
   * Flag to enable `addon` object injection in document. (bug 612726)
   * @type {Boolean}
   */
  _injectInDocument: false
});
exports.Worker = Worker;
