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
 * Portions created by the Initial Developer are Copyright (C) 2010
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

var Trait = require("light-traits").Trait;
var EventEmitter = require("events").DeferredEventEmitter;

const Model = Trait.compose(EventEmitter, Trait({
  /**
   * A special property of models, the id is an arbitrary string
   * (integer id or UUID). If you set the id in the attributes hash, it will be
   * copied onto the model as a direct property. Models can be retrieved by id
   * from collections, and the id is used to generate model URLs by default.
   */
  //id: Trait.required,
  /**
   * The attributes property is the internal hash containing the model's state.
   * Please use set to update the attributes instead of modifying them
   * directly. If you'd like to retrieve and munge a copy of the model's
   * attributes, use `toJSON` instead.
   */
  attributes: Trait.required,
  /**
   * Consumer must implement custom validation logic in this method. Method is
   * called by a `set`, and is passed the attributes that are about to be
   * updated. If the model and attributes are valid, don't return anything from
   * validate. If the attributes are invalid, throw an Error of your choice. It
   * can be as simple `Error` with an error message to be displayed, or a
   * complete error object that describes the error programmatically. `set` and
   * save will not continue if validate returns an error.
   * Failed validations trigger an "error" event.
   */
  validate: Trait.required,

  isModel: true,
  /**
   * Get the current value of an attribute from the model.
   */
  get: function get(key) {
    return this.attributes[key];
  },
  /**
   * Set a hash of attributes (one or many) on the model. If any of the
   * attributes change the models state, a "change" event will be triggered,
   * unless {silent: true} is passed as an option. Change events for specific
   * attributes are also triggered, and you can bind to those as well, for
   * example change:title, and change:content.
   */
  set: function set(attributes, options) {
    var changes, silent;
    // Validate all the attributes using internal validation mechanism. If
    // new attributes are returned that means that values were formated or
    // overridden by a validator. 
    attributes = this.validate(attributes) || attributes;

    silent = options && options.silent;
    Object.keys(attributes).forEach(function(key) {
      var previous = this.attributes[key];
      var value = this.attributes[key] = attributes[key];
      
      if (!silent && previous !== value) {
        this._emit("change:" + key, ((changes || (changes = {}))[key] = {
          key: key, previous: previous, value: value
        }));
      }
    }, this);

    if (!silent && changes)
      this._emit("change", changes);
  },
  /**
   * Remove an attribute by deleting it from the internal attributes hash.
   * Fires a "change" event unless silent is passed as an option. 
   */
  unset: function unset(attributes, options) {
    var changes, silent;
    
    silent = options && options.silent;
    Object.keys(attributes).forEach(function(key) {
      var previous = this.attributes[key];
      var value = (delete this.attributes[key], this.attributes[key]);
      
      if (!silent && previous !== value) {
        this._emit("change:" + key, ((changes || (changes = {}))[key] = {
          key: key, previous: previous, value: value
        }));
      }
    }, this);

    if (!silent && changes)
      this._emit("change", changes);
  },
  /**
   * Removes all attributes from the model. Fires a "change" event unless
   * silent is passed as an option.
   */
  clear: function clear(options) {
    this.unset(this.attributes, options);
  },
  /**
   * Return a copy of the model's attributes for JSON stringification. This can
   * be used for persistence, serialization, or for augmentation before being
   * handed off to a view. The name of this method is a bit confusing, as it
   * doesn't actually return a JSON string — but I'm afraid that it's the way
   * that the [JavaScript API for JSON.stringify works]
   * (https://developer.mozilla.org/en/JSON#toJSON()_method). 
   */
  toJSON: function toJSON() {
    return this.valueOf();
  },
  valueOf: function valueOf() {
    return JSON.parse(JSON.stringify(this.attributes));
  }
}));
Model.extend = function extend(extension) {
  return Trait.compose(Model, Trait(extension));
};
exports.Model = Model;
