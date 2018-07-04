/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  wait,
  configs
} from '../common/common.js';
import * as Constants from '../common/constants.js';
import * as Selections from '../common/selections.js';
import * as Commands from '../common/commands.js';
import * as DragSelection from '../common/drag-selection.js';
import * as SharedState from '../common/shared-state.js';
import MenuUI from '../extlib/MenuUI.js';
import TabFavIconHelper from '../extlib/TabFavIconHelper.js';
import TabIdFixer from '../extlib/TabIdFixer.js';
import '../extlib/l10n.js';

log.context = 'Panel';

let gTabBar;
let gMenu;
let gSizeDefinitions;
let gLastClickedItem = null;
let gDragTargetIsClosebox;
let gClickFired = false;

window.addEventListener('DOMContentLoaded', async () => {
  gTabBar = document.querySelector('#tabs');
  gMenu = document.querySelector('#menu');
  gMenu.ui = new MenuUI({
    root:              gMenu,
    onCommand:         onMenuCommand,
    animationDuration: 150
  });
  gSizeDefinitions = document.getElementById('size-definitions');

  await configs.$loaded;
  document.documentElement.dataset.theme = configs.theme;
  SharedState.initAsSlave();

  gLastClickedItem = null;

  await updateUIForTST();

  browser.tabs.onActivated.addListener(onTabModified);
  browser.tabs.onCreated.addListener(onTabModified);
  browser.tabs.onRemoved.addListener(onTabModified);

  window.addEventListener('contextmenu', onContextMenu, { capture: true });
  window.addEventListener('click', onClick);
  gTabBar.addEventListener('mousedown', onMouseDown);
  gTabBar.addEventListener('mouseup', onMouseUp);
  await rebuildTabItems();

  gSizeDefinitions.textContent = `
    :root {
      --menu-max-width: ${window.innerWidth - 32}px;
      --menu-max-height: ${window.innerHeight - 32}px;
    }
  `;

  browser.runtime.sendMessage({
    type: Constants.kCOMMAND_NOTIFY_PANEL_SHOWN
  });
}, { once: true });

window.addEventListener('pagehide', () => {
  window.removeEventListener('contextmenu', onContextMenu, { capture: true });
  window.removeEventListener('click', onClick);
  gTabBar.removeEventListener('mousedown', onMouseDown);
  gTabBar.removeEventListener('mouseup', onMouseUp);
  gTabBar.removeEventListener('mouseover', onMouseOver);
  gTabBar.removeEventListener('mouseout', onMouseOut);
  browser.tabs.onActivated.removeListener(onTabModified);
  browser.tabs.onCreated.removeListener(onTabModified);
  browser.tabs.onRemoved.removeListener(onTabModified);
}, { once: true });

function onTabModified() {
  reserveClearSelection();
}

async function updateUIForTST() {
  const disabledMessage = document.querySelector('#disabled-message');

  if (configs.disablePanelWhenAlternativeTabBarIsAvailable) {
    try {
      const responded = await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_PING
      });
      if (responded) {
        disabledMessage.style.display = 'block';
        return;
      }
    }
    catch(_e) {
      // failed to establish connection
    }

    browser.runtime.sendMessage({
      type: Constants.kCOMMAND_UNREGISTER_FROM_TST
    });
  }

  disabledMessage.style.display = 'none';
}


function reserveClearSelection() {
  if (reserveClearSelection.reserved)
    clearTimeout(reserveClearSelection.reserved);
  reserveClearSelection.reserved = setTimeout(() => {
    delete reserveClearSelection.reserved;
    Commands.clearSelection();
  }, 100);
}

SharedState.onUpdated.addListener(() => {
  rebuildTabItems();
});

Selections.onChange.addListener((tabs, selected, _options = {}) => {
  if (!tabs.length)
    return;
  if (gDragTargetIsClosebox) {
    const selectors = tabs.map(tab => `#tab-${tab.id}`);
    const items = document.querySelectorAll(selectors.join(', '));
    for (const item of items) {
      if (selected)
        item.classList.add('ready-to-close');
      else
        item.classList.remove('ready-to-close');
    }
  }
  else {
    const selectors = tabs.map(tab => `#tab-${tab.id} input[type="checkbox"]`);
    const checkboxes = document.querySelectorAll(selectors.join(', '));
    for (const checkbox of checkboxes) {
      checkbox.checked = !!selected;
      const item = checkbox.parentNode.parentNode;
      if (selected)
        item.classList.add('selected');
      else
        item.classList.remove('selected');
    }
  }
});

function findTabItemFromEvent(event) {
  let target = event.target;
  while (target && !target.tab) {
    target = target.parentNode;
  }
  if (target && target.tab)
    return target;
  else
    return null;
}

function findCheckboxFromEvent(event) {
  let target = event.target;
  while (target && String(target.localName).toLowerCase() != 'input') {
    target = target.parentNode;
  }
  if (target && target.getAttribute('type') == 'checkbox')
    return target;
  else
    return null;
}

function findBottomCaptionFromEvent(event) {
  let target = event.target;
  while (target && target.className != 'caption bottom') {
    target = target.parentNode;
  }
  if (target && target.className == 'caption bottom')
    return target;
  else
    return null;
}

function onContextMenu(event) {
  event.stopPropagation();
  event.preventDefault();
  openMenu(event);
}

function onClick(event) {
  if (event.button != 0)
    return;

  gClickFired = true;
  if (event.target.classList &&
      event.target.classList.contains('closebox')) {
    if (!document.querySelector('.ready-to-close'))
      browser.tabs.remove(event.target.parentNode.tab.id);
    return;
  }
  const caption = findBottomCaptionFromEvent(event);
  if (caption && !gMenu.classList.contains('open')) {
    openMenu(event);
    return;
  }
  gMenu.ui.close();
  if (findCheckboxFromEvent(event))
    return;
  const item = findTabItemFromEvent(event);
  if (item) {
    DragSelection.onTabItemClick({
      window:        item.tab.windowId,
      tab:           item.tab,
      lastActiveTab: gLastClickedItem.tab,
      button:        event.button,
      altKey:        event.altKey,
      ctrlKey:       event.ctrlKey,
      metaKey:       event.metaKey,
      shiftKey:      event.shiftKey
    });
    gLastClickedItem.classList.remove('last-focused');
    gLastClickedItem = item;
    gLastClickedItem.classList.add('last-focused');
  }
  else
    DragSelection.onNonTabAreaClick({
      button: event.button
    });
}

let gLastDragEnteredTarget;
let gOnDragExitTimeout;

async function onMouseDown(event) {
  switch (event.button) {
    case 0:
      gClickFired = false;
      gTabBar.addEventListener('mousemove', onMouseMove);
      break;
  }
}

async function onMouseMove(event) {
  gTabBar.removeEventListener('mousemove', onMouseMove);
  if (gClickFired)
    return;
  const item = findTabItemFromEvent(event);
  if (!item)
    return;
  Selections.selection.targetWindow = (await browser.windows.getCurrent()).id
  gDragTargetIsClosebox =  event.target.classList.contains('closebox');
  gLastDragEnteredTarget = gDragTargetIsClosebox ? event.target : item ;
  DragSelection.onTabItemDragReady({
    tab:             item.tab,
    window:          Selections.selection.targetWindow,
    startOnClosebox: gDragTargetIsClosebox
  })
  gTabBar.addEventListener('mouseover', onMouseOver);
  gTabBar.addEventListener('mouseout', onMouseOut);
  gTabBar.setCapture(false);
}

function onMouseUp(event) {
  if (gMenu.classList.contains('open'))
    return;
  const item = findTabItemFromEvent(event);
  setTimeout(() => {
    if (gClickFired)
      return;
    DragSelection.onTabItemDragEnd({
      tab:     item && item.tab,
      window:  Selections.selection.targetWindow,
      clientX: event.clientX,
      clientY: event.clientY
    });
  }, 10);
  gTabBar.removeEventListener('mousemove', onMouseMove);
  gTabBar.removeEventListener('mouseover', onMouseOver);
  gTabBar.removeEventListener('mouseout', onMouseOut);
  document.releaseCapture();
}

function onMouseOver(event) {
  const item       = findTabItemFromEvent(event);
  let target     = item;
  const isClosebox = event.target.classList.contains('closebox');
  if (gDragTargetIsClosebox && isClosebox)
    target = event.target;
  cancelDelayedDragExit(target);
  if (item &&
      (!gDragTargetIsClosebox || isClosebox)) {
    if (target != gLastDragEnteredTarget) {
      DragSelection.onTabItemDragEnter({
        tab:    item.tab,
        window: Selections.selection.targetWindow
      });
    }
  }
  gLastDragEnteredTarget = target;
}

function onMouseOut(event) {
  const isClosebox = event.target.classList.contains('closebox');
  if (gDragTargetIsClosebox && !isClosebox)
    return;
  const item = findTabItemFromEvent(event);
  if (!item)
    return;
  let target = item;
  if (gDragTargetIsClosebox && isClosebox)
    target = event.target;
  cancelDelayedDragExit(target);
  gOnDragExitTimeout = setTimeout(() => {
    gOnDragExitTimeout = null;
    DragSelection.onTabItemDragExit({
      tab:    item.tab,
      window: Selections.selection.targetWindow
    });
  }, 10);
}

function cancelDelayedDragExit() {
  if (gOnDragExitTimeout) {
    clearTimeout(gOnDragExitTimeout);
    gOnDragExitTimeout = null;
  }
}

DragSelection.onDragSelectionEnd.addListener(message => {
  SharedState.push({
    updateMenu: true,
    contextTab: DragSelection.getDragStartTargetId()
  }).then(() => {
    openMenu(message);
  });
});


async function rebuildTabItems() {
  const range = document.createRange();
  range.selectNodeContents(gTabBar);
  range.deleteContents();
  const fragment = document.createDocumentFragment();
  const tabs = await browser.tabs.query({ currentWindow: true });
  for (const tab of tabs) {
    TabIdFixer.fixTab(tab);
    const tabItem = buildTabItem(tab);
    fragment.appendChild(tabItem);
  }
  range.insertNode(fragment);
  range.detach();
}

function buildTabItem(tab) {
  const item = document.createElement('li');

  const label    = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  if (tab.id in Selections.selection.tabs)
    checkbox.setAttribute('checked', true);
  checkbox.addEventListener('change', () => {
    item.classList.toggle('selected');
    Commands.setSelection(tab, item.classList.contains('selected'), { globalHighlight: false });
  });
  label.appendChild(checkbox);
  const favicon = document.createElement('img');
  TabFavIconHelper.loadToImage({
    image: favicon,
    tab:   tab
  });
  label.appendChild(favicon);

  const defaultFavicon = document.createElement('span');
  defaultFavicon.classList.add('default-favicon');
  label.appendChild(defaultFavicon);

  const title = document.createElement('span');
  title.classList.add('title');
  title.appendChild(document.createTextNode(tab.title));
  label.appendChild(title);

  item.setAttribute('id', `tab-${tab.id}`);
  if (tab.active) {
    gLastClickedItem = item;
    item.classList.add('last-focused');
  }
  if (tab.id in Selections.selection.tabs)
    item.classList.add('selected');
  item.appendChild(label);
  item.tab = tab;

  const closebox = document.createElement('span');
  closebox.classList.add('closebox');
  item.appendChild(closebox);

  return item;
}


async function openMenu(event) {
  const hasItems = await buildMenu();
  if (!hasItems)
    return;
  gMenu.ui.open({
    left: event.clientX,
    top:  event.clientY
  });
}

function onMenuCommand(item, event) {
  if (event.button != 0)
    return gMenu.ui.close();

  wait(0).then(() => gMenu.ui.close());

  const id = item.getAttribute('data-item-id');
  if (id) {
    browser.runtime.sendMessage({
      type: Constants.kCOMMAND_SELECTION_MENU_ITEM_CLICK,
      id:   id
    });
  }
}

async function buildMenu() {
  const items = await browser.runtime.sendMessage({
    type: Constants.kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO
  });
  items.shift(); // delete toplevel "selection" menu

  const range = document.createRange();
  range.selectNodeContents(gMenu);
  range.deleteContents();

  const fragment = document.createDocumentFragment();
  const knownItems = {};
  for (const item of items) {
    if (item.id == 'select' ||
        item.id == 'unselect')
      continue;

    const itemNode = buildMenuItem(item);
    if (item.parentId &&
        item.parentId != 'selection' &&
        item.parentId in knownItems) {
      const parent = knownItems[item.parentId];
      let subMenu = parent.lastChild;
      if (!subMenu || subMenu.localName != 'ul')
        subMenu = parent.appendChild(document.createElement('ul'));
      subMenu.appendChild(itemNode);
    }
    else {
      gMenu.appendChild(itemNode);
    }
    knownItems[item.id] = itemNode;
  }
  range.insertNode(fragment);

  range.detach();
  return gMenu.hasChildNodes();
}

function buildMenuItem(item) {
  const itemNode = document.createElement('li');
  itemNode.setAttribute('data-item-id', item.id);
  itemNode.classList.add('extra');
  itemNode.classList.add(item.type);
  if (item.type != 'separator') {
    itemNode.appendChild(document.createTextNode(item.title));
    itemNode.setAttribute('title', item.title);
  }
  return itemNode;
}
