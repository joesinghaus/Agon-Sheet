/* global on, setAttrs, getAttrs, getSectionIDs, getTranslationByKey,
   generateRowID, removeRepeatingRow, _ */

"use strict";

function getTranslation(key) {
  return getTranslationByKey(key) || `TRANSLATION_KEY_UNDEFINED: ${key}`;
}

function query(question, options) {
  return `?{${getTranslation(question)}|${options.join("|")}}`;
}

function fillRepeatingSectionFromData(sectionName, dataList, attrs) {
  const createdIDs = [];
  for (const entry of dataList) {
    let rowID;
    while (!rowID) {
      const newID = generateRowID();
      if (!createdIDs.includes(newID)) {
        rowID = newID;
        createdIDs.push(rowID);
      }
    }
    for (const [key, value] of Object.entries(entry)) {
      attrs[`repeating_${sectionName}_${rowID}_${key}`] = value;
    }
  }
}

function fillEmptyRows(sectionName, n, attrs) {
  const data = [...Array(n).keys()].map(() => ({ autogen: "1" }));
  fillRepeatingSectionFromData(sectionName, data, attrs);
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
    for (const [key, value] of Object.entries(values)) {
      this.setAttr(key, value);
    }
  }
  getAttr(name) {
    return this._sourceAttrs[name];
  }
  finalize(callback) {
    getAttrs(Object.keys(this._targetAttrs), (values) => {
      const finalAttrs = {};
      for (const [key, value] of Object.entries(this._targetAttrs)) {
        if (String(value) !== values[key]) finalAttrs[key] = String(value);
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

function getSetRepeating(attrs, sections, callback, finalCallback) {
  function getSetRepeatingImpl(attrs, sections, sectionToIds) {
    for (const [sectionName, sectionAttrs] of Object.entries(sections)) {
      getSectionIDs(`repeating_${sectionName}`, (idArray) => {
        sectionToIds[sectionName] = idArray;
        for (const id of idArray) {
          for (const attr of sectionAttrs) {
            attrs.push(`repeating_${sectionName}_${id}_${attr}`);
          }
        }
        delete sections[sectionName];
        getSetRepeatingImpl(attrs, sections, sectionToIds);
      });
      return; // Run the loop body at most once.
    }
    getSetAttrs(
      attrs,
      (proxy, setter) => callback(proxy, sectionToIds, setter),
      finalCallback
    );
  }
  // Copies the attrs and sections arguments so we can happily modify them in the function.
  getSetRepeatingImpl([...attrs], JSON.parse(JSON.stringify(sections)), {});
}

// We define our own wrappers for Roll20 event handlers to provide
// a bit more useful feedback and reduce boilerplate.
function register(attrs, callback, handlerName = "handler") {
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
function registerSingle(attr, handler, handlerName = "handler") {
  register([attr], () => getSetAttrs([attr], handler), handlerName);
  registerOpened(() => getSetAttrs([attr], handler), handlerName);
}

function registerButton(buttonName, callback, handlerName = "handler") {
  console.log(`Registering ${handlerName} for button: ${buttonName}.`);
  const throttledFunction = _.throttle(
    (event) => {
      console.log(`Triggering ${handlerName} for button: ${buttonName}.`);
      callback(event);
    },
    50,
    { trailing: false }
  );
  on(`clicked:${buttonName}`, throttledFunction);
}

/* Constants */
const kSheetVersion = "2";
const kBrace = "&" + "#125" + ";";
const kDoubleBrace = kBrace + kBrace;
const kExtraEpithetField = "boons_4_check_1";
const kPathosGivesTwoDiceField = "boons_6_check_1";
const kSpendDivineFavorBoon = "boons_7_check_1";
const kHarms = ["epic", "mythic", "perilous", "sacred"];
const kDomains = [
  "arts_oration",
  "blood_valor",
  "craft_reason",
  "resolve_spirit",
];
const kInitialStrifeDice = [
  {
    strifedie_name: getTranslation("name"),
  },
  {
    strifedie_name: getTranslation("epithet"),
  },
];
const kLabelAttributes = [
  "glory",
  "epithet",
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
  "the_vault_of_heaven",
  "divine_wrath",
  "plus_strife_level",
  "island_destinies",
  "epic",
  "mythic",
  "perilous",
  "sacred",
];

function performFirstTimeSetup(attrs) {
  fillEmptyRows("bonds", 8, attrs);
  fillEmptyRows("deeds", 4, attrs);
  fillEmptyRows("destiny", 2, attrs);
  fillRepeatingSectionFromData("strifedie", kInitialStrifeDice, attrs);
  for (const name of kLabelAttributes) {
    attrs[`${name}_label`] = getTranslation(name);
  }
}

function setupEpithetQuery(attrs) {
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
  attrs["epithet_and_name_query"] = query("epithet_die", epithet_options);
}

function setupDomainQueries(attrs) {
  const multiplier = attrs[kPathosGivesTwoDiceField] === "1" ? "2" : "";
  for (const domain of kDomains) {
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
  }
  attrs["domain_query"] = query("domain", [
    ...kDomains.map((d) => `@{${d}_label},${d}`),
    `${getTranslation("any_domain")},any`,
  ]);
}

function setupDivineFavorQuery(attrs) {
  const base_query = query("spend_divine_favor", [0]);
  if (attrs[kSpendDivineFavorBoon] === "1") {
    attrs["divine_favor_query"] = `[[${base_query} + 2*{${base_query},1}kl1]]`;
  } else {
    attrs["divine_favor_query"] = base_query;
  }
}

function calcStrifeRoll(attrs, sectionToIds) {
  const harmType = kHarms
    .filter((harm) => attrs[harm] == "1")
    .map((x) => `@{${x}_label}`)
    .join(", ");
  const dieSources = sectionToIds["strifedie"].map((id) => [
    attrs[`repeating_strifedie_${id}_strifedie_name`],
    attrs[`repeating_strifedie_${id}_strifedie_size`],
  ]);
  if (attrs["divine_wrath"] !== "0") {
    dieSources.push(["@{divine_wrath_label}", "@{divine_wrath}"]);
  }
  const dieFormula = dieSources
    .map(([name, die]) => `${die}[${name}]`)
    .join(" + ");
  attrs[
    "strife_formula"
  ] = `{{roll=[[{${dieFormula}}k1 + @{strife_level}[${getTranslation(
    "strife_level"
  )}]]]}} {{harm=${harmType}}}`;
}

function handleStrifeRoll() {
  getSetRepeating(
    [...kHarms, "divine_wrath"],
    {
      strifedie: ["strifedie_name", "strifedie_size"],
    },
    calcStrifeRoll
  );
}

registerSingle(
  kPathosGivesTwoDiceField,
  setupDomainQueries,
  "Handle giving two dice for extra domain"
);

registerSingle(
  kExtraEpithetField,
  setupEpithetQuery,
  "Handle adding or removing an extra epithet"
);

registerSingle(
  kSpendDivineFavorBoon,
  setupDivineFavorQuery,
  "Handle boon for getting +2d4 on spending divine favor"
);

register(
  [...kHarms, "divine_wrath", "repeating_strifedie"],
  handleStrifeRoll,
  "Handle strife player roll"
);
on("remove:repeating_strifedie", handleStrifeRoll);

registerOpened(function () {
  getSetAttrs(["version"], function (attrs, setter) {
    if (!attrs["version"]) performFirstTimeSetup(attrs);
    if (attrs["version"] == "1.0") {
      attrs["sheet_type"] = "character";
    }

    setter.setAttrs({
      advantage_bond_support_translated: getTranslation(
        "advantage_bond_support"
      ),
      bonusdice_query: query("bonusdice_query", [0]),
      target_query: query("target_number", [0]),
      version: kSheetVersion,
    });
  });
}, "Handle setting default attributes when opening the sheet");

registerButton("choose_character", () =>
  getSetAttrs([], (attrs) => {
    attrs["sheet_type"] = "character";
  })
);
registerButton("choose_strife", () =>
  getSetAttrs([], (attrs) => {
    attrs["sheet_type"] = "strife";
  })
);
