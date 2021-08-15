# History

 - master/HEAD
 - 1.1.6 (2021.8.16)
   * Shorten too long file name by default.
   * Show message correctly about a download config of Firefox in the options page.
 - 1.1.5 (2021.5.5)
   * Show a notification about a download config of Firefox at the initial startup.
   * Fix wrong behaviors of "All Configs" UI: apply imported configs to options UI immediately and treat decimal values as valid for some numeric options.
 - 1.1.4 (2020.7.29)
   * Better support for the Managed Storage.
   * Flexible width input field for the dialog to input the folder name.
 - 1.1.3 (2020.4.28)
   * Handle dismissed semi-modal dialogs correctly.
   * Optimize semi-modal dialogs a little.
 - 1.1.2 (2020.4.25)
   * Improve implementation of semi-modal dialogs. Now it is more stable, more similar to native dialogs, more friendly for dark color scheme, and don't appear in the "Recently Closed Windows" list.
 - 1.1.1 (2020.4.24)
   * Show popup windows correctly on Firefox ESR68. (regression on 1.1.0)
 - 1.1.0 (2020.4.22)
   * Show folder name prompt as a semi-modal popup window.
 - 1.0.8 (2020.3.6)
   * Show in-content confirmation dialog correctly on lately versions of Firefox.
   * Remove keyboard shorctut customization UI, because Firefox ESR68 has it.
   * Uninitialized options page is now invisible.
 - 1.0.7 (2019.5.24)
   * Follow to changes on Tree Style Tab 3.0.12 and Multiple Tab Handler 3.0.7.
   * Add ability to export and import all configurations except keyboard shortcuts. (Options => "Development" => "Debug mode" => "All Configs" => "Import/Export")
 - 1.0.6 (2019.1.3)
   * Add ability co control visibility of context menu items for each: tab context menu and page context menu.
 - 1.0.5 (2018.12.15)
   * Invoke command from Multiple Tab Handler correctly.
 - 1.0.4 (2018.11.3)
   * Improve compatibility with Multiple Tab Handler.
 - 1.0.3 (2018.10.31)
   * Improve compatibility with Tree Style Tab.
   * Update menu label when there is no more multiselected tab.
 - 1.0.2 (2018.10.30)
   * Don't execute command for all unselected tabs.
 - 1.0.1 (2018.10.30)
   * Make `<all_urls>` permission optional.
   * Run command from keyboard shortcut correctly.
 - 1.0 (2018.10.30)
   * Separated from [Multiple Tab Handler](https://addons.mozilla.org/firefox/addon/multiple-tab-handler/).
   * The "zh-CN" locale is added by yfdyh000. Thanks!
