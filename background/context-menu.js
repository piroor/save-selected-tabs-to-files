/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs,
  handleMissingReceiverError
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Commands from '/common/commands.js';

const mMenuItem = {
  id:       'saveTabs',
  type:     'normal',
  visible:  true,
  title:    browser.i18n.getMessage('context_saveTabs_label'),
  contexts: ['tab', 'page']
};
browser.menus.create(mMenuItem);
try {
  browser.runtime.sendMessage(Constants.kTST_ID, {
    type:   Constants.kTSTAPI_CONTEXT_MENU_CREATE,
    params: mMenuItem
  }).catch(handleMissingReceiverError);
}
catch(_e) {
}

async function onShown(info, tab) {
  const tabs = await Commands.getMultiselectedTabs(tab);
  const lastVisible = mMenuItem.visible;
  mMenuItem.visible = tabs.length > 1 || configs.showContextCommandForSingleTab;
  if (lastVisible == mMenuItem.visible)
    return;

  browser.menus.update(mMenuItem.id, { visible: mMenuItem.visible });
  browser.menus.refresh();
  try {
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type:   Constants.kTSTAPI_CONTEXT_MENU_UPDATE,
      params: [mMenuItem.id, { visible: mMenuItem.visible }]
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
  }
}
browser.menus.onShown.addListener(onShown);

async function onClick(info, tab) {
  log('context menu item clicked: ', info, tab);
  const tabs = await Commands.getMultiselectedTabs(tab);
  log('tabs: ', tabs);
  switch (info.menuItemId) {
    case 'saveTabs':
      await Commands.saveTabs(tabs);
      if (configs.clearSelectionAfterCommandInvoked &&
          tabs.length > 1) {
        const activeTab = tabs.filter(tab => tab.active)[0];
        browser.tabs.highlight({
          windowId: activeTab.id,
          tabs:     [activeTab.index]
        });
      }
      break;
  }
};
browser.menus.onClicked.addListener(onClick);

function onMessageExternal(message, sender) {
  if (configs.debug)
    console.log('onMessageExternal: ', message, sender);

  if (!message ||
      typeof message.type != 'string')
    return;

  switch (sender.id) {
    case Constants.kTST_ID: { // Tree Style Tab API
      const result = onTSTAPIMessage(message);
      if (result !== undefined)
        return result;
    }; break;

    default:
      break;
  }
}
browser.runtime.onMessageExternal.addListener(onMessageExternal);

function onTSTAPIMessage(message) {
  switch (message.type) {
    case Constants.kTSTAPI_CONTEXT_MENU_CLICK:
      return onClick(message.info, message.tab);

    case Constants.kTSTAPI_CONTEXT_MENU_SHOWN:
      return onShown(message.info, message.tab);
  }
}
