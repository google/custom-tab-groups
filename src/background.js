// Copyright 2021 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const COLORS = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan',
]

let config = {
  rules: [],
  groupColors: [],
}

function getGroupTitle(groupName) {
  if (COLORS.includes(groupName))
    return ''
  return groupName
}

function getGroupColor(groupName) {
  for (const { name, color } of config.groupColors) {
    if (name === groupName)
      return color
  }
  if (COLORS.includes(groupName))
    return groupName
  return undefined
}

async function updateConfig({ rules, groupColors }) {
  config = {
    rules: rules.map(r => ({ ...r, regex: new RegExp(r.regex) })),
    groupColors,
  }
  const tabs = await cr.tabs.query({})
  for (const tab of tabs) {
    const rule = config.rules.find(r => r.regex.test(tab.url))
    if (!rule)
        return
    await putInGroup(tab.id, rule.groupName)
  }
}

async function getAndUpdateConfig() {
  const { rules, groupColors } =
      await cr.storage.sync.get(['rules', 'groupColors'])
  if (!rules || !groupColors) {
    await cr.storage.sync.set({ rules: [], groupColors: [] })
  } else {
    await updateConfig({ groupColors, rules })
  }
}

async function migrateLocalToSync() {
  // TODO(2021/03/29): remove this after a couple weeks
  const localState = await cr.storage.local.get(null)
  if (!localState || Object.keys(localState).length === 0)
    return
  await cr.storage.sync.set(localState)
  await cr.storage.local.clear()
}

migrateLocalToSync()
    .then(getAndUpdateConfig)
    .then(() => chrome.storage.sync.onChanged.addListener(getAndUpdateConfig))

async function findGroup(tab, groupName) {
  const query = {
    title: getGroupTitle(groupName),
    windowId: tab.windowId,
  }
  if (COLORS.includes(groupName))
    query.color = groupName
  const groups = await cr.tabGroups.query(query)
  if (groups.length > 0)
    return groups[0]
  return null
}

async function putInGroup(tabId, groupName) {
  await criticalSection(async () => {
    const tab = await cr.tabs.get(tabId)
    if (tab.pinned)
      return
    const group = await findGroup(tab, groupName)
    if (group) {
      await cr.tabs.group({
        groupId: group.id,
        tabIds: [tabId],
      })
    } else {
      const groupId = await cr.tabs.group({
        createProperties: {
          windowId: tab.windowId,
        },
        tabIds: [tabId],
      })
      await cr.tabGroups.update(groupId, {
        title: getGroupTitle(groupName),
        color: getGroupColor(groupName),
      })
    }
  })
}

chrome.webNavigation.onCommitted.addListener(async ({tabId, url}) => {
  const rule = config.rules.find(r => r.regex.test(url))
  if (!rule)
    return
  await putInGroup(tabId, rule.groupName)
})

chrome.action.onClicked.addListener(async () => {
  await cr.runtime.openOptionsPage()
})

// TODO: "open tab in current group" command
// chrome.commands.onCommand.addListener(() => {
// })
