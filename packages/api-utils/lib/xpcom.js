/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci, Cr, Cm } = require('chrome');
const { registerFactory, unregisterFactory, isCIDRegistered } =
      Cm.QueryInterface(Ci.nsIComponentRegistrar);

const { when: unload } = require('./unload');
const { Base } = require('./base');
const { uuid } = require('./uuid');

// This is a base prototype, that provides bare bones of XPCOM. JS based
// components can be easily implement by extending it.
const Unknown = Base.extend({
  // Method `extend` is overridden so that resulting object will contain
  // `interfaces` array property, containing elements from ancestor and all
  // provided sources.
  extend: function extend() {
    let args = Array.slice(arguments);
    return Base.extend.apply(this, args.concat([{
      interfaces: args.reduce(function(interfaces, source) {
        // If given source has `interfaces` property concatenate it's elements
        // them resulting `interfaces` array, otherwise return resulting
        // `interfaces` array.
        return 'interfaces' in source ? source.interfaces.concat(interfaces)
                                      : interfaces;
      }, this.interfaces)
    }]));
  },
  /**
   * The `QueryInterface` method provides runtime type discovery used by XPCOM.
   * This method return quired instance of `this` if given `iid` is listed in
   * the `interfaces` property.
   */
  QueryInterface: function QueryInterface(iid) {
    // For some reason there are cases when `iid` is `null`. In such cases we
    // just return `this`. Otherwise we verify that component implements given
    // `iid` interface.
    if (iid && !this.interfaces.some(function(id) iid.equals(Ci[id])))
      throw Cr.NS_ERROR_NO_INTERFACE;
    return this;
  },
  /**
   * Array of `XPCOM` interfaces (as strings) implemented by this component. All
   * components implement `nsISupports` by default which is default value here.
   * Provide array of interfaces implemented by an object when extending, to
   * append them to this list (Please note that there is no need to repeat
   * interfaces implemented by super as they will be added automatically).
   */
  interfaces: [ 'nsISupports' ]
});
exports.Unknown = Unknown;

// This is a base prototype, that provides bare bones of XPCOM Service. JS based
// components can be easily implement by extending it.
const Service = Unknown.extend({
  // Method `extend` is overridden so that resulting object will have unique
  // classID unless provided by an argument.
  extend: function extend() {
    let args = Array.slice(arguments)
    return Unknown.extend.apply(this, args.concat([{
      classID: args.reduce(function(classID, source) {
        return 'classID' in source ? source.classID : classID;
      }, null) || uuid()
    }]));
  },
  /**
   * XPConnect lets you bypass its wrappers and access the underlying JS object
   * directly using the `wrappedJSObject` property if the wrapped object allows
   * this. All Factory descendants expose it's underlying JS objects unless
   * intentionally overridden.
   */
  get wrappedJSObject() this,
  /**
   * Creates an instance of the class associated with this factory.
   */
  createInstance: function createInstance(outer, iid) {
    try {
      if (outer)
        throw Cr.NS_ERROR_NO_AGGREGATION;
      return this.QueryInterface(iid);
    }
    catch (error) {
      throw error instanceof Ci.nsIException ? error : Cr.NS_ERROR_FAILURE;
    }
  },
  // All the descendants will get auto generated `classID` unless one is
  // provided manually.
  classID: null,
  /**
   * The name of the class being registered. This value is intended as a
   * human-readable name for the class and does not needs to be globally unique.
   */
  className: 'Jetpack service',
  /**
   * XPCOM contract id. May be `null` if no needed. Usually string like:
   * '@mozilla.org/jetpack/factory;1'.
   */
  contractID: '@mozilla.org/jetpack/service;1',
  /**
   * If property is `true` XPCOM factory will be unregistered prior to add-on
   * unload.
   */
  classUnregister: true
});
exports.Service = Service;

const Factory = Service.extend({
    // Method `new` is overridden so that factory can be registered prior to
  // first instantiation and unregistered prior to unload.
  new: function create() {
    if (this.classRegister && !(this.contractID in Cc))
      register(this);
    return Unknown.new.apply(this, arguments);
  },
  /**
   * If property is `true` XPCOM factory will be registered prior to first
   * object instantiation.
   */
  classRegister: true,
  // All XPCOM factories implement `nsIFactory` interface.
  interfaces: [ 'nsIFactory' ],
  // All the descendants will get auto generated `classID` unless one is
  // provided manually.
  classID: null,
  /**
   * The name of the class being registered. This value is intended as a
   * human-readable name for the class and does not needs to be globally unique.
   */
  className: 'Jetpack factory',
  /**
   * XPCOM contract id. May be `null` if no needed. Usually string like:
   * '@mozilla.org/jetpack/factory;1'.
   */
  contractID: '@mozilla.org/jetpack/factory;1',
  /**
   * This method is required by `nsIFactory` interfaces, but as in most
   * implementations it does nothing interesting.
   */
  lockFactory: function lockFactory(lock) undefined,
  /**
   * Creates an instance of the class associated with this factory.
   */
  createInstance: function createInstance(outer, iid) {
    return Service.createInstance.call(Object.create(this), outer, iid);
  }
});
exports.Factory = Factory;

function isRegistered({ classID }) isCIDRegistered(classID)
exports.isRegistered = isRegistered;

/**
 * Registers given `factory` object to be used to instantiate a particular class
 * identified by `factory.classID`, and creates an association of class name
 * and `factory.contractID` with the class.
 */
function register(factory) {
  if (Service.isPrototypeOf(factory)) {
    let { classID, className, contractID, classUnregister } = factory;
    registerFactory(classID, className, contractID, factory);
    if (classUnregister)
      unload(unregister.bind(null, factory));
  }
};
exports.register = register;

/**
 * Unregister a factory associated with a particular class identified by
 * `factory.classID`.
 */
function unregister(factory) {
  if (isRegistered(factory))
    unregisterFactory(factory.classID, factory);
};
exports.unregister = unregister;

var autoRegister = exports.autoRegister = function autoRegister(path) {
  // TODO: This assumes that the url points to a directory
  // that contains subdirectories corresponding to OS/ABI and then
  // further subdirectories corresponding to Gecko platform version.
  // we should probably either behave intelligently here or allow
  // the caller to pass-in more options if e.g. there aren't
  // Gecko-specific binaries for a component (which will be the case
  // if only frozen interfaces are used).

  var runtime = require("./runtime");
  var osDirName = runtime.OS + "_" + runtime.XPCOMABI;
  var platformVersion = require("./xul-app").platformVersion.substring(0, 5);

  var file = Cc['@mozilla.org/file/local;1']
             .createInstance(Ci.nsILocalFile);
  file.initWithPath(path);
  file.append(osDirName);
  file.append(platformVersion);

  if (!(file.exists() && file.isDirectory()))
    throw new Error("component not available for OS/ABI " +
                    osDirName + " and platform " + platformVersion);

  Cm.QueryInterface(Ci.nsIComponentRegistrar);
  Cm.autoRegister(file);
};

var getClass = exports.getClass = function getClass(contractID, iid) {
  if (!iid)
    iid = Ci.nsISupports;
  return Cm.getClassObjectByContractID(contractID, iid);
};
