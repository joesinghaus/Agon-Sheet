/* global on, setAttrs, getAttrs, getSectionIDs, getTranslationByKey,
   generateRowID, removeRepeatingRow, _ */

"use strict";

function getTranslation(key) {
  return getTranslationByKey(key) || `TRANSLATION_KEY_UNDEFINED: ${key}`;
}

function query(question, options) {
  return `?{${getTranslation(question)}|${options.join("|")}}`;
}

function fillRepeatingSectionFromData(sectionName, dataList, setter) {
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
    const row = setter.addRepeatingRow(sectionName, rowID);
    for (const [key, value] of Object.entries(entry)) {
      row[key] = value;
    }
  }
}

function fillEmptyRows(sectionName, n, setter) {
  const data = [...Array(n).keys()].map(() => ({ autogen: "1" }));
  fillRepeatingSectionFromData(sectionName, data, setter);
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

class RepeatingRow {
  constructor(setter, sectionName, id) {
    this._setter = setter;
    if (id) this._prefix = `repeating_${sectionName}_${id}`;
    else this._prefix = `repeating_${sectionName}`;
    this._id = id;
  }
  fullName(attrName) {
    return `${this._prefix}_${attrName}`;
  }
  setAttr(name, value) {
    return this._setter.setAttr(this.fullName(name), value);
  }
  getAttr(name) {
    if (name == "id") return this._id;
    return this._setter.getAttr(this.fullName(name));
  }
  proxy() {
    return new Proxy(this, attributeHandler);
  }
}

class AttributeSetter {
  constructor(attrs, sectionToIds = {}) {
    this._sourceAttrs = attrs;
    this._targetAttrs = {};
    
    this._repeating = new Proxy({}, {
      get: function (target, name) {
        if (!target[name]) target[name] = [];
        return target[name];
      },
    });

    for (const [sectionName, sectionIds] of Object.entries(sectionToIds)) {
      this._repeating[sectionName] = sectionIds.map((id) =>
        new RepeatingRow(this, sectionName, id).proxy()
      );
    }
  }
  setAttr(name, value) {
    if (name == "repeating") {
      throw new Error("Tried to modify the 'repeating' attribute.");
    }
    this._sourceAttrs[name] = value;
    this._targetAttrs[name] = value;
  }
  setAttrs(values) {
    for (const [key, value] of Object.entries(values)) {
      this.setAttr(key, value);
    }
  }
  getAttr(name) {
    if (name == "repeating") return this._repeating;
    return this._sourceAttrs[name];
  }
  proxy() {
    return new Proxy(this, attributeHandler);
  }
  addRepeatingRow(sectionName, id) {
    id = id || generateRowID();
    const row = new RepeatingRow(this, sectionName, id).proxy();
    this._repeating[sectionName].push(row);
    return row;
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

function getSetAttrs(attrs, callback, { repeating = {}, finalCallback } = {}) {
  attrs = [...attrs];
  const sectionToIds = {};

  const finished = _.after(Object.keys(repeating).length + 1, () => {
    getAttrs(attrs, (values) => {
      const setter = new AttributeSetter(values, sectionToIds);
      callback(setter.proxy(), setter);
      setter.finalize(finalCallback);
    });
  });
  for (const [sectionName, sectionAttrs] of Object.entries(repeating)) {
    getSectionIDs(`repeating_${sectionName}`, (idArray) => {
      sectionToIds[sectionName] = idArray;
      for (const id of idArray) {
        for (const attr of sectionAttrs) {
          attrs.push(`repeating_${sectionName}_${id}_${attr}`);
        }
      }
      finished();
    });
  }
  finished();
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
const kSrifeDiceLength = 12;
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

function performFirstTimeSetup(attrs, setter) {
  fillEmptyRows("bonds", 8, setter);
  fillEmptyRows("deeds", 4, setter);
  fillEmptyRows("destiny", 6, setter);
  fillRepeatingSectionFromData("strifedie", kInitialStrifeDice, setter);
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


function calcStrifeRoll(id, attrs) {
  const pre = `repeating_island_${id}_`;
  const dieSources = [];
  const harms = []
  for(let i=1; i<= kSrifeDiceLength; i++) {
    if(attrs[`${pre}strifedie_enabled_${i}`] && attrs[`${pre}strifedie_enabled_${i}`] == 1 && attrs[`${pre}strifedie_name_${i}`]) {
      kHarms.forEach(harm => {
        if(attrs[`${pre}${harm}_${i}`] && attrs[`${pre}${harm}_${i}`] == 1) {
          harms.push(harm);
        }
      });
      dieSources.push([attrs[`${pre}strifedie_name_${i}`],  attrs[`${pre}strifedie_size_${i}`]]);
    }
  }
  if (attrs["divine_wrath"] !== "0") {
    dieSources.push(["@{divine_wrath_label}", "@{divine_wrath}"]);
  }
  const dieFormula = dieSources
    .map(([name, die]) => `${die}[${name}]`)
    .join(" + ");
  const update = {}
  const harmType = Array.from(new Set(harms)).sort();
  update[`${pre}strife_formula`] = `{{roll=[[{${dieFormula}}k1 + @{strife_level}[${getTranslation(
    "strife_level"
  )}]]]}} {{harm=${harmType}}}`;
  setAttrs(update);
}
/*
function calcStrifeRoll(attrs) {
  const harmType = kHarms
    .filter((harm) => attrs[harm] == "1")
    .map((x) => `@{${x}_label}`)
    .join(", ");
  const dieSources = attrs.repeating.strifedie.map((row) => [
    row.strifedie_name,
    row.strifedie_size,
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
}*/

function getStrifeDiceAttributes(pre = "") {
  let attributes = [];
  for(let i=1; i<= kSrifeDiceLength; i++) {
    attributes.push(`${pre}strifedie_enabled_${i}`);
    attributes.push(`${pre}strifedie_name_${i}`);
    attributes.push(`${pre}strifedie_size_${i}`);
    kHarms.forEach(harm => {
      attributes.push(`${pre}${harm}_${i}`);
    });
  }
  return attributes;
}
//TODO: Perform refactoring to use Jacobs wrappers
function handleStrifeRoll(attrs) {
  const regexp = /-.{19}(?=_)|-.{19}$/g;
  const match = attrs.triggerName.match(regexp);
  const id = match.join();
  const pre = `repeating_island_${id}_`;
  const harms = getStrifeDiceAttributes(pre);
  getAttrs([...harms, "divine_wrath"], values => {
    calcStrifeRoll(id, values);
  });
}
/*
function handleStrifeRoll(id) {
  getSetAttrs([...kHarms, "divine_wrath"], calcStrifeRoll, {
    repeating: {
      strifedie: ["strifedie_name", "strifedie_size"],
    },
  });
}*/

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
  ["repeating_island"],
  handleStrifeRoll,
  "Handle strife player roll"
);

//Removing as we don't have those and intead
//on("remove:repeating_strifedie", handleStrifeRoll);

registerOpened(function () {
  getSetAttrs(["version"], function (attrs, setter) {
    if (!attrs["version"]) performFirstTimeSetup(attrs, setter);
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
registerButton("choose_island", () =>
  getSetAttrs([], (attrs) => {
    attrs["sheet_type"] = "island";
  })
);
