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

export async function getMultiselectedTabs(tab) {
  return browser.tabs.query({
    windowId: tab.windowId,
    highlighted: tab.highlighted
  });
}

export async function saveTabs(tabs) {
  let prefix = configs.saveTabsPrefix;
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
       kMAYBE_RAW_FILE_PATTERN.test(fileNameMatch[1])))
    return fileNameMatch[1];

  let suggestedExtension = '';
  if (!tab.discarded) {
    log(`getting content type of ${tab.id}`);
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
  log('suggestedExtension: ', tab.id, suggestedExtension);
  const fileName = `${tab.title.replace(/[\/\\:*?"<>|]/g, '_')}${suggestedExtension}`;
  log('finally suggested fileName: ', tab.id, fileName);
  return fileName;
}
