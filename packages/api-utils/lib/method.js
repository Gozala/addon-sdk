/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

var { ns } = require('./namespace');

// Shortcuts for ES5 reflection functions.
var create = Object.create;
var prototypeOf = Object.getPrototypeOf;

// Define a shortcut for `Array.prototype.slice.call`.
var unbind = Function.call.bind(Function.bind, Function.call)
var stringify = unbind(Object.prototype.toString)

var builtins = {};
builtins.Object = create(null);
builtins[stringify(null)] = create(null);
builtins[stringify(undefined)] = create(null);
builtins[stringify(Function.prototype)] = create(builtins.Object);
builtins[stringify(Array.prototype)] = create(builtins.Object);
builtins[stringify(String.prototype)] = create(builtins.Object);
builtins[stringify(RegExp.prototype)] = create(builtins.Object);
builtins[stringify(Date.prototype)] = create(builtins.Object);
builtins[stringify(Number.prototype)] = create(builtins.Object);
builtins[stringify(Boolean.prototype)] = create(builtins.Object);

/**
 * Private Method is a callable private name that dispatches on the first
 * arguments same named Method: Method(...rest) => rest[0][Method](...rest)
 * Default implementation may be passed in as an argument.
 **/
function Method(base) {
  var methods = ns();

  function dispatch() {
    // Method dispatches on type of the first argument.
    var target = arguments[0];
    // If first argument is `null` or `undefined` use associated property
    // maps for implementation lookups, otherwise use first argument itself.
    // Use default implementation lookup map if first argument does not
    // implements Method itself.
    var builtin = builtins[stringify(target)]
    var method = builtin ? methods(builtin).method
                         : methods(target).method ||
                           prototypeOf(target) !== null && methods(builtins.Object).method;

    var implementation = method || methods(Default).method;

    // If implementation not found there's not much we can do about it,
    // throw error with a descriptive message.
    if (!implementation)
      throw Error('Type does not implements Method');

    // If implementation is found delegate to it.
    return implementation.apply(implementation, arguments);
  }

  // Define default implementation.
  methods(Default).method = base;

  // Copy utility Methods for convenient API.
  dispatch.implement = implementMethod;
  dispatch.define = defineMethod;
  dispatch.methods = methods;

  return dispatch;
}

/**
 * Implements `Method` for the given `object` with a provided `implementation`.
 * Calling `Method` with `object` as a first argument will dispatch on provided
 * implementation.
 **/
function implement(object, method, implementation) {
  var target = builtins[stringify(object)] ||
               (null === prototypeOf(object) ? builtins.Object : object);

  method.methods(target).method = implementation;
  return object;
}

/**
 * Defines `Method` for the given `Type` with a provided `implementation`.
 * Calling `Method` with a first argument of this `Type` will dispatch on
 * provided `implementation`. If `Type` is a `Method` default implementation
 * is defined. If `Type` is a `null` or `undefined` `Method` is implemented
 * for that value type.
 **/
function define(Type, method, implementation) {
  return implement(Type && Type.prototype, method, implementation);
}

Method.prototype = create(create(null), {
  toString: { value: Object.prototype.toString },
  valueOf: { value: Object.prototype.valueOf },
  define: { value: function(Type, implementation) {
    return define(Type, this, implementation);
  }},
  implement: { value: function(object, implementation) {
    return implement(object, this, implementation);
  }}
});

// Define objects where Methods implementations for `null`, `undefined` and
// defaults will be stored. Note that we create these objects from `null`,
// otherwise implementation from `Object` would have being inherited. Also
// notice that `Default` implementations are stored on `Method.prototype` this
// provides convenient way for defining default implementations.
var Default = Method.prototype;

// Create Method shortcuts as for a faster access.
var defineMethod = Default.define;
var implementMethod = Default.implement;

// Define exports on `Method` as it's only thing we export.
Method.implement = implement;
Method.define = define;
Method.Method = Method;

module.exports = Method;
