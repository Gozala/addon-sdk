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

exports.Collection = Trait.compose(EventEmitter, Trait({
  model: Trait.required,              // TabModel
  attributes: Trait.required,         // {}
  models: Trait.required,             // []
  length: 0,
  add: function add(models, options) {
    options = options || {};
    emit = this._boundedEmit || (this._boundedEmit = this._emit.bind(this));
    models = Array.isArray(models) ? models : [ models ];

    models.forEach(function(model) {
      model = this.model.create('toJSON' in model ? model.toJSON() : model);
      model.collection = this;

      this._add(model, options);

      model.on("change", emit);

      if (!options.silent)
        emit("add", model);

    }, this);
  },
  remove: function remove(models, options) {
    options = options || {};
    emit = this._boundedEmit || (this._boundedEmit = this._emit.bind(this));
    models = Array.isArray(models) ? models : [ models ];

    models.forEach(function(model) {
      this._remove(model, options);

      model.removeListener("change", emit);

      if (!options.silent)
        emit("remove", model);
    }, this);
  },
  _add: function _add(model, options) {
    var id = this.model.id;
    // If model is already in the collection
    if (this.has(model))
      throw new Error("Can't add model to a set twice: " + model[id]);

    this.attributes[id] = model;
    this.models.push(model);
    this.length ++;
  },
  _remove: function _remove(model, options) {
    var id = this.model.id;
    if (this.has(model)) {
      delete this.attributes[id];
      this.models.splice(this.models.indexOf(model), 1);
      this.length --;
    }
  },
  has: function has(model) {
    return !!this.get(model[this.model.id] || model);
  },
  get: function get(id) {
    return this.attributes[id];
  },
  at: function at(index) {
    return this.models[index];
  }
}));
