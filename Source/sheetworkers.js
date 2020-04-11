/* global on, setAttrs, getAttrs, getSectionIDs, getTranslationByKey,
   generateRowID, removeRepeatingRow, _ */

"use strict";

function boolToFlag(v) {
  return v ? "1" : "0";
}

function getTranslation(key) {
  return getTranslationByKey(key) || `TRANSLATION_KEY_UNDEFINED: ${key}`;
}

// Convenience function that wraps Roll20 functions. Callback will be called with
// an attribute setter proxy, which allows us to get and set function values using
// object syntax. Optionally, a second argument is the setter itself, in order to
// set values en masse.
// Usage:
// getSetAttrs(["foo", "bar"], (attrs, setter) => {
//   attrs["baz"] = attrs["foo"] + attrs["bar"];
//})
class AttributeSetter {
  constructor(attrs) {
    this._sourceAttrs = attrs;
    this._targetAttrs = {};
  }
  setAttr(name, value) {
    this._sourceAttrs[name] = String(value);
    this._targetAttrs[name] = String(value);
  }
  setAttrs(values) {
    for (let key in values) {
      this.setAttr(key, values[key]);
    }
  }
  getAttr(name) {
    return this._sourceAttrs[name];
  }
  finalize(callback) {
    getAttrs(Object.keys(this._targetAttrs), (values) => {
      const finalAttrs = {};
      for (let key in this._targetAttrs) {
        if (this._targetAttrs[key] != values[key])
          finalAttrs[key] = this._targetAttrs[key];
      }
      setAtts(finalAttrs, { silent: true }, callback);
    });
  }
}
const attributeHandler = {
  get: function(target, name) {
    return target.getAttr(name);
  },
  set: function(target, name, value) {
    target.setAttr(name, value);
  }
};
function getSetAttrs(attrs, callback, finalCallback) {
  getAttrs(attrs, (values) => {
    const setter = new AttributeSetter(values);
    callback(new Proxy(setter, attributeHandler), setter);
    setter.finalize(finalCallback);
  });
}


// We define our own wrappers for Roll20 event handlers to provide
// a bit more useful feedback and reduce boilerplate.
function register(attrs, callback) {
  if (typeof attrs == "string") attrs = [attrs];

  console.log(`Registering callback for: ${attrs.join(", ")}`);
  const eventString = attrs.map((x) => `change:${x}`).join(" ");
  on(eventString, (event) => {
    console.log(`Triggering for attribute ${event.sourceAttribute}.`);
    callback(event);
  });
}
function registerOpened(callback) {
  console.log("Registering on sheet opening.");
  on("sheet:opened", () => {
    console.log("Triggering for sheet opening.");
    callback();
  });
}
function registerButton(name, callback) {
  console.log(`Registering for button: ${name}`);
  const throttledFunction = _.throttle(
    (event) => {
      console.log(`Triggering for button: ${name}`);
      callback(event);
    },
    200,
    { trailing: false }
  );
  on(`clicked:${name}`, throttledFunction);
}

const kComma = "&" + "#44" + ";";
const kBrace = "&" + "#125" + ";";
const kDBrace = kBrace + kBrace;

function handleSheetInit() {
  /* Setup and upgrades */
  getAttrs(["version"], (v) => {
    const addVersion = (object, version) => {
      object.version = version;
      object.character_sheet = `Agon v${version}`;
      return object;
    };
    const upgradeSheet = (version) => {
      console.log(`Found version ${version}.`);
      if (version !== sheetVersion) console.log("Performing sheet upgrade.");
      mySetAttrs(addVersion({}, sheetVersion));
    };
  });
}

/* DATA */
const kSheetVersion = "1.0";