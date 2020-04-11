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
      setAttrs(finalAttrs, { silent: true }, callback);
    });
  }
}
const attributeHandler = {
  get: function (target, name) {
    return target.getAttr(name);
  },
  set: function (target, name, value) {
    target.setAttr(name, value);
    return true;
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
function register(attrs, callback, handlerName) {
  if (typeof attrs == "string") attrs = [attrs];

  console.log(`Registering ${handlerName ? `'${handlerName}'` : "handler"} for attributes: ${attrs.join(", ")}`);
  on(attrs.map((x) => `change:${x}`).join(" "), (event) => {
    console.log(`Triggering ${handlerName ? `'${handlerName}'` : "handler"} for attribute: ${event.sourceAttribute}.`);
    callback(event);
  });
}
function registerOpened(callback, handlerName) {
  console.log(`Registering ${handlerName ? `'${handlerName}'` : "handler"} for sheet opening.`);
  on("sheet:opened", () => {
    console.log(`Triggering ${handlerName ? `'${handlerName}'` : "handler"} for sheet opening.`);
    callback();
  });
}
function registerButton(buttonName, callback, handlerName) {
  console.log(`Registering ${handlerName ? `'${handlerName}'` : "handler"} for button: ${buttonName}}.`);
  const throttledFunction = _.throttle(
    (event) => {
      console.log(`Triggering ${handlerName ? `'${handlerName}'` : "handler"} for button: ${buttonName}}.`);
      callback(event);
    },
    200,
    { trailing: false }
  );
  on(`clicked:${buttonName}`, throttledFunction);
}

/* Constants */
const kSheetVersion = "1.0";
const kBrace = "&" + "#125" + ";";
const kDoubleBrace = kBrace + kBrace;
const kExtraEpithetField = "boons_4_check_1";
const kPathosGivesTwoDiceField = "boons_6_check_1";
const kDomains = [
  "arts_oration",
  "blood_valor",
  "craft_reason",
  "resolve_spirit",
];

function query(question, options) {
  return `?{${getTranslation(question)}|${options.join('|')}}`;
}

function setEpithetQuery(attrs) {
  const kNameDice = "roll=[[{@{name_die}[@{name_translated}]";
  const epithet_options = [
    `${getTranslation("none")},${kNameDice}`,
    `@{epithet},epithet=@{epithet}${kDoubleBrace} {{${kNameDice} + @{epithet_die}[${getTranslation("epithet")}]`,
  ];
  if (attrs[kExtraEpithetField] === "1") {
    epithet_options.push(...[
      `@{epithet_2},epithet=@{epithet_2}${kDoubleBrace} {{${kNameDice} + @{epithet_die}[${getTranslation("epithet")}]`,
      `@{epithet} ${getTranslation("and")} @{epithet_2},epithet=@{epithet} ${getTranslation("and")} @{epithet_2}${kDoubleBrace} {{${kNameDice} + 2@{epithet_die}[${getTranslation("epithet")}]`,
    ])
  }
  attrs["epithet_and_name_query"] = query("epithet_dice_query", epithet_options);
}

function setupDomainQueries(attrs) {
  const multiplier = attrs[kPathosGivesTwoDiceField] === "1" ? "2" : "";
  kDomains.forEach(domain => {
    const query_entries = [
      `${getTranslation("no")}, `,
      ...kDomains
        .filter(other => other != domain)
        .map(other => `${getTranslation(other)}, + ${multiplier}@{${other}_die}[${getTranslation(other)}]`)
    ];
    attrs[`${domain}_extra_domain_query`] = query("add_domain_spend_pathos", query_entries);
    attrs[`${domain}_translated`] = getTranslation(domain);
  });
}

register(kPathosGivesTwoDiceField, function () {
  getSetAttrs([kPathosGivesTwoDiceField], setupDomainQueries);
}, "Handle giving two dice for extra domain");

register(kExtraEpithetField, function () {
  getSetAttrs([kExtraEpithetField], setEpithetQuery);
}, "Handle adding or removing an extra epithet");

registerOpened(function () {
  getSetAttrs([kExtraEpithetField, kPathosGivesTwoDiceField], function (attrs, setter) {
    setter.setAttrs({
      "advantage_bond_support_translated": getTranslation("advantage_bond_support"),
      "bonusdice_query": query("bonusdice_query", [0]),
      "divine_favor_query": query("spend_divine_favor", [0]),
      "divine_favor_translated": getTranslation("divine_favor"),
      "name_translated": getTranslation("name"),
      "target_query": query("target_number", [0]),
      "version": kSheetVersion,
    });
    setEpithetQuery(attrs);
    setupDomainQueries(attrs);
  });
}, "Handle setting default attributes when opening the sheet");