/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs,
  handleMissingReceiverError,
  notify,
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Commands from '/common/commands.js';
import * as ContextMenu from './context-menu.js';

log.context = 'BG';

configs.$loaded.then(async () => {
  browser.commands.onCommand.addListener(onShortcutCommand);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  registerToTST();
  notifyUseDownloadDirOptionNote();
  window.addEventListener('pagehide', async () => {
    unregisterFromTST();
    unregisterFromMTH();
  }, { once: true });
});


/*  listen events */

async function onShortcutCommand(command) {
  log('command: ', command);
  const activeTab = (await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0];
  const tabs = await Commands.getMultiselectedTabs(activeTab);
  log('tabs: ', { activeTab, tabs });

  if (tabs.length <= 0)
    return;

  switch (command) {
    case 'saveSelectedTabs':
      await Commands.saveTabs(tabs);
      if (configs.clearSelectionAfterCommandInvoked) {
        browser.tabs.highlight({
          windowId: activeTab.windowId,
          tabs:     [activeTab.index]
        });
      }
      break;
  }
}

function onMessageExternal(message, sender) {
  log('onMessageExternal: ', message, sender);

  switch (sender.id) {
    case Constants.kTST_ID: { // Tree Style Tab API
      let result;
      switch (message.type) {
        case Constants.kTSTAPI_NOTIFY_READY:
          registerToTST();
          ContextMenu.init();
          result = true;
          break;
      }
      if (result !== undefined)
        return Promise.resolve(result);
    }; break;

    case Constants.kMTH_ID: { // Multiple Tab Handler API
      let result;
      switch (message.type) {
        case Constants.kMTHAPI_READY:
          ContextMenu.init();
          result = true;
          break;
      }
      if (result !== undefined)
        return Promise.resolve(result);
    }; break;

    default:
      break;
  }
}

async function registerToTST() {
  try {
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type:  Constants.kTSTAPI_REGISTER_SELF,
      name:  browser.i18n.getMessage('extensionName'),
      icons: browser.runtime.getManifest().icons,
      listeningTypes: [
        Constants.kTSTAPI_NOTIFY_READY,
        Constants.kTSTAPI_CONTEXT_MENU_CLICK,
        Constants.kTSTAPI_CONTEXT_MENU_SHOWN
      ]
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
    return false;
  }
}

function unregisterFromTST() {
  try {
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_CONTEXT_MENU_REMOVE_ALL
    }).catch(handleMissingReceiverError);
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_UNREGISTER_SELF
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
  }
}

function unregisterFromMTH() {
  try {
    browser.runtime.sendMessage(Constants.kMTH_ID, {
      type: Constants.kMTHAPI_REMOVE_ALL_SELECTED_TAB_COMMANDS
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
  }
}


const USER_DOWNLOAD_DIR_OPTION_NOTE_URL = browser.extension.getURL(`resources/notify-features.html?useDownloadDirOptionNote`);

async function notifyUseDownloadDirOptionNote() {
  if (configs.useDownloadDirOptionNoteShown)
    return false;

  configs.useDownloadDirOptionNoteShown = true;
  await notify({
    url:     USER_DOWNLOAD_DIR_OPTION_NOTE_URL,
    title:   browser.i18n.getMessage(`startup_useDownloadDirOptionNote_title`),
    message: browser.i18n.getMessage(`startup_useDownloadDirOptionNote_message`),
    timeout: 90 * 1000
  });
  configs.useDownloadDirOptionNoteShown = true; // failsafe: it can be overridden by the value loaded from sync storage

  return true;
}

function initUseDownloadDirOptionNoteTab(tab) {
  const title = `${browser.i18n.getMessage('extensionName')} ${browser.runtime.getManifest().version}`;
  const description = browser.i18n.getMessage('useDownloadDirOption_note');

  browser.tabs.executeScript(tab.id, {
    code: `{
      document.querySelector('#title').textContent = document.title = ${JSON.stringify(title)};
      const descriptionContainer = document.querySelector('#description');
      descriptionContainer.innerHTML = '';
      descriptionContainer.appendChild(document.createTextNode(${JSON.stringify(description)}));
      descriptionContainer.appendChild(document.createElement('br'));
      const img = descriptionContainer.appendChild(document.createElement('img'));
      img.alt = '';
      img.src = ${JSON.stringify(browser.runtime.getURL('/resources/downloads-option.png'))};
    }`
  });
}

browser.tabs.onUpdated.addListener(
  (_tabId, updateInfo, tab) => {
    if (updateInfo.status != 'complete')
      return;
    initUseDownloadDirOptionNoteTab(tab);
  },
  { properties: ['status'],
    urls: [USER_DOWNLOAD_DIR_OPTION_NOTE_URL] }
);
browser.tabs.query({ url: USER_DOWNLOAD_DIR_OPTION_NOTE_URL })
  .then(tabs => tabs.forEach(initUseDownloadDirOptionNoteTab));
