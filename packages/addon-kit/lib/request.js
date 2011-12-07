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
 *   Paul O’Shannessy <paul@oshannessy.com> (Original Author)
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

const { Base, Class } = require("api-utils/base");
let { Namespace } = require("api-utils/namespace");
const { XMLHttpRequest } = require("api-utils/xhr");
const errors = require("api-utils/errors");
const apiUtils = require("api-utils/api-utils");

let internals = Namespace();

// Ugly but will fix with: https://bugzilla.mozilla.org/show_bug.cgi?id=596248
const EventEmitter = require('api-utils/events').EventEmitter.compose({
  constructor: function EventEmitter() this
});

// Instead of creating a new validator for each request, just make one and
// reuse it.
const validator = new OptionsValidator({
  url: {
    //XXXzpao should probably verify that url is a valid url as well
    is:  ["string"]
  },
  headers: {
    map: function (v) v || {},
    is:  ["object"],
  },
  content: {
    map: function (v) v || null,
    is:  ["string", "object", "null"],
  },
  contentType: {
    map: function (v) v || "application/x-www-form-urlencoded",
    is:  ["string"],
  },
  overrideMimeType: {
    map: function(v) v || null,
    is: ["string", "null"],
  }
});
const validate = validator.validateSingleOption.bind(validator);

const REUSE_ERROR = "This request object has been used already. You must " +
                    "create a new one to make a new request."

function send(request, mode) {
  let { events, url, headers, content, contentType,
        overrideMimeType } = internals(request);

  // If this request has already been used, then we can't reuse it.
  // Throw an error.
  if (request.response)
    throw new Error(REUSE_ERROR);

  let xhr = new XMLHttpRequest();
  // Build the data to be set. For GET requests, we want to append that to
  // the URL before opening the request.
  let data = makeQueryString(content);

  // If the URL already has ? in it, then we want to just use &
  if (mode == "GET" && data)
    url = url + (/\?/.test(url) ? "&" : "?") + data;

  // open the request
  xhr.open(mode, url);

  // request header must be set after open, but before send
  xhr.setRequestHeader("Content-Type", contentType);

  // set other headers
  Object.keys(headers).forEach(function(name) {
    xhr.setRequestHeader(name, headers[name]);
  });

  // set overrideMimeType
  if (overrideMimeType)
    xhr.overrideMimeType(overrideMimeType);

  // handle the readystate, create the response, and call the callback
  xhr.onreadystatechange = function onStateChange() {
    if (xhr.readyState === 4) {
      let response = internals(request).response = Response.new(xhr);
      events._emit('complete', response);
    }
  };

  // actually send the request. we only want to send data on POST requests
  xhr.send(mode === "POST" ? data : null);
}

const Request = Base.extend({
  initialize: function initialize(options) {
    let request = internals(this);
    let events = request.events = EventEmitter();
    if ('onComplete' in options)
      events.on('complete', options.onComplete);

    let { url, headers, content, contentType, overrideMimeType } =
      validator.validateOptions(options);

    request.overrideMimeType = overrideMimeType;
    request.url = url;
    request.headers = headers;
    request.content = content;
    request.contentType = contentType;
    request.response = null;
  },
  get url() internals(this).url,
  set url(value) internals(this).url = validate('url', value),
  get headers() internals(this).headers,
  set headers(value) internals(this).url = validate('headers', value),
  get content() internals(this).content,
  set content(value) internals(this).content = validate('content', value),
  get contentType() internals(this).contentType,
  set contentType(value)
    internals(this).contentType = validate('contentType', value),
  get response() internals(this).response,
  get: function get() {
    send(this, 'GET');
    return this;
  },
  post: function post() {
    send(this, 'POST');
    return this;
  }
});
exports.Request = Class(Request);

// Converts an object of unordered key-vals to a string that can be passed
// as part of a request
function makeQueryString(content) {
  // Explicitly return null if we have null, and empty string, or empty object.
  if (!content) {
    return null;
  }

  // If content is already a string, just return it as is.
  if (typeof(content) == "string") {
    return content;
  }

  // At this point we have a k:v object. Iterate over it and encode each value.
  // Arrays and nested objects will get encoded as needed. For example...
  //
  //   { foo: [1, 2, { omg: "bbq", "all your base!": "are belong to us" }], bar: "baz" }
  //
  // will be encoded as
  //
  //   foo[0]=1&foo[1]=2&foo[2][omg]=bbq&foo[2][all+your+base!]=are+belong+to+us&bar=baz
  //
  // Keys (including "[" and "]") and values will be encoded with
  // fixedEncodeURIComponent before returning.
  //
  // Execution was inspired by jQuery, but some details have changed and numeric
  // array keys are included (whereas they are not in jQuery).

  let encodedContent = [];
  function add(key, val) {
    encodedContent.push(fixedEncodeURIComponent(key) + "=" +
                        fixedEncodeURIComponent(val));
  }

  function make(key, val) {
    if (typeof(val) === "object" && val !== null) {
      for ([k, v] in Iterator(val)) {
        make(key + "[" + k + "]", v);
      }
    }
    else {
      add(key, val)
    }
  }
  for ([k, v] in Iterator(content)) {
    make(k, v);
  }
  return encodedContent.join("&");

  //XXXzpao In theory, we can just use a FormData object on 1.9.3, but I had
  //        trouble getting that working. It would also be nice to stay
  //        backwards-compat as long as possible. Keeping this in for now...
  // let formData = Cc["@mozilla.org/files/formdata;1"].
  //                createInstance(Ci.nsIDOMFormData);
  // for ([k, v] in Iterator(content)) {
  //   formData.append(k, v);
  // }
  // return formData;
}


// encodes a string safely for application/x-www-form-urlencoded
// adheres to RFC 3986
// see https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Functions/encodeURIComponent
function fixedEncodeURIComponent (str) {
  return encodeURIComponent(str).replace(/%20/g, "+").replace(/!/g, "%21").
                                 replace(/'/g, "%27").replace(/\(/g, "%28").
                                 replace(/\)/g, "%29").replace(/\*/g, "%2A");
}

const Response = Base.extend({
  initialize: function initialize(request) {
    internals(this).request = request;
  },
  get text() internals(this).request.responseText,
  get xml() {
    throw new Error("Sorry, the 'xml' property is no longer available. " +
                    "see bug 611042 for more information.");
  },
  get status() internals(this).request.status,
  get statusText() internals(this).request.statusText,
  get json() {
    try {
      return JSON.parse(this.text);
    } catch(error) {
      return null;
    }
  },
  get headers() {
    let headers = {}, lastKey;
    // Since getAllResponseHeaders() will return null if there are no headers,
    // defend against it by defaulting to ""
    let rawHeaders = internals(this).request.getAllResponseHeaders() || "";
    rawHeaders.split("\n").forEach(function (h) {
      // According to the HTTP spec, the header string is terminated by an empty
      // line, so we can just skip it.
      if (!h.length) {
        return;
      }

      let index = h.indexOf(":");
      // The spec allows for leading spaces, so instead of assuming a single
      // leading space, just trim the values.
      let key = h.substring(0, index).trim(),
          val = h.substring(index + 1).trim();

      // For empty keys, that means that the header value spanned multiple lines.
      // In that case we should append the value to the value of lastKey with a
      // new line. We'll assume lastKey will be set because there should never
      // be an empty key on the first pass.
      if (key) {
        headers[key] = val;
        lastKey = key;
      }
      else {
        headers[lastKey] += "\n" + val;
      }
    });
    return headers;
  }
});

// apiUtils.validateOptions doesn't give the ability to easily validate single
// options, so this is a wrapper that provides that ability.
function OptionsValidator(rules) {
  this.rules = rules;

  this.validateOptions = function (options) {
    return apiUtils.validateOptions(options, this.rules);
  }

  this.validateSingleOption = function (field, value) {
    // We need to create a single rule object from our listed rules. To avoid
    // JavaScript String warnings, check for the field & default to an empty object.
    let singleRule = {};
    if (field in this.rules) {
      singleRule[field] = this.rules[field];
    }
    let singleOption = {};
    singleOption[field] = value;
    // This should throw if it's invalid, which will bubble up & out.
    return apiUtils.validateOptions(singleOption, singleRule)[field];
  }
}
