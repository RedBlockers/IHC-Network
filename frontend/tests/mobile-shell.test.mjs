import assert from "node:assert/strict";
import test from "node:test";

import { activeTab, showsTabBar } from "../src/lib/mobileShell.js";

test("la barre se montre quand on navigue", () => {
    assert.equal(showsTabBar({}), true);
});

test("elle disparaît en conversation", () => {
    assert.equal(showsTabBar({ channel: { channelId: 10 } }), false);
});

test("elle disparaît en appel", () => {
    assert.equal(showsTabBar({ call: { channelId: 20 } }), false);
});

test("elle reste absente quand les deux sont vrais", () => {
    assert.equal(showsTabBar({ channel: { channelId: 10 }, call: { channelId: 20 } }), false);
});

test("l'onglet actif suit l'écran, il ne le décide pas", () => {
    assert.equal(activeTab({ atHome: true, channel: null }), "home");
    assert.equal(activeTab({ atHome: true, channel: { channelId: 30 } }), "messages");
    assert.equal(activeTab({ atHome: false, channel: null }), "communities");
});

test("une couche ouverte l'emporte sur la vue en dessous", () => {
    assert.equal(activeTab({ notificationsOpen: true, atHome: false }), "alerts");
    assert.equal(activeTab({ settingsOpen: true, atHome: true, channel: { channelId: 1 } }), "profile");
});

test("les alertes passent devant le profil", () => {
    assert.equal(activeTab({ notificationsOpen: true, settingsOpen: true, atHome: true }), "alerts");
});
