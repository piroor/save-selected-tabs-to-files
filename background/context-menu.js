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

const mMenuItems = [
  {
    id:       'saveTabsOnTab',
    type:     'normal',
    visible:  true,
    title:    browser.i18n.getMessage('context_saveTabs_label'),
    icons:    browser.runtime.getManifest().icons,
    contexts: ['tab'],
    config:   'showContextCommandOnTab'
  },
  {
    id:       'saveTabsOnPage',
    type:     'normal',
    visible:  true,
    title:    browser.i18n.getMessage('context_saveTabs_label'),
    icons:    browser.runtime.getManifest().icons,
    contexts: ['page'],
    config:   'showContextCommandOnPage'
  }
];

export function init() {
  for (const item of mMenuItems) {
    const params = {
      id:       item.id,
      type:     item.type || 'normal',
      visible:  true,
      title:    item.title,
      icons:    item.icons,
      contexts: item.contexts
    };
    browser.menus.create(params);
    if (!item.contexts.includes('tab'))
      continue;
    try {
      browser.runtime.sendMessage(Constants.kTST_ID, {
        type:   Constants.kTSTAPI_CONTEXT_MENU_CREATE,
        params: params
      }).catch(handleMissingReceiverError);
    }
    catch(_e) {
    }
    try {
      browser.runtime.sendMessage(Constants.kMTH_ID, Object.assign({}, params, {
        type: Constants.kMTHAPI_ADD_SELECTED_TAB_COMMAND
      })).catch(handleMissingReceiverError);
    }
    catch(_e) {
    }
  }
}

async function onShown(info, tab) {
  const tabs = await Commands.getMultiselectedTabs(tab);
  let updated = false;
  for (const item of mMenuItems) {
    const lastVisible = item.visible;
    const lastTitle   = item.title;
    item.visible = configs[item.config] && tabs.length > 1 || configs.showContextCommandForSingleTab;
    item.title   = browser.i18n.getMessage(tabs.length > 1 ? 'context_saveTabs_label' : 'context_saveTab_label');
    if (lastVisible == item.visible &&
        lastTitle == item.title)
      continue;

    const params = {
      visible: item.visible,
      title:   item.title
    };
    browser.menus.update(item.id, params);
    updated = true;
    if (!item.contexts.includes('tab'))
      continue;
    try {
      browser.runtime.sendMessage(Constants.kTST_ID, {
        type:   Constants.kTSTAPI_CONTEXT_MENU_UPDATE,
        params: [item.id, params]
      }).catch(handleMissingReceiverError);
    }
    catch(_e) {
    }
  }
  if (updated)
    browser.menus.refresh();
}
browser.menus.onShown.addListener(onShown);

async function onClick(info, tab, selectedTabs = null) {
  log('context menu item clicked: ', info, tab);
  const tabs = selectedTabs || await Commands.getMultiselectedTabs(tab);
  log('tabs: ', tabs);
  switch (info.menuItemId) {
    case 'saveTabsOnTab':
    case 'saveTabsOnPage':
      await Commands.saveTabs(tabs);
      if (configs.clearSelectionAfterCommandInvoked &&
          tabs.length > 1) {
        const activeTab = tabs.filter(tab => tab.active)[0];
        browser.tabs.highlight({
          windowId: activeTab.windowId,
          tabs:     [activeTab.index]
        });
      }
      break;
  }
};
browser.menus.onClicked.addListener(onClick);

function onMessageExternal(message, sender) {
  log('onMessageExternal: ', message, sender);

  if (!message ||
      typeof message.type != 'string')
    return;

  switch (sender.id) {
    case Constants.kTST_ID: { // Tree Style Tab API
      const result = onTSTAPIMessage(message);
      if (result !== undefined)
        return result;
    }; break;

    case Constants.kMTH_ID: { // Multiple Tab Handler API
      const result = onMTHAPIMessage(message);
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
      if (!message.tab)
        return;
      return browser.tabs.get(message.tab.id).then(tab => onClick(message.info, tab));

    case Constants.kTSTAPI_CONTEXT_MENU_SHOWN:
      if (!message.tab)
        return;
      return browser.tabs.get(message.tab.id).then(tab => onClick(message.info, tab));
  }
}

function onMTHAPIMessage(message) {
  switch (message.type) {
    case Constants.kMTHAPI_INVOKE_SELECTED_TAB_COMMAND:
      return Commands.getMultiselectedTabs({ windowId: message.windowId, highlighted: true }).then(tabs => onClick({ menuItemId: message.id }, null, tabs));
  }
}

init();
