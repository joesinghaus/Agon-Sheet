/* global on, setAttrs, getAttrs, getSectionIDs, getTranslationByKey,
   generateRowID, removeRepeatingRow, _ */

"use strict";

function boolToFlag(v) {
  return v ? "1" : "0";
}

function getTranslation(key) {
  return getTranslationByKey(key) || `TRANSLATION_KEY_UNDEFINED: ${key}`;
}

function fillRepeatingSectionFromData(sectionName, dataList, setter) {
  const createdIDs = [];
  const setting = dataList
    .map((o) => {
      let rowID;
      while (!rowID) {
        let newID = generateRowID();
        if (!createdIDs.includes(newID)) {
          rowID = newID;
          createdIDs.push(rowID);
        }
      }
      const newAttrs = {};
      return Object.keys(o).reduce((m, key) => {
        m[`repeating_${sectionName}_${rowID}_${key}`] = o[key];
        return m;
      }, newAttrs);
    })
    .forEach((o) => setter.setAttrs(o));
}
function fillEmptyRows(sectionName, n, setter) {
  const data = [...Array(n).keys()].map(() => ({ autogen: "1" }));
  fillRepeatingSectionFromData(sectionName, data, setter);
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
    this._sourceAttrs[name] = value;
    this._targetAttrs[name] = value;
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
        if (String(this._targetAttrs[key]) !== values[key])
          finalAttrs[key] = String(this._targetAttrs[key]);
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
  },
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
function register(attrs, callback, handlerName = "handler") {
  if (typeof attrs == "string") attrs = [attrs];

  console.log(`Registering ${handlerName} for attributes: ${attrs.join(", ")}`);
  on(attrs.map((x) => `change:${x}`).join(" "), (event) => {
    console.log(
      `Triggering ${handlerName} for attribute: ${event.sourceAttribute}.`
    );
    callback(event);
  });
}
function registerOpened(callback, handlerName = "handler") {
  console.log(`Registering ${handlerName} for sheet opening.`);
  on("sheet:opened", () => {
    console.log(`Triggering ${handlerName} for sheet opening.`);
    callback();
  });
}
function registerButton(buttonName, callback, handlerName = "handler") {
  console.log(`Registering ${handlerName} for button: ${buttonName}}.`);
  const throttledFunction = _.throttle(
    (event) => {
      console.log(`Triggering ${handlerName} for button: ${buttonName}}.`);
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
const kSpendDivineFavorBoon = "boons_7_check_1";
const kDomains = [
  "arts_oration",
  "blood_valor",
  "craft_reason",
  "resolve_spirit",
];
const kLabelAttributes = [
  "glory",
  "name",
  "epithet",
  "epithet",
  "epithet",
  "epithet",
  "name",
  "name",
  "lineage_pronouns",
  "lineage_pronouns",
  "honored_god",
  "honored_god",
  "domains",
  "arts_oration",
  "blood_valor",
  "craft_reason",
  "resolve_spirit",
  "divine_favor",
  "authority",
  "zeus",
  "beauty",
  "aphrodite",
  "conviction",
  "demeter",
  "cunning",
  "hera",
  "daring",
  "hermes",
  "ferocity",
  "ares",
  "fortitude",
  "poseidon",
  "ingenuity",
  "hephaistos",
  "insight",
  "hekate",
  "knowledge",
  "apollo",
  "precision",
  "artemis",
  "wisdom",
  "athena",
  "style_notes",
  "recite_your_deeds",
  "recite_top",
  "recite_top",
  "arts_oration",
  "recite_arts_oration",
  "recite_arts_oration",
  "blood_valor",
  "recite_blood_valor",
  "recite_blood_valor",
  "craft_reason",
  "recite_craft_reason",
  "recite_craft_reason",
  "resolve_spirit",
  "recite_resolve_spirit",
  "recite_resolve_spirit",
  "recite_bottom",
  "recite_bottom",
  "pathos",
  "agony",
  "fate",
  "bonds",
  "bond_use_top",
  "bond_use_top",
  "bond_use_1",
  "bond_use_1",
  "bond_use_2",
  "bond_use_2",
  "bond_use_3",
  "bond_use_3",
  "great_deeds_and_trophies",
  "boons",
  "boons_1",
  "boons_1",
  "boons_2",
  "boons_2",
  "boons_3",
  "boons_3",
  "boons_4",
  "boons_4",
  "boons_5",
  "boons_5",
  "boons_6",
  "boons_6",
  "boons_7",
  "boons_7",
  "virtues",
  "acumen",
  "courage",
  "grace",
  "passion",
];

function query(question, options) {
  return `?{${getTranslation(question)}|${options.join("|")}}`;
}

function performFirstTimeSetup(attrs, setter) {
  fillEmptyRows("bonds", 8, setter);
  fillEmptyRows("deeds", 4, setter);
  kLabelAttributes.forEach(name => {
    attrs[`${name}_label`] = getTranslation(name);
  })
}

function setEpithetQuery(attrs) {
  const kNameDice = "roll=[[{@{name_die}[@{name_label}]";
  const epithet_options = [
    `${getTranslation("none")},${kNameDice}`,
    `@{epithet},epithet=@{epithet}${kDoubleBrace} {{${kNameDice} + @{epithet_die}[@{epithet_label}]`,
  ];
  if (attrs[kExtraEpithetField] === "1") {
    const and = getTranslation("and");
    epithet_options.push(
      ...[
        `@{epithet_2},epithet=@{epithet_2}${kDoubleBrace} {{${kNameDice} + @{epithet_die}[@{epithet_label}]`,
        `@{epithet} ${and} @{epithet_2},epithet=@{epithet} ${and} @{epithet_2}${kDoubleBrace} {{${kNameDice} + 2@{epithet_die}[@{epithet_label}]`,
      ]
    );
  }
  attrs["epithet_and_name_query"] = query(
    "epithet_dice_query",
    epithet_options
  );
}

function setupDomainQueries(attrs) {
  const multiplier = attrs[kPathosGivesTwoDiceField] === "1" ? "2" : "";
  kDomains.forEach((domain) => {
    const query_entries = [
      `${getTranslation("no")}, `,
      ...kDomains
        .filter((other) => other != domain)
        .map(
          (other) =>
            `${getTranslation(
              other
            )}, + ${multiplier}@{${other}_die}[${getTranslation(other)}]`
        ),
    ];
    attrs[`${domain}_extra_domain_query`] = query(
      "add_domain_spend_pathos",
      query_entries
    );
    attrs[`${domain}_translated`] = getTranslation(domain);
  });
}

function setupDivineFavorQuery(attrs) {
  const base_query = query("spend_divine_favor", [0]);
  if (attrs[kSpendDivineFavorBoon] === "1") {
    attrs["divine_favor_query"] = `[[${base_query} + 2*{${base_query},1}kl1]]`;
  } else {
    attrs["divine_favor_query"] = base_query;
  }
}

register(
  kPathosGivesTwoDiceField,
  function () {
    getSetAttrs([kPathosGivesTwoDiceField], setupDomainQueries);
  },
  "Handle giving two dice for extra domain"
);

register(
  kExtraEpithetField,
  function () {
    getSetAttrs([kExtraEpithetField], setEpithetQuery);
  },
  "Handle adding or removing an extra epithet"
);

register(
  kSpendDivineFavorBoon,
  function () {
    getSetAttrs([kSpendDivineFavorBoon], setupDivineFavorQuery);
  },
  "Handle boon for getting +2d4 on spending divine favor"
)

registerOpened(function () {
  getSetAttrs(
    [kExtraEpithetField, kPathosGivesTwoDiceField, kSpendDivineFavorBoon, "version"],
    function (attrs, setter) {
      if (!attrs["version"]) performFirstTimeSetup(attrs, setter);

      setter.setAttrs({
        advantage_bond_support_translated: getTranslation(
          "advantage_bond_support"
        ),
        bonusdice_query: query("bonusdice_query", [0]),
        target_query: query("target_number", [0]),
        version: kSheetVersion,
      });
      setEpithetQuery(attrs);
      setupDomainQueries(attrs);
      setupDivineFavorQuery(attrs);
    }
  );
}, "Handle setting default attributes when opening the sheet");
