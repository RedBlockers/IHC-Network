"use strict";

const DECORATIONS = {
    none: { id: "none", label: "Aucune" },

    laurier: { id: "laurier", label: "Laurier", shape: "wreath", hue: 92 },
    couronne: { id: "couronne", label: "Couronne", shape: "crown", hue: 45 },
    flammes: { id: "flammes", label: "Flammes", shape: "flames", hue: 18 },
    vagues: { id: "vagues", label: "Vagues", shape: "waves", hue: 195 },
    etoiles: { id: "etoiles", label: "Étoiles", shape: "stars", hue: 265 },
    circuit: { id: "circuit", label: "Circuit", shape: "circuit", hue: 160 },
};

const IDS = Object.keys(DECORATIONS);

const decorationOf = (id) => DECORATIONS[id] ?? DECORATIONS.none;

const isKnown = (id) => Object.hasOwn(DECORATIONS, String(id ?? ""));

module.exports = { DECORATIONS, IDS, decorationOf, isKnown };
