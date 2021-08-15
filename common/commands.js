/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs
} from './common.js';
import * as Permissions from './permissions.js';

import RichConfirm from '/extlib/RichConfirm.js';

export async function getMultiselectedTabs(tab) {
  if (!tab)
    return [];
  if (tab.highlighted)
    return browser.tabs.query({
      windowId:    tab.windowId,
      highlighted: true
    });
  else
    return [tab];
}

const PREFIX_INPUT_PLACEHOLDER_MATCHER = /(^.*)(%input%)(.*$)/i;

export async function saveTabs(tabs) {
  if (!tabs.length)
    return;

  let prefix = configs.saveTabsPrefix;
  const matched = prefix.match(PREFIX_INPUT_PLACEHOLDER_MATCHER);
  if (matched) {
    log('matched for placeholder: ', matched);
    const prePart  = matched[1] || '';
    const postPart = matched[3] || '';
    let input;
    try {
      const windowId = (tabs.find(tab => tab.active) || tabs[0]).windowId;
      log('  windowId: ', windowId);
      const result = await RichConfirm.showInPopup(windowId, {
        modal: true,
        type:  'common-dialog',
        url:   '/resources/blank.html', // required on Firefox ESR68
        title: browser.i18n.getMessage('dialog_title'),
        content: `
          <div>${browser.i18n.getMessage('dialog_inputDescription')}</div
         ><div style="display: flex;
                      flex-direction: column;
                      white-space: nowrap;
                      margin: 0.5em;"
              ><label style="display: flex;
                             flex-direction: row;"
                     ><span>${prePart}</span
                     ><input type="text"
                             name="input"
                             value=""
                             style="display: flex;
                                    flex-grow: 1;
                                    flex-shrink: 1;"
                     ><span>${postPart}</span></label></div>
        `.trim(),
        onShown(container) {
          container.querySelector('[name="input"]').select();
        },
        buttons: [
          browser.i18n.getMessage('dialog_save'),
          browser.i18n.getMessage('dialog_cancel')
        ]
      });
      log('  result: ', result);
      if (result.buttonIndex != 0)
        return;
      input = result.values.input || '';
      prefix = `${prePart}${input}${postPart}`;
    }
    catch(error) {
      log('error: ', error);
    }
    log(' => ', { input, prefix });
  }
  prefix = `${prefix.replace(/\/$/, '')}/`;
  const alreadyUsedNames = new Set();
  for (const tab of tabs) {
    browser.downloads.download({
      url:      tab.url,
      filename: `${prefix}${await suggestUniqueFileNameForTab(tab, alreadyUsedNames)}`
    });
  }
}

async function suggestUniqueFileNameForTab(tab, alreadyUsedNames) {
  let name = await suggestFileNameForTab(tab);
  if (!alreadyUsedNames.has(name)) {
    alreadyUsedNames.add(name);
    log(`filename for tab ${tab.id}: `, name);
    return name;
  }
  const WITH_SUFFIX_MATCHER = /(-(\d+)(\.?[^\.]+))$/;
  let matched = name.match(WITH_SUFFIX_MATCHER);
  if (!matched) {
    name = name.replace(/(\.?[^\.]+)$/, '-0$1');
    matched = name.match(WITH_SUFFIX_MATCHER);
  }
  let count = parseInt(matched[2]);
  while (true) {
    count++;
    const newName = name.replace(matched[1], `-${count}${matched[3]}`);
    if (alreadyUsedNames.has(newName))
      continue;
    alreadyUsedNames.add(newName);
    log(`filename for tab ${tab.id}: `, newName);
    return newName;
  }
}

const kMAYBE_IMAGE_PATTERN    = /\.(jpe?g|png|gif|bmp|svg)/i;
const kMAYBE_RAW_FILE_PATTERN = /\.(te?xt|md)/i;

async function suggestFileNameForTab(tab) {
  const fileNameMatch = tab.url
    .replace(/^\w+:\/\/[^\/]+\//, '') // remove origin part
    .replace(/#.*$/, '') // remove fragment
    .replace(/\?.*$/, '') // remove query
    .match(/([^\/]+\.([^\.\/]+))$/);
  log('suggestFileNameForTab ', tab.id, fileNameMatch);
  if (fileNameMatch &&
      (kMAYBE_IMAGE_PATTERN.test(fileNameMatch[1]) ||
       kMAYBE_RAW_FILE_PATTERN.test(fileNameMatch[1]))) {
    const parts = fileNameMatch[1].split('.');
    const baseName = parts.slice(0, parts.length - 1);
    return `${shorten(baseName)}.${parts[parts.length - 1]}`;
  }

  let suggestedExtension = '';
  if (!tab.discarded &&
      Permissions.isPermittedTab(tab) &&
      await Permissions.isGranted(Permissions.ALL_URLS)) {
    log(`getting content type of ${tab.id}`);
    try {
      let contentType = await browser.tabs.executeScript(tab.id, {
        code: `document.contentType`
      });
      if (Array.isArray(contentType))
        contentType = contentType[0];
      log(`contentType of ${tab.id}: `, contentType);
      if (/^(text\/html|application\/xhtml\+xml)/.test(contentType)) {
        suggestedExtension = '.html';
      }
      else if (/^text\//.test(contentType)) {
        suggestedExtension = '.txt';
      }
      else if (/^image\//.test(contentType)) {
        suggestedExtension = `.${contentType.replace(/^image\/|\+.+$/g, '')}`;
      }
    }
    catch(e) {
      log('Error! ', e);
    }
  }
  log('suggestedExtension: ', tab.id, suggestedExtension);
  const baseName = shorten(tab.title.replace(/[\/\\:*?"<>|]/g, '_'));
  const fileName = `${baseName}${suggestedExtension}`;
  log('finally suggested fileName: ', tab.id, fileName);
  return fileName;
}

function shorten(name) {
  if (configs.maxFileNameLength < 0 ||
      name.length < configs.maxFileNameLength)
    return name;

  return `${name.substring(0, configs.maxFileNameLength - 1)}…`;
}
