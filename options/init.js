/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs
} from '/common/common.js';
import * as Permissions from '/common/permissions.js';
import Options from '/extlib/Options.js';
import '../extlib/l10n.js';

log.context = 'Options';
const options = new Options(configs);

function onConfigChanged(key) {
  switch (key) {
    case 'debug':
      if (configs.debug)
        document.documentElement.classList.add('debugging');
      else
        document.documentElement.classList.remove('debugging');
      break;
  }
}

configs.$addObserver(onConfigChanged);
window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;

  const focusedItem = document.querySelector(':target');
  for (const fieldset of document.querySelectorAll('fieldset.collapsible')) {
    if (configs.optionsExpandedGroups.includes(fieldset.id) ||
        (focusedItem && fieldset.contains(focusedItem)))
      fieldset.classList.remove('collapsed');
    else
      fieldset.classList.add('collapsed');

    const onChangeCollapsed = () => {
      if (!fieldset.id)
        return;
      const otherExpandedSections = configs.optionsExpandedGroups.filter(id => id != fieldset.id);
      if (fieldset.classList.contains('collapsed'))
        configs.optionsExpandedGroups = otherExpandedSections;
      else
        configs.optionsExpandedGroups = otherExpandedSections.concat([fieldset.id]);
    };

    const legend = fieldset.querySelector(':scope > legend');
    legend.addEventListener('click', () => {
      fieldset.classList.toggle('collapsed');
      onChangeCollapsed();
    });
    legend.addEventListener('keydown', event => {
      if (event.key != 'Enter')
        return;
      fieldset.classList.toggle('collapsed');
      onChangeCollapsed();
    });
  }

  Permissions.bindToCheckbox(
    Permissions.ALL_URLS,
    document.querySelector('#allUrlsPermissionGranted')
  );

  options.buildUIForAllConfigs(document.querySelector('#debug-configs'));
  onConfigChanged('debug');

  document.documentElement.classList.add('initialized');
}, { once: true });

