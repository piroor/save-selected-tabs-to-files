/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import EventListenerManager from '../extlib/EventListenerManager.js';

export const onChange = new EventListenerManager();

export const selection = {
  tabs:         {},
  targetWindow: null,
  lastClickedTab: null,
  clear() {
    this.tabs = {};
    this.targetWindow = this.lastClickedTab = null;
  },
  export() {
    const exported = {};
    for (const key of Object.keys(this)) {
      if (typeof this[key] != 'function')
        exported[key] = this[key];
    }
    return exported;
  },
  apply(foreignSession) {
    for (const key of Object.keys(foreignSession)) {
      if (typeof this[key] != 'function')
        this[key] = foreignSession[key];
    }
  }
};
