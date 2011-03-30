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
var Model = require("./model").Model;
var utils = require("type");
var isUndefined = utils.isUndefined;
var isFunction = utils.isFunction;
var isNumber = utils.isNumber;

exports.Record = Model.extend({
  validate: function validate(attributes) {
    var values = {};
    Object.keys(attributes).forEach(function(key) {
      var field = this[key];
      if (field) {
        if (field.prototype instanceof Model)
          values[key] = Model(attributes[key]);
        else
          values[key] = field(attributes[key], key);
      }
      else
        throw new Error("Record does not defines field '" + key + "'");
    }, this);
    return values;
  }
});

/*

var guards = require("guards");
var Record = require("mvc/record").Record;
var PointModel = Record.extend({
  x: guards.Number({ defaults: 0 }),
  y: guards.Number({ defaults: 0 })
});

var SegmentModel = Record.extend({
  start: PointModel,
  end: PointModel,
  opacity: guards.Number({ defaults: 0 })
});


var segment = SegmentModel({
  start: { x: 0, y: 0 },
  end: { x: 10, y: 17 },
  opacity: 29
});
*/
