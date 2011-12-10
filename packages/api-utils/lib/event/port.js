/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

"use strict";

const { EventTarget } = require('./target');
const { emit } = require('./core');
const { setTimeout } = require('../timer');
let { Namespace } = require('../namespace');

const port = Namespace({ active: false, target: null, events: null });

/**
 * Sets `target` port as an event target of a `source` port. This means that
 * all the messages emitted on `source` will trigger listeners on the `target`.
 * Note that this will connect ports into one way pipe, if you need
 * bidirectional pipe you need to pipe them in both ways.
 */
function pipe(source, target) {
  port(source).target = target;
}
exports.pipe = pipe;

/**
 * Opens given event port. Port must be open to start dispatching events to the
 * target port. If port is not open all the emitted events get queued up,
 * until it's open (Usually port needs to be open after target port is
 * initialized and ready to process events).
 */
function open(source) {
  port(source).open = true;
  flush(source);
}
exports.open = open;

/**
 * Close given event port. After port is closed all events will queued up until
 * it's open again.
 */
function close(source) {
  flush(source);
  port(source).open = false;
}
exports.close = close;

/**
 * Emits all the queued up messages of the given port on it's target. If
 * `source` port has no target this call will be ignored. Most likely you
 * do not need to call this function, let `source.emit` do the job for you.
 */
function flush(source) {
  let events = port(source).events.splice(0);
  let target = port(source).target;
  while (target && events.length)
    emit.apply(null, [ target ].concat(events.shift()));
}
exports.flush = flush;

/**
 * Exemplar event port object. It implements event emitter interface, and
 * allows bidirectional async communication between two such ports.
 * @examples
 *
 *    var port = EventPort.new(targetPort);
 */
const EventPort = EventTarget.extend({
  initialize: function initialize(target) {
    port(this).events = [];
    if (target)
      pipe(this, target);
  },
  emit: function(type, message) {
    let args = Array.slice(arguments);
    // JSON.stringify is buggy with cross-sandbox values,
    // it may return "{}" on functions. Use a replacer to match
    // them correctly.
    let event = JSON.parse(JSON.stringify(args, function(key, value) {
      return typeof(value) === 'function' ? undefined : value;
    }));
    // enqueue this message for a dispatch.
    port(this).events.push(event);

    // If port is active asynchronously flush queued events.
    if (port(this).open)
      setTimeout(flush, 0, this);
  }
});
exports.EventPort = EventPort;
